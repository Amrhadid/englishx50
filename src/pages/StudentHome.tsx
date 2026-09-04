import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isPlaceholderChallenge, mergeWithPlaceholders } from '../lib/placeholders'
import { challengeVideos } from '../lib/challenge'
import { challengeLockState, allVideosWatched, type LockState } from '../lib/completion'
import { levelTestTaskId, getAttempt, fetchServerTrials, hasLevelTestSubmission } from '../lib/progress'
import { loadUserNotes, countNotes, REQUIRED_NOTES } from '../lib/notes'
import { Link } from 'react-router-dom'
import ChallengeLockedModal from '../components/ChallengeLockedModal'
import LevelTestRequiredModal from '../components/LevelTestRequiredModal'
import SourceModal from '../components/SourceModal'
import NotesModal from '../components/NotesModal'
import NoticeModal from '../components/NoticeModal'
import type { Challenge } from '../types'
import Challenges from '../components/Challenges'
import ComingSoonModal from '../components/ComingSoonModal'
import FeedbackModal from '../components/FeedbackModal'
import SpeakingModal from '../components/SpeakingModal'
import LessonModal from '../components/LessonModal'
import TaskModal from '../components/TaskModal'
import DaysLeftBadge from '../components/DaysLeftBadge'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'
import { toArabicDigits, UI } from '../lib/theme'

/**
 * «ابدأ التحدي» — what a subscribed (premium / admin) account sees behind the
 * gate on /challenge. No marketing, no upgrade path: a personalized header,
 * the level test, and the challenges as sections of six objects each, with
 * every product modal (source, task, lesson, speaking, feedback, notes).
 *
 * Assumes an <OnboardingProvider> ancestor, and that the caller (Challenge)
 * has already established the account is subscribed.
 */
export default function StudentHome() {
  const { progress, student, daysLeft, cooldownSkips, challengeUnlocks } =
    useOnboardingContext()
  const { user } = useAuth()
  const isAdmin = isAdminEmail(user?.email)

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [feedbackFor, setFeedbackFor] = useState<Challenge | null>(null)
  const [speakingFor, setSpeakingFor] = useState<Challenge | null>(null)
  const [lessonFor, setLessonFor] = useState<Challenge | null>(null)
  const [taskFor, setTaskFor] = useState<Challenge | null>(null)
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
    const lock = challengeLockState(c, realNumbers, progress, cooldownSkips, challengeUnlocks)
    if (lock.locked) return setLockedFor({ challenge: c, lock })
    run()
  }

  const lockLabelFor = (c: Challenge): string | null => {
    if (isAdmin || isPlaceholderChallenge(c)) return null
    if (!levelTestDone) return '🎤 أكمل اختبار المستوى أولاً'
    const lock = challengeLockState(c, realNumbers, progress, cooldownSkips, challengeUnlocks)
    if (!lock.locked) return null
    return lock.reason === 'cooldown'
      ? `🔒 متاح بعد ${toArabicDigits(lock.daysLeft)} يوم`
      : '🔒 أكمل التحدي السابق'
  }

  const displayedChallenges = useMemo(() => mergeWithPlaceholders(challenges), [challenges])

  // Speaking is reachable from two places (the Speaking object and the "start
  // recording" button inside the task brief), so its prerequisites — notes,
  // then the lesson videos — live in one place.
  const openSpeaking = (c: Challenge) =>
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

  const firstName = (student?.name ?? '').trim().split(/\s+/)[0]

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader>
        {isAdmin && (
          <Link
            to="/admin"
            className="rounded-xl px-4 py-2 text-[14px] font-bold text-white"
            style={{ backgroundColor: UI.ink }}
          >
            Admin
          </Link>
        )}
        <Link to="/" className="text-[14px] font-bold underline" style={{ color: UI.muted }}>
          الرئيسية
        </Link>
      </SiteHeader>

      {/* Dashboard header — replaces the marketing hero for paid users. */}
      <section className="px-5 pb-12 pt-14 sm:px-8" dir="rtl">
        <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-5">
          <div>
            <h1
              className="text-[36px] font-black leading-[1.12] tracking-tight sm:text-[46px]"
              style={{ color: UI.ink }}
            >
              {firstName ? (
                <>
                  أهلاً <span style={{ color: UI.pinkInk }}>{firstName}</span> 👋
                </>
              ) : (
                'أهلاً بعودتك 👋'
              )}
            </h1>
            <p className="mt-3 text-[17px] leading-relaxed" style={{ color: UI.muted }}>
              تابع تقدّمك وواصل من حيث توقفت.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3">
            {student?.code && <DaysLeftBadge daysLeft={daysLeft} />}
            <button
              onClick={scrollToChallenges}
              className="flex items-center gap-2 rounded-[14px] px-6 py-4 text-[16px] font-bold transition hover:brightness-95"
              style={{ backgroundColor: UI.pink, color: UI.ink }}
            >
              أكمل التحدي
              <span aria-hidden="true">←</span>
            </button>
          </div>
        </div>
      </section>

      <Challenges
        challenges={displayedChallenges}
        onTask={(c) => gateChallenge(c, () => setTaskFor(c))}
        onFeedback={(c) => gateChallenge(c, () => setFeedbackFor(c))}
        onSpeak={openSpeaking}
        onLesson={(c) =>
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

      <SiteFooter />

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
      {taskFor && (
        <TaskModal
          challenge={taskFor}
          onClose={() => setTaskFor(null)}
          onStartSpeaking={() => {
            const c = taskFor
            setTaskFor(null)
            openSpeaking(c)
          }}
        />
      )}
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
