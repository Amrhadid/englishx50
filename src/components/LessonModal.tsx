import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { challengeVideos } from '../lib/challenge'
import { markVideoWatched, recordCompletionIfDone } from '../lib/completion'
import { toArabicDigits } from '../lib/theme'
import type { Challenge } from '../types'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LessonModalProps {
  challenge: Challenge
  onClose: () => void
}

// Load the Cloudflare Stream player SDK once.
let sdkPromise: Promise<void> | null = null
function loadStreamSdk(): Promise<void> {
  if ((window as any).Stream) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<void>((resolve) => {
    const tag = document.createElement('script')
    tag.src = 'https://embed.cloudflarestream.com/embed/sdk.latest.js'
    tag.onload = () => resolve()
    document.head.appendChild(tag)
  })
  return sdkPromise
}

function studentId(): string | null {
  try {
    return localStorage.getItem('x50_user')
  } catch {
    return null
  }
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export default function LessonModal({ challenge, onClose }: LessonModalProps) {
  const { premiumActive, refetch } = useOnboardingContext()
  const { user } = useAuth()
  const videos = premiumActive ? challengeVideos(challenge) : []
  const [selected, setSelected] = useState(0)
  const uid = videos[selected]?.uid ?? ''
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const rowIdRef = useRef<string | null>(null)
  const maxPctRef = useRef(0)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    if (!uid) return
    maxPctRef.current = 0
    rowIdRef.current = null
    let player: any = null

    const recordOpen = async () => {
      if (!supabase) return
      const { data } = await supabase
        .from('x50_video_views')
        .insert({ student: studentId(), video_id: uid, watched_percent: 0 })
        .select('id')
        .single()
      rowIdRef.current = (data as { id?: string } | null)?.id ?? null
    }

    const savePercent = async (pct: number) => {
      const rounded = Math.min(100, Math.round(pct))
      if (rounded <= maxPctRef.current) return
      maxPctRef.current = rounded
      // Count the video as watched near the end, then check challenge completion.
      if (rounded >= 90 && user) {
        markVideoWatched(user.id, challenge.id, uid)
        recordCompletionIfDone(user.id, challenge).then((done) => {
          if (done) refetch()
        })
      }
      if (!supabase || !rowIdRef.current) return
      await supabase
        .from('x50_video_views')
        .update({ watched_percent: rounded, updated_at: new Date().toISOString() })
        .eq('id', rowIdRef.current)
    }

    const setup = async () => {
      await recordOpen()
      await loadStreamSdk()
      const Stream = (window as any).Stream
      if (!Stream || !iframeRef.current) return
      player = Stream(iframeRef.current)
      pollRef.current = window.setInterval(() => {
        const dur = player?.duration
        const cur = player?.currentTime
        if (dur > 0) savePercent((cur / dur) * 100)
      }, 3000)
      player.addEventListener?.('ended', () => savePercent(100))
    }
    setup()

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [uid])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1730]/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-[28px] border border-white bg-white p-4 shadow-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f2fc] text-[#8a85a0] transition hover:bg-[#ece8f8]"
        >
          <CloseIcon />
        </button>

        <p className="mb-1 pr-12 text-[12px] font-bold text-[#7C6FF0]">
          درس الشرح — التحدي {toArabicDigits(challenge.number)}
        </p>
        <h2 className="mb-3 pr-12 text-lg font-extrabold text-[#1b1730]">{challenge.title}</h2>

        {uid ? (
          <>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
              <iframe
                ref={iframeRef}
                src={`https://iframe.cloudflarestream.com/${uid}?autoplay=true&preload=auto`}
                title={challenge.title}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
              />
            </div>
            {videos.length > 1 && (
              <div className="mt-3 flex flex-col gap-2">
                {videos.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setSelected(i)}
                    className={`flex items-center gap-2.5 rounded-2xl border p-3 text-right text-[13px] font-bold transition ${
                      i === selected
                        ? 'border-[#7C6FF0] bg-[#f1edff] text-[#534AB7]'
                        : 'border-[#ece7fb] bg-white text-[#1b1730] hover:border-[#c4b8ff]'
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEEDFE] text-[12px] font-extrabold text-[#534AB7]">
                      {toArabicDigits(i + 1)}
                    </span>
                    <span>{v.title || `فيديو ${toArabicDigits(i + 1)}`}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : !premiumActive ? (
          <div className="rounded-2xl bg-[#f1edff] p-8 text-center">
            <p className="mb-2 text-3xl">🔒</p>
            <p className="text-sm font-bold text-[#473BBE]">هذا الدرس متاح للمشتركين فقط</p>
            <p className="mt-1 text-[13px] text-[#7a7596]">أدخل كود الاشتراك لتفعيل حسابك ومشاهدة الفيديوهات.</p>
          </div>
        ) : (
          <p className="rounded-2xl bg-[#FEEFD2] p-6 text-center text-sm font-semibold text-[#A66A09]">
            لم تتم إضافة فيديو لهذا التحدي بعد.
          </p>
        )}
      </div>
    </div>
  )
}
