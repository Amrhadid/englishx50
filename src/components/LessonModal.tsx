import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { challengeVideos } from '../lib/challenge'
import { recordCompletionIfDone, VIDEO_WATCHED_PCT } from '../lib/completion'
import {
  fetchChallengeVideoProgress,
  saveVideoProgress,
  type ProgressByVideo,
} from '../lib/videoProgress'
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
  const { user, authReady } = useAuth()
  const isAdmin = isAdminEmail(user?.email)
  const videos = premiumActive ? challengeVideos(challenge) : []
  const [selected, setSelected] = useState(0)
  const uid = videos[selected]?.uid ?? ''

  // Everything about the student's place in this lesson comes from the server
  // (x50_video_progress): which parts are watched, each part's percent, and
  // where to resume. null while loading — the player waits for it, otherwise a
  // half-watched part would silently restart from the beginning.
  const progressKey = authReady ? `${user?.id ?? 'anon'}:${challenge.id}` : ''
  const [loaded, setLoaded] = useState<{ key: string; data: ProgressByVideo } | null>(null)
  const progress: ProgressByVideo | null =
    progressKey && loaded?.key === progressKey ? loaded.data : null
  useEffect(() => {
    if (!progressKey) return
    let active = true
    const load = user?.id ? fetchChallengeVideoProgress(user.id, challenge) : Promise.resolve({})
    load.then((data) => {
      if (active) setLoaded({ key: progressKey, data })
    })
    return () => {
      active = false
    }
  }, [progressKey, user?.id, challenge])
  const updateProgress = (fn: (prev: ProgressByVideo) => ProgressByVideo) =>
    setLoaded((prev) => (prev && prev.key === progressKey ? { key: prev.key, data: fn(prev.data) } : prev))

  const isWatched = (vUid: string): boolean => !!progress?.[vUid]?.watched
  // Videos unlock sequentially: part 2 stays locked until part 1 is watched
  // (≥90% of real playback); the admin can preview everything.
  const videoUnlocked = (index: number): boolean => {
    if (isAdmin || index <= 0) return true
    const prevUid = videos[index - 1]?.uid
    return !!prevUid && isWatched(prevUid)
  }
  // The displayed bar scales the VIDEO_WATCHED_PCT threshold to read 100%
  // exactly when the next part unlocks; only a genuinely-watched part reads
  // 100%, otherwise cap at 99.
  const displayPct = (vUid: string): number => {
    if (isWatched(vUid)) return 100
    const pct = progress?.[vUid]?.percent ?? 0
    return Math.min(99, Math.round((pct / VIDEO_WATCHED_PCT) * 100))
  }

  // Resume the selected part where the student left off (on any device).
  // Captured once per (account, video) when the server state arrives, so later
  // progress updates never reload the iframe mid-watch. A finished part
  // restarts from zero.
  const resumeKey = progress !== null && uid ? `${user?.id ?? 'anon'}:${uid}` : ''
  const [resume, setResume] = useState<{ key: string; at: number } | null>(null)
  if (resumeKey && resume?.key !== resumeKey) {
    setResume({ key: resumeKey, at: isWatched(uid) ? 0 : (progress?.[uid]?.position ?? 0) })
  }
  // null while the resume point is still unknown — nothing is mounted yet.
  const resumeAt = resumeKey && resume?.key === resumeKey ? resume.at : null
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const rowIdRef = useRef<string | null>(null)
  // Latest user id, read inside the player effect rather than through its
  // closure (which captures the value from the render that started it).
  const userIdRef = useRef<string | undefined>(user?.id)
  useEffect(() => {
    userIdRef.current = user?.id
  }, [user?.id])
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    if (!uid || resumeAt === null) return
    // Accounting resumes from the saved position (matches the iframe
    // startTime), so continuing a half-watched part keeps the bar moving
    // forward instead of restarting from zero. The server keeps the maximum of
    // whatever it already has and what we send, so this is safe either way.
    const startMax = Math.max(resumeAt, progress?.[uid]?.maxReached ?? 0)
    // Furthest position reached by genuine playback — the student may seek
    // back anywhere up to here but cannot jump ahead of it. Also the basis for
    // the watched percent (skipping is blocked, so it's a true measure).
    let maxReached = startMax
    let position = resumeAt
    let duration = 0
    let maxPct = progress?.[uid]?.percent ?? 0
    let lastSaved = { position: -1, pct: -1 }
    let watchedNotified = isWatched(uid)
    let player: any = null
    rowIdRef.current = null

    const recordOpen = async () => {
      if (!supabase) return
      // Analytics log of opens (the admin dashboard reads it). Generate the id
      // client-side: selecting rows back is admin-only under RLS.
      const id = crypto.randomUUID()
      const { error } = await supabase
        .from('x50_video_views')
        .insert({
          id,
          student: studentId(),
          user_id: userIdRef.current ?? null,
          video_id: uid,
          watched_percent: 0,
        })
      rowIdRef.current = error ? null : id
    }

    // Push the current place + percent to the server. Skipped when nothing
    // moved since the last save; `keepalive` lets the final save on
    // pagehide/close outlive the page.
    const flush = async (opts: { keepalive?: boolean; force?: boolean } = {}) => {
      const uidNow = userIdRef.current
      if (!uidNow) return
      const pos = duration > 0 && duration - position <= 2 ? 0 : position
      const pct = Math.min(100, Math.round(maxPct))
      if (!opts.force && Math.abs(pos - lastSaved.position) < 1 && pct === lastSaved.pct) return
      lastSaved = { position: pos, pct }
      const crossed = pct >= VIDEO_WATCHED_PCT
      await saveVideoProgress(
        uidNow,
        challenge,
        uid,
        { position: pos, maxReached, percent: pct, duration },
        { keepalive: opts.keepalive },
      )
      if (crossed && !watchedNotified) {
        watchedNotified = true
        // The server trigger records the challenge completion (cooldown start)
        // when this was the last video; the fallback covers a missing trigger.
        updateProgress((prev) => ({
          ...prev,
          [uid]: { position: pos, maxReached, percent: pct, watched: true },
        }))
        recordCompletionIfDone(uidNow, challenge).finally(() => refetch())
      }
      if (supabase && rowIdRef.current) {
        await supabase
          .from('x50_video_views')
          .update({ watched_percent: pct, updated_at: new Date().toISOString() })
          .eq('id', rowIdRef.current)
      }
    }

    const setPercent = (pct: number) => {
      const rounded = Math.min(100, Math.round(pct))
      if (rounded <= maxPct) return
      maxPct = rounded
      // Live per-part progress bar.
      updateProgress((prev) => {
        const cur = prev[uid]
        return {
          ...prev,
          [uid]: {
            position: cur?.position ?? 0,
            maxReached,
            percent: Math.max(cur?.percent ?? 0, rounded),
            watched: !!cur?.watched,
          },
        }
      })
    }

    const readPlayer = () => {
      const dur = player?.duration
      const cur = player?.currentTime
      if (dur > 0) duration = dur
      if (typeof cur === 'number' && cur >= 0) position = cur
    }

    // Save outside the poll too (pause, tab hidden, unmount, page close).
    const persistNow = (keepalive = false) => {
      readPlayer()
      flush({ keepalive })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistNow(true)
    }
    const onPageHide = () => persistNow(true)
    const onPause = () => persistNow(false)

    const setup = async () => {
      await recordOpen()
      await loadStreamSdk()
      const Stream = (window as any).Stream
      if (!Stream || !iframeRef.current) return
      player = Stream(iframeRef.current)
      // Progress = the furthest position genuinely watched. Forward seeking is
      // blocked (below), so this can't be gamed by skipping, and finishing the
      // video reliably reaches ~100%.
      const POLL_SECONDS = 3
      const tick = () => {
        readPlayer()
        const dur = duration
        const cur = position
        if (!(dur > 0)) return
        const rate = player?.playbackRate || 1
        // Extend the watched frontier for contiguous playback (backstop in case
        // timeupdate is sparse); forward seeks are snapped so cur can't run
        // ahead of the frontier.
        if (cur > maxReached && cur <= maxReached + POLL_SECONDS * rate * 2.2) {
          maxReached = cur
        }
        // Reaching the last couple of seconds counts as fully watched even if
        // the reported percent never quite hits the threshold.
        if (dur - cur <= 2) {
          maxReached = dur
          setPercent(100)
        } else {
          setPercent((maxReached / dur) * 100)
        }
        flush()
      }
      pollRef.current = window.setInterval(tick, POLL_SECONDS * 1000)

      // Forward-seek lock: a finished part (or admin) may scrub freely; for the
      // rest, the student can rewind anywhere but can't jump past the furthest
      // point they've genuinely watched.
      const allowFreeSeek = isAdmin || isWatched(uid)
      const SEEK_TOLERANCE = 1.2

      // Advance the watched frontier during contiguous playback (timeupdate
      // fires several times a second, so it stays tight against real seeks).
      player.addEventListener?.('timeupdate', () => {
        const cur = player?.currentTime
        if (typeof cur !== 'number') return
        if (cur > maxReached && cur <= maxReached + SEEK_TOLERANCE) {
          maxReached = cur
        }
      })

      player.addEventListener?.('seeked', () => {
        const cur = player?.currentTime
        if (typeof cur !== 'number') return
        // Snap forward jumps back to the frontier; allow rewinds.
        if (!allowFreeSeek && cur > maxReached + SEEK_TOLERANCE) {
          try {
            player.currentTime = maxReached
          } catch {
            /* ignore */
          }
        }
      })
      // Reaching the end marks the part fully watched even if the last frames
      // weren't sampled by a poll, and clears the resume point.
      player.addEventListener?.('ended', () => {
        readPlayer()
        if (duration > 0) {
          maxReached = duration
          position = duration
          setPercent(100)
        }
        flush({ force: true })
      })

      // The poll can miss the last few seconds before the student pauses,
      // switches tabs or closes the page, so persist on those too.
      player.addEventListener?.('pause', onPause)
      window.addEventListener('pagehide', onPageHide)
      document.addEventListener('visibilitychange', onVisibility)
    }
    setup()

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      // Closing the modal or switching parts keeps the student's place.
      persistNow(true)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // progress/refetch are read at effect start on purpose: the effect must
    // only restart when the part or its resume point changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, resumeKey, resumeAt])

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
              {resumeAt === null ? (
                <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-white/70">
                  جارٍ تحميل الفيديو…
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  src={`https://iframe.cloudflarestream.com/${uid}?autoplay=true&preload=auto${
                    resumeAt > 3 ? `&startTime=${Math.floor(resumeAt)}s` : ''
                  }`}
                  title={challenge.title}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                />
              )}
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
