import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const VIDEO_ID = '0FeUVNqAQm8'
const THUMB = `https://img.youtube.com/vi/${VIDEO_ID}/maxresdefault.jpg`

/* eslint-disable @typescript-eslint/no-explicit-any */

// Load the YouTube IFrame API once and resolve when ready.
let ytReady: Promise<void> | null = null
function loadYouTubeApi(): Promise<void> {
  if ((window as any).YT?.Player) return Promise.resolve()
  if (ytReady) return ytReady
  ytReady = new Promise<void>((resolve) => {
    const prev = (window as any).onYouTubeIframeAPIReady
    ;(window as any).onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return ytReady
}

function studentId(): string | null {
  try {
    return localStorage.getItem('x50_user')
  } catch {
    return null
  }
}

export default function IntroVideo() {
  const [playing, setPlaying] = useState(false)
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const rowIdRef = useRef<string | null>(null)
  const maxPctRef = useRef(0)
  const pollRef = useRef<number | null>(null)

  const recordOpen = async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('x50_video_views')
      .insert({ student: studentId(), video_id: VIDEO_ID, watched_percent: 0 })
      .select('id')
      .single()
    rowIdRef.current = (data as { id?: string } | null)?.id ?? null
  }

  const savePercent = async (pct: number) => {
    const rounded = Math.min(100, Math.round(pct))
    if (rounded <= maxPctRef.current) return
    maxPctRef.current = rounded
    if (!supabase || !rowIdRef.current) return
    await supabase
      .from('x50_video_views')
      .update({ watched_percent: rounded, updated_at: new Date().toISOString() })
      .eq('id', rowIdRef.current)
  }

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const startPoll = () => {
    if (pollRef.current) return
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current
      if (p?.getDuration) {
        const dur = p.getDuration()
        const cur = p.getCurrentTime?.() ?? 0
        if (dur > 0) savePercent((cur / dur) * 100)
      }
    }, 3000)
  }

  const start = async () => {
    setPlaying(true)
    await recordOpen()
    await loadYouTubeApi()
    const YT = (window as any).YT
    if (!YT || !mountRef.current) return
    playerRef.current = new YT.Player(mountRef.current, {
      width: '100%',
      height: '100%',
      videoId: VIDEO_ID,
      playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onStateChange: (e: any) => {
          if (e.data === 1) startPoll() // playing
          else stopPoll()
          if (e.data === 0) savePercent(100) // ended
        },
      },
    })
  }

  useEffect(() => {
    return () => {
      stopPoll()
      try {
        playerRef.current?.destroy?.()
      } catch {
        /* ignore */
      }
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-5 pb-4 sm:px-8">
      <div className="relative aspect-video w-full overflow-hidden rounded-[32px] border border-[#efeafc] shadow-[0_18px_50px_-20px_rgba(124,111,240,0.5)]">
        {playing ? (
          <div className="absolute inset-0 h-full w-full">
            <div ref={mountRef} className="h-full w-full" />
          </div>
        ) : (
          <button
            onClick={start}
            className="group absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2a2350 0%, #4b3fa0 55%, #7C6FF0 100%)' }}
            aria-label="شاهد الفيديو التعريفي"
          >
            <img
              src={THUMB}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:opacity-80"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-[#1b1730]/60 to-transparent" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl transition group-hover:scale-110">
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-8 w-8 text-[#7C6FF0]" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5-11-6.5Z" />
              </svg>
            </span>
            <p className="absolute bottom-6 text-sm font-semibold text-white/90">شاهد الفيديو التعريفي 🎬</p>
          </button>
        )}
      </div>
    </div>
  )
}
