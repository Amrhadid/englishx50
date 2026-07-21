import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isPlaceholderChallenge, mergeWithPlaceholders } from '../lib/placeholders'
import { challengeVideos } from '../lib/challenge'
import { challengeLockState, allVideosWatched, type LockState } from '../lib/completion'
import { levelTestTaskId, getAttempt, fetchServerTrials, hasLevelTestSubmission } from '../lib/progress'
import { loadUserNotes, countNotes, REQUIRED_NOTES } from '../lib/notes'
import ChallengeLockedModal from '../components/ChallengeLockedModal'
import LevelTestRequiredModal from '../components/LevelTestRequiredModal'
import SourceModal from '../components/SourceModal'
import NotesModal from '../components/NotesModal'
import NoticeModal from '../components/NoticeModal'
import type { Challenge } from '../types'
import Navbar from '../components/Navbar'
import Challenges from '../components/Challenges'
import Countdown from '../components/Countdown'
import ComingSoonModal from '../components/ComingSoonModal'
import FeedbackModal from '../components/FeedbackModal'
import SpeakingModal from '../components/SpeakingModal'
import LessonModal from '../components/LessonModal'
import DaysLeftBadge from '../components/DaysLeftBadge'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'
import { toArabicDigits } from '../lib/theme'

/**
 * The homepage a PAID (premium / admin) user sees: their program dashboard.
 * No marketing hero, no "learn about the program" banner, no upgrade gate —
 * just a personalized header, the level test, the challenges with their
 * progress / cooldown state, and every product modal (lesson, speaking,
 * source, notes, …). This is the "after purchase" surface.
 *
 * Assumes an <OnboardingProvider> ancestor. Only rendered for premium/admin
 * accounts, so the "not premium" gate paths from the old Landing are gone.
 */
export default function StudentHome() {
  const { progress, student, daysLeft } = useOnboardingContext()
  const { user } = useAuth()
  const isAdmin = isAdminEmail(user?.email)

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [feedbackFor, setFeedbackFor] = useState<Challenge | null>(null)
  const [speakingFor, setSpeakingFor] = useState<Challenge | null>(null)
  const [lessonFor, setLessonFor] = useState<Challenge | null>(null)
  const [comingSoonFor, setComingSoonFor] = useState<Challenge | null>(null)
  const [lockedFor, setLockedFor] = useState<{
    challenge: Challenge
    lock: Extract<LockState, { locked: true }>
  } | null>(null)
  const [showLevelTestRequired, setShowLevelTestRequired] = useState(false)
  const [sourceFor, setSourceFor] = useState<Challenge | null>(null)
  const [notesFor, setNotesFor] = useState<Challenge | null>(null)
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null)

  // Vocabulary notes per challenge (challenge_id → entries). A student must
  // record at least REQUIRED_NOTES words before the session video / PDF /
  // speaking task unlock. Loaded from the DB so it holds across devices.
  const [notesByChallenge, setNotesByChallenge] = useState<Record<string, string[]>>({})
  useEffect(() => {
    if (!user) {
      setNotesByChallenge({})
      return
    }
    let active = true
    loadUserNotes(user.id).then((map) => {
      if (active) setNotesByChallenge(map)
    })
    return () => {
      active = false
    }
  }, [user])

  const hasSourceLink = (c: Challenge): boolean => Boolean(c.pdf_url && c.pdf_url.trim())
  const notesDone = (c: Challenge): boolean =>
    isAdmin || !hasSourceLink(c) || countNotes(notesByChallenge[c.id] ?? []) >= REQUIRED_NOTES

  // The level test is the mandatory first step: challenges stay locked until
  // the account has a graded attempt (local, or the cross-device server signal).
  const [levelTestDone, setLevelTestDone] = useState(false)
  useEffect(() => {
    let active = true
    const check = async () => {
      const saved = getAttempt(levelTestTaskId(user?.id))
      if (saved && (saved.outcome === 'passed' || saved.outcome === 'failed')) return true
      if (!user) return false
      const [hasSub, used] = await Promise.all([
        hasLevelTestSubmission(user.id),
        fetchServerTrials('level_test', user.id),
      ])
      return hasSub || (used != null && used > 0)
    }
    check().then((done) => {
      if (active && done) setLevelTestDone(true)
    })
    return () => {
      active = false
    }
  }, [user])

  const realNumbers = useMemo(
    () => challenges.map((c) => c.number).sort((a, b) => a - b),
    [challenges],
  )

  useEffect(() => {
    let active = true
    if (!supabase) return
    supabase
      .from('x50_challenges')
      .select('*')
      .order('number', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (!error) setChallenges((data as Challenge[]) ?? [])
      })
    return () => {
      active = false
    }
  }, [])

  const scrollToChallenges = () =>
    document.getElementById('challenges')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Single gate for every challenge action. Viewers here are already
  // premium/admin, so the only gates left are: level test first, "next week"
  // for not-yet-added challenges, and the sequential cooldown.
  const gateChallenge = (c: Challenge, run: () => void) => {
    if (isAdmin) {
      if (isPlaceholderChallenge(c)) return setComingSoonFor(c)
      return run()
    }
    if (!levelTestDone) return setShowLevelTestRequired(true)
    if (isPlaceholderChallenge(c)) return setComingSoonFor(c)
    const lock = challengeLockState(c, realNumbers, progress)
    if (lock.locked) return setLockedFor({ challenge: c, lock })
    run()
  }

  const lockLabelFor = (c: Challenge): string | null => {
    if (isAdmin || isPlaceholderChallenge(c)) return null
    if (!levelTestDone) return '🎤 أكمل اختبار المستوى أولاً'
    const lock = challengeLockState(c, realNumbers, progress)
    if (!lock.locked) return null
    return lock.reason === 'cooldown'
      ? `🔒 متاح بعد ${toArabicDigits(lock.daysLeft)} يوم`
      : '🔒 أكمل التحدي السابق'
  }

  const displayedChallenges = useMemo(() => mergeWithPlaceholders(challenges), [challenges])

  const firstName = (student?.name ?? '').trim().split(/\s+/)[0]

  return (
    <div className="min-h-screen bg-white">
      <Navbar onStart={scrollToChallenges} onRedeem={undefined} />

      {/* Dashboard header — replaces the marketing hero for paid users. */}
      <section className="bg-[#ECEAFF] px-5 pb-9 pt-10" dir="rtl">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mb-2 inline-block rounded-full bg-white px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#8B5CF6]">
              لوحة المتابعة
            </span>
            <h1 className="text-[30px] font-black leading-tight text-[#1b1730] sm:text-[38px]">
              {firstName ? `أهلاً ${firstName} 👋` : 'أهلاً بعودتك 👋'}
            </h1>
            <p className="mt-1.5 text-[15px] font-semibold text-[#6b6685]">
              تابع تقدّمك في تحدي ٥٠ يوم وواصل من حيث توقفت.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3">
            {student?.code && <DaysLeftBadge daysLeft={daysLeft} />}
            <button
              onClick={scrollToChallenges}
              className="rounded-full bg-[#1b1730] px-6 py-3 text-[14px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#8B5CF6]"
            >
              أكمل التحدي ←
            </button>
          </div>
        </div>
      </section>

      <Challenges
        challenges={displayedChallenges}
        onSelect={(c) => gateChallenge(c, () => setLessonFor(c))}
        onFeedback={(c) => gateChallenge(c, () => setFeedbackFor(c))}
        onSpeak={(c) =>
          gateChallenge(c, () => {
            if (!notesDone(c)) return setNotesFor(c)
            if (!isAdmin && !allVideosWatched(user?.id, c)) {
              return setNotice({
                title: 'أكمل الدرس أولاً',
                message: 'شاهد كل فيديوهات الدرس كاملةً حتى تُفتح مهمة التحدّث.',
              })
            }
            setSpeakingFor(c)
          })
        }
        onWatch={(c) =>
          gateChallenge(c, () => {
            if (!challengeVideos(c).length) return setComingSoonFor(c)
            if (!notesDone(c)) return setNotesFor(c)
            setLessonFor(c)
          })
        }
        onSource={(c) => gateChallenge(c, () => setSourceFor(c))}
        onFile={(c) =>
          gateChallenge(c, () => {
            if (!c.file_url) return setComingSoonFor(c)
            if (!notesDone(c)) return setNotesFor(c)
            window.open(c.file_url, '_blank', 'noopener')
          })
        }
        onUpgrade={scrollToChallenges}
        onLevelTestComplete={() => setLevelTestDone(true)}
        levelTestDone={levelTestDone}
        lockLabelFor={lockLabelFor}
      />
      <Countdown onStart={scrollToChallenges} />

      <footer className="border-t border-[#f0ecf8] bg-white py-10 text-center" dir="rtl">
        <div className="mx-auto mb-3 flex items-center justify-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-extrabold text-white"
            style={{ background: 'linear-gradient(135deg, #7C6FF0 0%, #A964F0 45%, #F25C8A 100%)' }}
          >
            50
          </span>
          <span className="text-base font-extrabold text-[#1b1730]">
            English<span className="text-[#7C6FF0]">X50</span>
          </span>
        </div>
        <p className="text-sm text-[#9a9aa2]">
          © {new Date().getFullYear()} EnglishX50 — تحدي ٥٠ يوم لتتحدّث الإنجليزية
        </p>
      </footer>

      {showLevelTestRequired && (
        <LevelTestRequiredModal
          onClose={() => setShowLevelTestRequired(false)}
          onStart={() => {
            setShowLevelTestRequired(false)
            setTimeout(() => {
              document.getElementById('level-test')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 60)
          }}
        />
      )}
      {comingSoonFor && (
        <ComingSoonModal challenge={comingSoonFor} onClose={() => setComingSoonFor(null)} />
      )}
      {lockedFor && (
        <ChallengeLockedModal
          challenge={lockedFor.challenge}
          lock={lockedFor.lock}
          onClose={() => setLockedFor(null)}
        />
      )}
      {feedbackFor && <FeedbackModal challenge={feedbackFor} onClose={() => setFeedbackFor(null)} />}
      {speakingFor && <SpeakingModal challenge={speakingFor} onClose={() => setSpeakingFor(null)} />}
      {lessonFor && <LessonModal challenge={lessonFor} onClose={() => setLessonFor(null)} />}
      {sourceFor && <SourceModal challenge={sourceFor} onClose={() => setSourceFor(null)} />}
      {notesFor && user && (
        <NotesModal
          challenge={notesFor}
          userId={user.id}
          student={(() => {
            try {
              return localStorage.getItem('x50_user')
            } catch {
              return null
            }
          })()}
          initialEntries={notesByChallenge[notesFor.id] ?? []}
          onClose={() => setNotesFor(null)}
          onSaved={(entries) => {
            const c = notesFor
            setNotesByChallenge((prev) => ({ ...prev, [c.id]: entries }))
            setNotesFor(null)
            if (challengeVideos(c).length) setLessonFor(c)
          }}
        />
      )}
      {notice && (
        <NoticeModal title={notice.title} message={notice.message} onClose={() => setNotice(null)} />
      )}
    </div>
  )
}
