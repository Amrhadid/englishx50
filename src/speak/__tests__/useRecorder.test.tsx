// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecorder, classifyMicError } from '../hooks/useRecorder'

/** A MediaRecorder stand-in that emits one chunk on stop. */
class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  static chunkBytes = 2048
  static isTypeSupported = () => true
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  stream: MediaStream
  constructor(stream: MediaStream) {
    this.stream = stream
    FakeMediaRecorder.instances.push(this)
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    if (FakeMediaRecorder.chunkBytes > 0) {
      this.ondataavailable?.({ data: new Blob([new Uint8Array(FakeMediaRecorder.chunkBytes)], { type: 'audio/webm' }) })
    }
    this.onstop?.()
  }
}

function fakeStream() {
  const track = { stop: vi.fn(), kind: 'audio' }
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track }
}

describe('useRecorder', () => {
  let getUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    FakeMediaRecorder.instances = []
    FakeMediaRecorder.chunkBytes = 2048
    getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    ;(window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder
  })

  it('does not touch the microphone until start() is called', () => {
    const { result } = renderHook(() => useRecorder({ maxSeconds: 60 }))
    expect(result.current.status).toBe('idle')
    expect(result.current.supported).toBe(true)
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('walks idle → requesting → recording → idle and returns the blob on stop', async () => {
    const { stream, track } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    const { result } = renderHook(() => useRecorder({ maxSeconds: 60 }))

    let outcome: Promise<unknown> | undefined
    act(() => {
      outcome = result.current.start()
    })
    expect(result.current.status).toBe('requesting')
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.status).toBe('recording')

    await act(async () => {
      vi.advanceTimersByTime(2100)
    })
    expect(result.current.seconds).toBeGreaterThan(1.5)

    act(() => {
      result.current.stop()
    })
    const res = (await outcome) as { ok: boolean; blob?: Blob; seconds?: number }
    expect(res.ok).toBe(true)
    expect(res.blob!.size).toBe(2048)
    expect(res.seconds).toBeGreaterThan(1.5)
    expect(result.current.status).toBe('idle')
    expect(result.current.seconds).toBe(0)
    // The stream is released as soon as the recording ends.
    expect(track.stop).toHaveBeenCalled()
  })

  it('auto-stops at maxSeconds', async () => {
    const { stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    const { result } = renderHook(() => useRecorder({ maxSeconds: 3 }))
    let outcome: Promise<unknown> | undefined
    act(() => {
      outcome = result.current.start()
    })
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(3400)
    })
    const res = (await outcome) as { ok: boolean; seconds?: number }
    expect(res.ok).toBe(true)
    expect(res.seconds).toBeGreaterThanOrEqual(3)
    expect(result.current.status).toBe('idle')
  })

  it('reports a denied permission', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    const { result } = renderHook(() => useRecorder({ maxSeconds: 60 }))
    let res: unknown
    await act(async () => {
      res = await result.current.start()
    })
    expect(res).toEqual({ ok: false, error: 'denied' })
    expect(result.current.status).toBe('idle')
  })

  it('reports a missing microphone', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('none'), { name: 'NotFoundError' }))
    const { result } = renderHook(() => useRecorder({ maxSeconds: 60 }))
    let res: unknown
    await act(async () => {
      res = await result.current.start()
    })
    expect(res).toEqual({ ok: false, error: 'no_device' })
  })

  it('reports an unsupported browser without asking for permission', async () => {
    delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder
    const { result } = renderHook(() => useRecorder({ maxSeconds: 60 }))
    expect(result.current.supported).toBe(false)
    let res: unknown
    await act(async () => {
      res = await result.current.start()
    })
    expect(res).toEqual({ ok: false, error: 'unsupported' })
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('treats a recording with no data as empty', async () => {
    FakeMediaRecorder.chunkBytes = 0
    const { stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    const { result } = renderHook(() => useRecorder({ maxSeconds: 60 }))
    let outcome: Promise<unknown> | undefined
    act(() => {
      outcome = result.current.start()
    })
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    act(() => {
      result.current.stop()
    })
    expect(await outcome).toEqual({ ok: false, error: 'empty' })
  })

  it('cancel() discards the recording and stops the tracks', async () => {
    const { stream, track } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    const { result } = renderHook(() => useRecorder({ maxSeconds: 60 }))
    let outcome: Promise<unknown> | undefined
    act(() => {
      outcome = result.current.start()
    })
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      result.current.cancel()
    })
    expect(await outcome).toEqual({ ok: false, error: 'cancelled' })
    expect(track.stop).toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('unmounting mid-recording stops the microphone stream', async () => {
    const { stream, track } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    const { result, unmount } = renderHook(() => useRecorder({ maxSeconds: 60 }))
    let outcome: Promise<unknown> | undefined
    act(() => {
      outcome = result.current.start()
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.status).toBe('recording')
    unmount()
    expect(track.stop).toHaveBeenCalled()
    expect(FakeMediaRecorder.instances[0].state).toBe('inactive')
    expect(await outcome).toEqual({ ok: false, error: 'cancelled' })
  })

  it('unmounting while the permission prompt is open releases the stream when it arrives', async () => {
    const { stream, track } = fakeStream()
    let grant: (s: MediaStream) => void = () => {}
    getUserMedia.mockReturnValue(new Promise<MediaStream>((r) => (grant = r)))
    const { result, unmount } = renderHook(() => useRecorder({ maxSeconds: 60 }))
    act(() => {
      void result.current.start()
    })
    unmount()
    await act(async () => {
      grant(stream)
      await Promise.resolve()
    })
    expect(track.stop).toHaveBeenCalled()
    expect(FakeMediaRecorder.instances).toHaveLength(0)
  })

  it('classifies getUserMedia errors', () => {
    expect(classifyMicError({ name: 'NotAllowedError' })).toBe('denied')
    expect(classifyMicError({ name: 'NotFoundError' })).toBe('no_device')
    expect(classifyMicError({ name: 'NotReadableError' })).toBe('busy')
    expect(classifyMicError(new Error('x'))).toBe('failed')
  })
})
