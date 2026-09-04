// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SpeakScreen from '../SpeakScreen'
import type { Conversation, SessionResult, SpeakApi, StartResult, TurnResult } from '../types'

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

const OPENERS: Record<string, string> = {
  daily: 'Hi! What was the best part of your day?',
  airport: 'Good morning! Where are you flying to today?',
}

const FEEDBACK = {
  positive: 'إجابة واضحة وطبيعية',
  original: 'The best part of my day is teaching my class.',
  correction: 'The best part of my day was teaching my class.',
  explanationArabic: 'نستخدم was لأن اليوم انتهى.',
}

function conv(over: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    scenario: 'daily',
    level: 'intermediate',
    status: 'active',
    speakingSeconds: 0,
    goalSeconds: 300,
    startedAt: '2026-09-03T10:00:00.000Z',
    completedAt: null,
    opener: OPENERS.daily,
    turns: [],
    ...over,
  }
}

/** A stateful fake API: one in-memory conversation, completes at `goal`. */
function api(over: Partial<Api> = {}, opts: { current?: Conversation | null; goal?: number; history?: Conversation[] } = {}): Api {
  let current: Conversation | null = opts.current ?? null
  const goal = opts.goal ?? 300
  return {
    session: vi.fn(
      async (): Promise<SessionResult> => ({
        ok: true,
        current,
        nextAvailableAt: current?.status === 'completed' ? '2026-09-04T10:00:00.000Z' : null,
        history: opts.history ?? [],
      }),
    ),
    conversation: vi.fn(async ({ conversationId }: { conversationId: string }) => {
      const c = [current, ...(opts.history ?? [])].find((x) => x?.id === conversationId)
      return c ? { ok: true as const, conversation: c } : { ok: false as const, code: 'conversation_not_found' as const }
    }),
    start: vi.fn(async ({ scenario }: { scenario: 'daily' | 'airport' }): Promise<StartResult> => {
      if (current?.status === 'completed') return { ok: false, code: 'daily_limit', status: 409, nextAvailableAt: '2026-09-04T10:00:00.000Z' }
      const resumed = current?.status === 'active'
      current = resumed ? current : conv({ scenario, opener: OPENERS[scenario], goalSeconds: goal })
      return { ok: true, conversation: current!, reply: current!.opener, audio: null, resumed }
    }),
    transcribe: vi.fn(async () => ({ ok: true as const, transcript: 'The best part of my day is teaching my class.' })),
    respond: vi.fn(async ({ text, speakingSeconds }: { text: string; speakingSeconds: number }): Promise<TurnResult> => {
      const seconds = speakingSeconds || 4
      current = {
        ...current!,
        speakingSeconds: current!.speakingSeconds + seconds,
        turns: [...(current!.turns ?? []), { id: `t${Date.now()}`, transcript: text, reply: 'That sounds lovely! What do you teach?', feedback: FEEDBACK, speakingSeconds: seconds, createdAt: '' }],
      }
      const completed = current.speakingSeconds >= current.goalSeconds
      if (completed) current = { ...current, status: 'completed', completedAt: '2026-09-03T10:20:00.000Z' }
      return {
        ok: true,
        reply: 'That sounds lovely! What do you teach?',
        feedback: FEEDBACK,
        audio: { base64: 'QUJD', mime: 'audio/mpeg' },
        speakingSeconds: current.speakingSeconds,
        goalSeconds: current.goalSeconds,
        completed,
        completedAt: current.completedAt,
        nextAvailableAt: completed ? '2026-09-04T10:20:00.000Z' : null,
      }
    }),
    end: vi.fn(async () => {
      current = { ...current!, status: 'completed', completedAt: '2026-09-03T10:05:00.000Z' }
      return { ok: true as const, conversation: current, nextAvailableAt: '2026-09-04T10:05:00.000Z' }
    }),
    ...over,
  }
}

const makePdf = vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]))
const download = vi.fn()

function renderScreen(a: Api) {
  return render(
    <MemoryRouter>
      <SpeakScreen api={a as unknown as SpeakApi} userId="u1" makePdf={makePdf} download={download} />
    </MemoryRouter>,
  )
}

const mic = () => screen.getByRole('button', { name: 'ابدأ التسجيل' })
const stopBtn = () => screen.getByRole('button', { name: 'إنهاء التسجيل' })
const startBtn = () => screen.getByRole('button', { name: 'ابدأ المحادثة' })
/** The mic bar's live status line (the first role="status" in the DOM). */
const status = () => screen.getAllByRole('status')[0].textContent ?? ''

async function startConversation(scenario?: string) {
  await waitFor(() => expect(startBtn().hasAttribute('disabled')).toBe(false))
  if (scenario) fireEvent.click(screen.getByRole('radio', { name: new RegExp(scenario) }))
  fireEvent.click(startBtn())
  await screen.findAllByText(scenario === 'في المطار' ? OPENERS.airport : OPENERS.daily)
}

/** Press the mic, wait ~1s of fake time, press again — one full recording. */
async function recordOnce() {
  await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
  fireEvent.click(mic())
  await waitFor(() => expect(status()).toContain('بسمعك دلوقتي'))
  await act(async () => {
    vi.advanceTimersByTime(1200)
  })
  fireEvent.click(stopBtn())
}

async function stopAudioWhenPlaying() {
  const stop = await screen.findByRole('button', { name: 'إيقاف الصوت' })
  fireEvent.click(stop)
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
    makePdf.mockClear()
    download.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder
  })

  it('renders the required Arabic copy, loads the session, and waits for the learner to start', async () => {
    const a = api()
    renderScreen(a)
    expect(screen.getByText('جاهزة للمحادثة')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'اتكلم إنجليزي من غير توتر' })).toBeTruthy()
    expect(screen.getByText('هدف اليوم: 5 دقائق')).toBeTruthy()
    expect(screen.getByText('Emma')).toBeTruthy()
    for (const label of ['محادثة يومية', 'مقابلة عمل', 'في المطار', 'اجتماع', 'مطعم وتسوق', 'محادثة حرة']) {
      expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeTruthy()
    }
    await waitFor(() => expect(a.session).toHaveBeenCalledTimes(1))
    // Nothing starts and no mic is requested until the learner presses start.
    await waitFor(() => expect(startBtn().hasAttribute('disabled')).toBe(false))
    expect(a.start).not.toHaveBeenCalled()
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()

    await startConversation()
    const [opener] = screen.getAllByText(OPENERS.daily)
    expect(opener.className).toContain('spk-en')
    expect(opener.closest('[dir="ltr"]')).not.toBeNull()
    expect(opener.closest('[dir="rtl"]')).not.toBeNull()
    await waitFor(() => expect(status()).toContain('اضغط وابدأ الكلام'))
    expect(mic().className).toMatch(/h-20 w-20/)
  })

  it('starts with the selected scenario and locks the chips afterwards', async () => {
    const a = api()
    renderScreen(a)
    await startConversation('في المطار')
    expect((a.start.mock.calls[0] as unknown as [{ scenario: string }])[0].scenario).toBe('airport')
    expect(screen.getByRole('radio', { name: /في المطار/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /محادثة يومية/ }).hasAttribute('disabled')).toBe(true)
  })

  it('completes a push-to-talk turn with no tips shown, and grows the progress bar', async () => {
    const a = api()
    renderScreen(a)
    await startConversation()
    await recordOnce()

    await waitFor(() => expect(a.transcribe).toHaveBeenCalledTimes(1))
    expect(a.transcribe.mock.calls[0][0].speakingSeconds).toBeGreaterThan(0.5)
    await waitFor(() => expect(screen.getAllByText('The best part of my day is teaching my class.').length).toBeGreaterThan(0))
    await waitFor(() => expect(a.respond).toHaveBeenCalledTimes(1))
    expect(a.respond.mock.calls[0][0]).toMatchObject({ conversationId: 'conv-1', level: 'intermediate' })
    expect(a.respond.mock.calls[0][0].text).toBe('The best part of my day is teaching my class.')

    await waitFor(() => expect(screen.getAllByText('That sounds lovely! What do you teach?').length).toBeGreaterThan(0))
    await stopAudioWhenPlaying()
    await waitFor(() => expect(mic()).toBeTruthy())
    expect(track.stop).toHaveBeenCalled()
    // No feedback during the conversation.
    expect(screen.queryByText('إجابة واضحة وطبيعية')).toBeNull()
    expect(screen.queryByRole('button', { name: /تحميل الملاحظات/ })).toBeNull()
    // Progress reflects the server's total.
    expect(Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(0)
  })

  it('ends a conversation early from the End button, after confirming, and shows the review', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const a = api()
    renderScreen(a)
    await startConversation()
    await recordOnce()
    await waitFor(() => expect(a.respond).toHaveBeenCalledTimes(1))
    await stopAudioWhenPlaying()

    const endBtn = screen.getByRole('button', { name: 'احصل على التقييم' })
    await waitFor(() => expect(endBtn.hasAttribute('disabled')).toBe(false))
    fireEvent.click(endBtn)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(a.end).toHaveBeenCalledWith({ conversationId: 'conv-1' }))

    await screen.findByRole('heading', { name: 'أكملت محادثة اليوم 🎉' })
    // The mic bar is gone — the conversation is over, well below the 5-minute goal.
    expect(screen.queryByRole('button', { name: 'ابدأ التسجيل' })).toBeNull()
    confirmSpy.mockRestore()
  })

  it('does nothing when the End confirmation is declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const a = api()
    renderScreen(a)
    await startConversation()

    const endBtn = screen.getByRole('button', { name: 'احصل على التقييم' })
    await waitFor(() => expect(endBtn.hasAttribute('disabled')).toBe(false))
    fireEvent.click(endBtn)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(a.end).not.toHaveBeenCalled()
    expect(mic()).toBeTruthy()
    confirmSpy.mockRestore()
  })

  it('shows the full feedback and the PDF download once the 5-minute goal is reached', async () => {
    const a = api({}, { goal: 1 })
    renderScreen(a)
    await startConversation()
    await recordOnce()
    await waitFor(() => expect(a.respond).toHaveBeenCalledTimes(1))
    await stopAudioWhenPlaying()

    await screen.findByRole('heading', { name: 'أكملت محادثة اليوم 🎉' })
    expect(screen.getByText('إجابة واضحة وطبيعية')).toBeTruthy()
    expect(screen.getByText('The best part of my day was teaching my class.')).toBeTruthy()
    expect(screen.getByText('نستخدم was لأن اليوم انتهى.')).toBeTruthy()
    expect(screen.getAllByText('اكتمل هدف اليوم').length).toBeGreaterThan(0)
    // Mic bar gone; no more turns.
    expect(screen.queryByRole('button', { name: 'ابدأ التسجيل' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /تحميل الملاحظات/ }))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect((makePdf.mock.calls[0] as unknown as [Conversation])[0]).toMatchObject({ id: 'conv-1', status: 'completed' })
    expect(download.mock.calls[0][1]).toMatch(/^EnglishX50-feedback-.*\.pdf$/)
  })

  it('resumes an unfinished conversation on return with its turns and progress', async () => {
    const current = conv({
      scenario: 'airport',
      opener: OPENERS.airport,
      speakingSeconds: 96,
      turns: [{ id: 't1', transcript: 'I am flying to Cairo.', reply: 'Nice! Is it a holiday?', feedback: FEEDBACK, speakingSeconds: 6, createdAt: '' }],
    })
    const a = api({}, { current })
    renderScreen(a)
    await screen.findAllByText('Nice! Is it a holiday?')
    expect(screen.getByText(OPENERS.airport)).toBeTruthy()
    expect(screen.getByText('I am flying to Cairo.')).toBeTruthy()
    expect(screen.getByText('واصلنا محادثتك من حيث توقفت 👋')).toBeTruthy()
    expect(a.start).not.toHaveBeenCalled()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('96')
    // Straight to the mic — no start button.
    expect(screen.queryByRole('button', { name: 'ابدأ المحادثة' })).toBeNull()
    await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
    // Feedback of earlier turns stays hidden until completion.
    expect(screen.queryByText('إجابة واضحة وطبيعية')).toBeNull()
  })

  it('shows the locked state with a countdown and the review when today is complete', async () => {
    const current = conv({
      status: 'completed',
      speakingSeconds: 304,
      completedAt: '2026-09-03T10:20:00.000Z',
      turns: [{ id: 't1', transcript: 'I teach English.', reply: 'Great!', feedback: FEEDBACK, speakingSeconds: 6, createdAt: '' }],
    })
    const a = api({}, { current })
    renderScreen(a)
    await screen.findByText('محادثة اليوم مكتملة')
    expect(screen.getByRole('heading', { name: 'ملاحظات Emma على محادثتك' })).toBeTruthy()
    expect(screen.getByText('إجابة واضحة وطبيعية')).toBeTruthy()
    expect(screen.getByRole('button', { name: /تحميل الملاحظات/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'ابدأ المحادثة' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'ابدأ التسجيل' })).toBeNull()
  })

  it('shows the locked state when starting is refused for the day', async () => {
    const a = api()
    a.start.mockResolvedValue({ ok: false, code: 'daily_limit', status: 409, nextAvailableAt: new Date(Date.now() + 3 * 3_600_000).toISOString() })
    renderScreen(a)
    await waitFor(() => expect(startBtn().hasAttribute('disabled')).toBe(false))
    fireEvent.click(startBtn())
    await screen.findByText('محادثة اليوم مكتملة')
  })

  it('lists past conversations and opens one for review and download', async () => {
    const past = conv({
      id: 'conv-old',
      scenario: 'airport',
      status: 'completed',
      speakingSeconds: 310,
      startedAt: '2026-09-01T10:00:00.000Z',
      completedAt: '2026-09-01T10:30:00.000Z',
      opener: OPENERS.airport,
      turns: [{ id: 'old-1', transcript: 'Old answer here.', reply: 'Old reply.', feedback: { positive: 'ممتاز' }, speakingSeconds: 6, createdAt: '' }],
    })
    const a = api({}, { history: [past] })
    renderScreen(a)
    await screen.findAllByText('محادثاتك السابقة')
    fireEvent.click(screen.getAllByRole('button', { name: 'عرض الملاحظات' })[0])
    await waitFor(() => expect(a.conversation).toHaveBeenCalledWith({ conversationId: 'conv-old' }))
    await screen.findByText('Old answer here.')
    expect(screen.getByText('ممتاز')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /تحميل الملاحظات/ }))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'الرجوع لمحادثة اليوم' }))
    await waitFor(() => expect(startBtn()).toBeTruthy())
  })

  it('shows a clear error when transcription fails and stays usable', async () => {
    const a = api({ transcribe: vi.fn(async () => ({ ok: false as const, code: 'transcription_failed' as const })) })
    renderScreen(a)
    await startConversation()
    await recordOnce()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('تعذّر تحويل صوتك إلى نص'))
    expect(a.respond).not.toHaveBeenCalled()
    await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
  })

  it('keeps the transcript and offers retry when the AI response fails', async () => {
    const a = api()
    a.respond.mockResolvedValueOnce({ ok: false, code: 'ai_failed', status: 502 })
    renderScreen(a)
    await startConversation()
    await recordOnce()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('تعذّر الحصول على رد Emma'))
    expect(screen.getByText('The best part of my day is teaching my class.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'حاول مرة أخرى' }))
    await waitFor(() => expect(screen.getAllByText('That sounds lovely! What do you teach?').length).toBeGreaterThan(0))
    expect(a.respond).toHaveBeenCalledTimes(2)
    expect(screen.getAllByText('The best part of my day is teaching my class.')).toHaveLength(1)
  })

  it('explains malformed AI output and rate limiting', async () => {
    const a = api()
    a.respond.mockResolvedValueOnce({ ok: false, code: 'ai_malformed', status: 502 })
    renderScreen(a)
    await startConversation()
    await recordOnce()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('لم نفهم رد Emma'))
    a.respond.mockResolvedValueOnce({ ok: false, code: 'rate_limited', status: 429 })
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
    await startConversation()
    await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
    fireEvent.click(mic())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('لم يتم السماح باستخدام الميكروفون'))
    expect(a.transcribe).not.toHaveBeenCalled()
  })

  it('shows the unsupported-browser notice and disables the mic', async () => {
    delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder
    renderScreen(api())
    await startConversation()
    expect(screen.getByRole('note').textContent).toContain('متصفحك لا يدعم التسجيل الصوتي')
    expect(mic().hasAttribute('disabled')).toBe(true)
  })

  it('shows only the typing animation while transcribing, with no status text', async () => {
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
    await startConversation()
    await recordOnce()
    await waitFor(() => expect(a.transcribe).toHaveBeenCalledTimes(1))
    expect(status().trim()).toBe('')
    expect(screen.queryByText(/تحويل/)).toBeNull()
    expect(document.querySelectorAll('.spk-dot').length).toBeGreaterThan(0)
    await act(async () => {
      release()
    })
    await waitFor(() => expect(a.respond).toHaveBeenCalledTimes(1))
  })

  it('cancelling a recording sends nothing', async () => {
    const a = api()
    renderScreen(a)
    await startConversation()
    await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
    fireEvent.click(mic())
    await waitFor(() => expect(status()).toContain('بسمعك دلوقتي'))
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء التسجيل' }))
    await waitFor(() => expect(mic()).toBeTruthy())
    expect(track.stop).toHaveBeenCalled()
    expect(a.transcribe).not.toHaveBeenCalled()
  })

  it('accepts a typed answer through the keyboard input', async () => {
    const a = api()
    renderScreen(a)
    await startConversation()
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
    await startConversation()
    await recordOnce()
    await waitFor(() => expect(a.transcribe).toHaveBeenCalledTimes(1))
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
    await startConversation()
    await waitFor(() => expect(mic().hasAttribute('disabled')).toBe(false))
    fireEvent.click(mic())
    await waitFor(() => expect(status()).toContain('بسمعك دلوقتي'))
    view.unmount()
    expect(track.stop).toHaveBeenCalled()
    expect(a.transcribe).not.toHaveBeenCalled()
  })
})
