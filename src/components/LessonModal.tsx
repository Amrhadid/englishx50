import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { challengeVideos } from '../lib/challenge'
import {
  markVideoWatched,
  getWatchedVideos,
  getVideoProgress,
  saveVideoProgress,
  getVideoPosition,
  saveVideoPosition,
  recordCompletionIfDone,
  VIDEO_WATCHED_PCT,
} from '../lib/completion'
import { isAdminEmail } from '../lib/admin'
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
  const isAdmin = isAdminEmail(user?.email)
  const videos = premiumActive ? challengeVideos(challenge) : []
  const [selected, setSelected] = useState(0)
  const uid = videos[selected]?.uid ?? ''

  // Videos unlock sequentially: part 2 stays locked until part 1 is watched
  // (≥90% of real playback). Kept in state so finishing a video unlocks the
  // next one live; the admin can preview everything.
  const [watchedUids, setWatchedUids] = useState<string[]>(() =>
    getWatchedVideos(user?.id, challenge.id),
  )
  // Per-video watched percent (real playback), persisted so reopening the
  // modal shows where each part stands. The displayed bar scales the
  // VIDEO_WATCHED_PCT threshold to read 100% exactly when the next part
  // unlocks.
  const [progressPct, setProgressPct] = useState<Record<string, number>>(() =>
    getVideoProgress(user?.id, challenge.id),
  )
  useEffect(() => {
    Promise.resolve().then(() => {
      setWatchedUids(getWatchedVideos(user?.id, challenge.id))
      setProgressPct(getVideoProgress(user?.id, challenge.id))
    })
  }, [user, challenge.id])
  const videoUnlocked = (index: number): boolean => {
    if (isAdmin || index <= 0) return true
    const prevUid = videos[index - 1]?.uid
    return !!prevUid && watchedUids.includes(prevUid)
  }
  const displayPct = (vUid: string): number => {
    const raw = watchedUids.includes(vUid) ? 100 : (progressPct[vUid] ?? 0)
    return Math.min(100, Math.round((raw / VIDEO_WATCHED_PCT) * 100))
  }

  // Resume the selected part where the student left off. Captured only when the
  // selected video changes (not during playback) so the iframe never reloads
  // mid-watch. A finished part restarts from the beginning.
  const [resume, setResume] = useState(() => ({
    uid,
    at: getVideoPosition(user?.id, challenge.id, uid),
  }))
  if (resume.uid !== uid) {
    setResume({
      uid,
      at: watchedUids.includes(uid) ? 0 : getVideoPosition(user?.id, challenge.id, uid),
    })
  }
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const rowIdRef = useRef<string | null>(null)
  const maxPctRef = useRef(0)
  const watchedSecondsRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)
  // Furthest position reached by genuine playback — the student may seek back
  // anywhere up to here but cannot jump ahead of it.
  const maxReachedRef = useRef(0)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    if (!uid) return
    // Resume accounting from the saved position (matches the iframe startTime),
    // so continuing a half-watched part keeps the bar moving forward instead
    // of restarting the watched-seconds tally from zero.
    const startPos = watchedUids.includes(uid) ? 0 : getVideoPosition(user?.id, challenge.id, uid)
    maxPctRef.current = 0
    watchedSecondsRef.current = startPos
    maxReachedRef.current = startPos
    lastTimeRef.current = null
    rowIdRef.current = null
    let player: any = null

    const recordOpen = async () => {
      if (!supabase) return
      // Generate the id client-side: selecting rows back is admin-only under
      // RLS, so an INSERT ... RETURNING would be rejected for students.
      const id = crypto.randomUUID()
      const { error } = await supabase
        .from('x50_video_views')
        .insert({ id, student: studentId(), video_id: uid, watched_percent: 0 })
      rowIdRef.current = error ? null : id
    }

    const savePercent = async (pct: number) => {
      const rounded = Math.min(100, Math.round(pct))
      if (rounded <= maxPctRef.current) return
      maxPctRef.current = rounded
      // Live per-part progress bar (persisted across reopens).
      saveVideoProgress(user?.id, challenge.id, uid, rounded)
      setProgressPct((prev) => ({ ...prev, [uid]: Math.max(prev[uid] ?? 0, rounded) }))
      // Count the video as watched only when effectively all of it was played,
      // then check challenge completion.
      if (rounded >= VIDEO_WATCHED_PCT && user) {
        markVideoWatched(user.id, challenge.id, uid)
        // Unlock the next part live.
        setWatchedUids((prev) => (prev.includes(uid) ? prev : [...prev, uid]))
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
      // Count only real playback time: a seek (or buffered jump) moves
      // currentTime far more than one poll interval and is discarded, so
      // skipping ahead doesn't register as watching.
      const POLL_SECONDS = 3
      const tick = () => {
        const dur = player?.duration
        const cur = player?.currentTime
        if (!(dur > 0) || typeof cur !== 'number' || cur < 0) return
        // Remember where they are so the part resumes here next time.
        saveVideoPosition(user?.id, challenge.id, uid, cur)
        const last = lastTimeRef.current
        lastTimeRef.current = cur
        if (last === null) return
        // Credit only normal forward playback. When paused/buffering the time
        // doesn't advance (delta ~0); a seek jumps far (delta large) — both are
        // ignored. We deliberately don't read player.paused: the Stream SDK's
        // flag is unreliable right after autoplay and would freeze the bar.
        const delta = cur - last
        const rate = player?.playbackRate || 1
        // Cap absorbs a laggy/missed poll (~2 intervals) while still rejecting
        // a real seek, which jumps much further than normal playback.
        if (delta > 0.1 && delta <= POLL_SECONDS * rate * 2.2) {
          watchedSecondsRef.current += delta
          savePercent((watchedSecondsRef.current / dur) * 100)
        }
      }
      pollRef.current = window.setInterval(tick, POLL_SECONDS * 1000)

      // Forward-seek lock: a finished part (or admin) may scrub freely; for the
      // rest, the student can rewind anywhere but can't jump past the furthest
      // point they've genuinely watched.
      const allowFreeSeek = isAdmin || watchedUids.includes(uid)
      const SEEK_TOLERANCE = 1.2

      // Advance the watched frontier during contiguous playback (timeupdate
      // fires several times a second, so it stays tight against real seeks).
      player.addEventListener?.('timeupdate', () => {
        const cur = player?.currentTime
        if (typeof cur !== 'number') return
        if (cur > maxReachedRef.current && cur <= maxReachedRef.current + SEEK_TOLERANCE) {
          maxReachedRef.current = cur
        }
      })

      player.addEventListener?.('seeked', () => {
        const cur = player?.currentTime
        if (typeof cur !== 'number') return
        // Snap forward jumps back to the frontier; allow rewinds.
        if (!allowFreeSeek && cur > maxReachedRef.current + SEEK_TOLERANCE) {
          try {
            player.currentTime = maxReachedRef.current
          } catch {
            /* ignore */
          }
          lastTimeRef.current = maxReachedRef.current
          return
        }
        // Restart delta tracking from the new position.
        lastTimeRef.current = cur
      })
      player.addEventListener?.('ended', () => {
        const dur = player?.duration
        const cur = player?.currentTime
        // Credit the tail played since the last poll — `ended` fires between
        // polls with the player reporting paused, so tick() would skip it.
        if (typeof cur === 'number' && lastTimeRef.current !== null) {
          const delta = cur - lastTimeRef.current
          const rate = player?.playbackRate || 1
          if (delta > 0 && delta <= POLL_SECONDS * rate * 1.5) watchedSecondsRef.current += delta
          lastTimeRef.current = cur
        }
        if (dur > 0) savePercent((watchedSecondsRef.current / dur) * 100)
      })
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
                src={`https://iframe.cloudflarestream.com/${uid}?autoplay=true&preload=auto${
                  resume.uid === uid && resume.at > 3 ? `&startTime=${Math.floor(resume.at)}s` : ''
                }`}
                title={challenge.title}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
              />
            </div>
            {videos.length > 1 && (
              <div className="mt-3 flex flex-col gap-2">
                {videos.map((v, i) => {
                  const unlocked = videoUnlocked(i)
                  const pct = displayPct(v.uid)
                  return (
                    <button
                      key={i}
                      onClick={() => unlocked && setSelected(i)}
                      disabled={!unlocked}
                      className={`flex flex-col gap-2 rounded-2xl border p-3 text-right text-[13px] font-bold transition ${
                        i === selected
                          ? 'border-[#7C6FF0] bg-[#f1edff] text-[#534AB7]'
                          : unlocked
                            ? 'border-[#ece7fb] bg-white text-[#1b1730] hover:border-[#c4b8ff]'
                            : 'cursor-not-allowed border-[#ece7fb] bg-[#faf9ff] text-[#a39ec0]'
                      }`}
                    >
                      <span className="flex w-full items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${
                            unlocked ? 'bg-[#EEEDFE] text-[#534AB7]' : 'bg-[#f0eef6] text-[#a39ec0]'
                          }`}
                        >
                          {unlocked ? toArabicDigits(i + 1) : '🔒'}
                        </span>
                        <span className="flex flex-col items-start">
                          <span>{v.title || `فيديو ${toArabicDigits(i + 1)}`}</span>
                          {!unlocked && (
                            <span className="text-[11px] font-semibold text-[#a39ec0]">
                              شاهد الفيديو السابق أولاً
                            </span>
                          )}
                        </span>
                        {unlocked && (
                          <span
                            className={`ms-auto shrink-0 text-[11px] font-extrabold tabular-nums ${
                              pct >= 100 ? 'text-[#0C7C62]' : 'text-[#7C6FF0]'
                            }`}
                          >
                            {pct >= 100 ? '✓ ' : ''}
                            {toArabicDigits(pct)}٪
                          </span>
                        )}
                      </span>
                      {/* Watched-progress bar — part i+1 unlocks at 100%. */}
                      {unlocked && (
                        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[#EEEDFE]">
                          <span
                            className="block h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 100 ? '#23C4A0' : '#7C6FF0',
                            }}
                          />
                        </span>
                      )}
                    </button>
                  )
                })}
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
