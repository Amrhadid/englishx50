// Plays Emma's synthesised replies (base64 → data URL) with stop / replay,
// and releases the element on unmount so nothing keeps talking after the
// learner leaves the page.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpeakAudio } from '../types'

export interface AudioPlayer {
  playing: boolean
  /** True once at least one reply has audio that can be replayed. */
  canReplay: boolean
  /** Remember `audio` and start playing it. Resolves false when playback could not start. */
  play(audio: SpeakAudio): Promise<boolean>
  /** Remember `audio` without playing (e.g. an opener loaded on page load). */
  load(audio: SpeakAudio): void
  replay(): Promise<boolean>
  stop(): void
}

export function useAudioPlayer(opts: { onEnded?: () => void } = {}): AudioPlayer {
  const [playing, setPlaying] = useState(false)
  const [canReplay, setCanReplay] = useState(false)
  const elRef = useRef<HTMLAudioElement | null>(null)
  const lastRef = useRef<SpeakAudio | null>(null)
  const onEndedRef = useRef(opts.onEnded)
  useEffect(() => {
    onEndedRef.current = opts.onEnded
  })

  const element = useCallback((): HTMLAudioElement => {
    if (elRef.current) return elRef.current
    const el = new Audio()
    el.preload = 'auto'
    const done = () => {
      setPlaying(false)
      onEndedRef.current?.()
    }
    el.addEventListener('ended', done)
    el.addEventListener('error', done)
    el.addEventListener('pause', () => setPlaying(false))
    elRef.current = el
    return el
  }, [])

  const stop = useCallback(() => {
    const el = elRef.current
    if (!el) return
    try {
      el.pause()
      el.currentTime = 0
    } catch {
      /* not started */
    }
    setPlaying(false)
  }, [])

  const load = useCallback((audio: SpeakAudio) => {
    lastRef.current = audio
    setCanReplay(true)
  }, [])

  const replay = useCallback(async (): Promise<boolean> => {
    const audio = lastRef.current
    if (!audio) return false
    const el = element()
    try {
      el.pause()
      el.src = `data:${audio.mime};base64,${audio.base64}`
      el.currentTime = 0
      await el.play()
      setPlaying(true)
      return true
    } catch {
      setPlaying(false)
      return false
    }
  }, [element])

  const play = useCallback(
    async (audio: SpeakAudio): Promise<boolean> => {
      load(audio)
      return replay()
    },
    [load, replay],
  )

  useEffect(() => {
    return () => {
      const el = elRef.current
      if (!el) return
      try {
        el.pause()
        el.removeAttribute('src')
        el.load()
      } catch {
        /* ignore */
      }
      elRef.current = null
    }
  }, [])

  return { playing, canReplay, play, load, replay, stop }
}
