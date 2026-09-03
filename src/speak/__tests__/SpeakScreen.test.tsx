// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SpeakScreen from '../SpeakScreen'
import type { SpeakApi, TurnResult } from '../types'

vi.mock('../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }))

/** Fake MediaRecorder: one chunk on stop, driven by the test. */
class FakeMediaRecorder {
  static isTypeSupported = () => true
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  stream: MediaStream
  constructor(stream: MediaStream) {
    this.stream = stream
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

type Api = { [K in keyof SpeakApi]: ReturnType<typeof vi.fn> }

function api(over: Partial<Api> = {}): Api {
  return {
    start: vi.fn(async ({ scenario }: { scenario: string }) => ({
      ok: true as const,
      reply: scenario === 'airport' ? 'Good morning! Where are you flying to today?' : 'Hi! What was the best part of your day?',
      audio: null,
    })),
    transcribe: vi.fn(async () => ({ ok: true as const, transcript: 'The best part of my day is teaching my class.' })),
    respond: vi.fn(async () => ({
      ok: true as const,
      reply: 'That sounds lovely! What do you teach?',
      feedback: {
        positive: 'إجابة واضحة وطبيعية',
        original: 'The best part of my day is teaching my class.',
        correction: 'The best part of my day was teaching my class.',
        explanationArabic: 'نستخدم was لأن اليوم انتهى.',
      },
      audio: { base64: 'QUJD', mime: 'audio/mpeg' },
    })),
    ...over,
  }
}

function renderScreen(a: Api) {
  return render(
    <MemoryRouter>
      <SpeakScreen api={a as unknown as SpeakApi} userId="u1" />
    </MemoryRouter>,
  )
}

const mic = () => screen.getByRole('button', { name: 'ابدأ التسجيل' })
const stopBtn = () => screen.getByRole('button', { name: 'إنهاء التسجيل' })
const status = () => screen.getByRole('status').textContent ?? ''

/** Press the mic, wait ~1s of fake time, press again — one full recording. */
async function recordOnce() {
  await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
  fireEvent.click(mic())
  await waitFor(() => expect(status()).toContain('جارٍ التسجيل'))
  await act(async () => {
    vi.advanceTimersByTime(1200)
  })
  fireEvent.click(stopBtn())
}

describe('SpeakScreen', () => {
  let track: { stop: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    track = { stop: vi.fn() }
    const stream = { getTracks: () => [track] } as unknown as MediaStream
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    })
    ;(window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder
  })

  it('renders the required Arabic copy and the LTR English opener', async () => {
    renderScreen(api())
    expect(screen.getByText('جاهز للمحادثة')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'اتكلم إنجليزي من غير توتر' })).toBeTruthy()
    expect(screen.getByText('هدف اليوم: 5 دقائق')).toBeTruthy()
    expect(screen.getByText('Emma')).toBeTruthy()
    expect(screen.getByText('Online')).toBeTruthy()
    expect(screen.getByText('شريكتك في المحادثة')).toBeTruthy()
    for (const label of ['محادثة يومية', 'مقابلة عمل', 'في المطار', 'اجتماع', 'مطعم وتسوق', 'محادثة حرة']) {
      expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeTruthy()
    }
    const opener = await screen.findByText('Hi! What was the best part of your day?')
    await waitFor(() => expect(status()).toContain('اضغط وتكلم — سيظهر رد Emma بعد الانتهاء'))
    // English text renders LTR inside the RTL page.
    expect(opener.className).toContain('spk-en')
    expect(opener.closest('[dir="ltr"]')).not.toBeNull()
    expect(opener.closest('[dir="rtl"]')).not.toBeNull()
    // The mic button is a 44px+ target.
    expect(mic().className).toMatch(/h-20 w-20/)
  })

  it('does not request the microphone before the mic button is pressed', async () => {
    renderScreen(api())
    await screen.findByText('Hi! What was the best part of your day?')
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  })

  it('completes a push-to-talk turn: recording → transcribing → thinking → speaking → feedback', async () => {
    const a = api()
    renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    await recordOnce()

    await waitFor(() => expect(a.transcribe).toHaveBeenCalledTimes(1))
    expect(a.transcribe.mock.calls[0][0].speakingSeconds).toBeGreaterThan(0.5)
    await waitFor(() => expect(screen.getAllByText('The best part of my day is teaching my class.').length).toBeGreaterThan(0))
    await waitFor(() => expect(a.respond).toHaveBeenCalledTimes(1))
    const sent = a.respond.mock.calls[0][0]
    expect(sent.scenario).toBe('daily')
    expect(sent.text).toBe('The best part of my day is teaching my class.')
    expect(sent.history).toEqual([{ role: 'assistant', text: 'Hi! What was the best part of your day?' }])

    await waitFor(() => expect(screen.getByText('That sounds lovely! What do you teach?')).toBeTruthy())
    // Emma's audio is playing → the stop-audio control replaces the mic.
    await waitFor(() => expect(screen.getByRole('button', { name: 'إيقاف الصوت' })).toBeTruthy())
    expect(status()).toContain('Emma بتتكلم')

    // Compact feedback under the learner's turn.
    expect(screen.getAllByText('إجابة واضحة وطبيعية').length).toBeGreaterThan(0)
    expect(screen.getAllByText('The best part of my day was teaching my class.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('نستخدم was لأن اليوم انتهى.').length).toBeGreaterThan(0)

    // Stop the audio → back to ready; the mic stream was released after recording.
    fireEvent.click(screen.getByRole('button', { name: 'إيقاف الصوت' }))
    await waitFor(() => expect(mic()).toBeTruthy())
    expect(track.stop).toHaveBeenCalled()
    // Session speaking time reached the progress bar.
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).not.toBe('0')
  })

  it('shows a clear error when transcription fails and stays usable', async () => {
    const a = api({ transcribe: vi.fn(async () => ({ ok: false as const, code: 'transcription_failed' as const })) })
    renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    await recordOnce()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('تعذّر تحويل صوتك إلى نص'))
    expect(a.respond).not.toHaveBeenCalled()
    await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
  })

  it('reports an empty recording without calling the AI', async () => {
    const a = api({ transcribe: vi.fn(async () => ({ ok: false as const, code: 'empty_transcript' as const })) })
    renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    await recordOnce()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('لم نلتقط صوتاً واضحاً'))
    expect(a.respond).not.toHaveBeenCalled()
  })

  it('keeps the transcript and offers retry when the AI response fails', async () => {
    const respond = vi.fn(async (): Promise<TurnResult> => ({ ok: false, code: 'ai_failed', status: 502 }))
    const a = api({ respond })
    renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    await recordOnce()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('تعذّر الحصول على رد Emma'))
    expect(screen.getByText('The best part of my day is teaching my class.')).toBeTruthy()

    respond.mockResolvedValueOnce({
      ok: true,
      reply: 'Second try worked!',
      feedback: { positive: 'أحسنت' },
      audio: null,
    })
    fireEvent.click(screen.getByRole('button', { name: 'حاول مرة أخرى' }))
    await waitFor(() => expect(screen.getByText('Second try worked!')).toBeTruthy())
    expect(respond).toHaveBeenCalledTimes(2)
    // No duplicate learner bubble after the retry.
    expect(screen.getAllByText('The best part of my day is teaching my class.')).toHaveLength(1)
  })

  it('explains malformed AI output and rate limiting', async () => {
    const respond = vi.fn(async (): Promise<TurnResult> => ({ ok: false, code: 'ai_malformed', status: 502 }))
    const a = api({ respond })
    renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    await recordOnce()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('لم نفهم رد Emma'))

    respond.mockResolvedValueOnce({ ok: false, code: 'rate_limited', status: 429 })
    fireEvent.click(screen.getByRole('button', { name: 'حاول مرة أخرى' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('الأقصى من المحاولات'))
  })

  it('shows the microphone-denied state', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw Object.assign(new Error('denied'), { name: 'NotAllowedError' })
        }),
      },
    })
    const a = api()
    renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
    fireEvent.click(mic())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('لم يتم السماح باستخدام الميكروفون'))
    expect(a.transcribe).not.toHaveBeenCalled()
  })

  it('shows the unsupported-browser notice and disables the mic', async () => {
    delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder
    renderScreen(api())
    await screen.findByText('Hi! What was the best part of your day?')
    expect(screen.getByRole('note').textContent).toContain('متصفحك لا يدعم التسجيل الصوتي')
    expect(mic().hasAttribute('disabled')).toBe(true)
  })

  it('selecting a scenario restarts the conversation with that scenario', async () => {
    const a = api()
    renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    fireEvent.click(screen.getByRole('radio', { name: /في المطار/ }))
    await waitFor(() => expect(a.start).toHaveBeenCalledTimes(2))
    expect(a.start.mock.calls[1][0].scenario).toBe('airport')
    await screen.findByText('Good morning! Where are you flying to today?')
    expect(screen.queryByText('Hi! What was the best part of your day?')).toBeNull()
    expect(screen.getByRole('radio', { name: /في المطار/ }).getAttribute('aria-checked')).toBe('true')

    // The chosen scenario is what later turns are sent with.
    await recordOnce()
    await waitFor(() => expect(a.respond).toHaveBeenCalledTimes(1))
    expect(a.respond.mock.calls[0][0].scenario).toBe('airport')
  })

  it('cancelling a recording sends nothing', async () => {
    const a = api()
    renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
    fireEvent.click(mic())
    await waitFor(() => expect(status()).toContain('جارٍ التسجيل'))
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء التسجيل' }))
    await waitFor(() => expect(mic()).toBeTruthy())
    expect(track.stop).toHaveBeenCalled()
    expect(a.transcribe).not.toHaveBeenCalled()
  })

  it('accepts a typed answer through the keyboard input', async () => {
    const a = api()
    renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    await waitFor(() => expect(screen.getByRole('button', { name: 'اكتب بدل الكلام' }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'اكتب بدل الكلام' }))
    const box = screen.getByPlaceholderText('Type your answer in English…') as HTMLTextAreaElement
    expect(box.getAttribute('dir')).toBe('ltr')
    fireEvent.change(box, { target: { value: 'I went to the gym.' } })
    fireEvent.click(screen.getByRole('button', { name: 'إرسال' }))
    await waitFor(() => expect(a.respond).toHaveBeenCalledTimes(1))
    expect(a.respond.mock.calls[0][0].text).toBe('I went to the gym.')
    expect(a.transcribe).not.toHaveBeenCalled()
  })

  it('ignores a double press while a turn is in flight', async () => {
    let release: () => void = () => {}
    const a = api({
      transcribe: vi.fn(
        () =>
          new Promise((r) => {
            release = () => r({ ok: true, transcript: 'Hello there.' })
          }),
      ),
    })
    renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    await recordOnce()
    await waitFor(() => expect(a.transcribe).toHaveBeenCalledTimes(1))
    // The primary button is disabled while transcribing; extra clicks do nothing.
    const busyBtn = screen.getByRole('button', { name: 'ابدأ التسجيل' })
    expect(busyBtn.hasAttribute('disabled')).toBe(true)
    fireEvent.click(busyBtn)
    fireEvent.click(busyBtn)
    await act(async () => {
      release()
    })
    await waitFor(() => expect(a.respond).toHaveBeenCalledTimes(1))
    expect(a.transcribe).toHaveBeenCalledTimes(1)
  })

  it('unmounting mid-recording releases the microphone', async () => {
    const a = api()
    const view = renderScreen(a)
    await screen.findByText('Hi! What was the best part of your day?')
    await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
    fireEvent.click(mic())
    await waitFor(() => expect(status()).toContain('جارٍ التسجيل'))
    view.unmount()
    expect(track.stop).toHaveBeenCalled()
    expect(a.transcribe).not.toHaveBeenCalled()
  })
})
