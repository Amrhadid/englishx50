import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLACEHOLDER_REVIEWS, mergeWithPlaceholders, isPlaceholderChallenge } from '../lib/placeholders'
import { challengeVideos } from '../lib/challenge'
import { challengeLockState, allVideosWatched, type LockState } from '../lib/completion'
import { levelTestTaskId, getAttempt, fetchServerTrials } from '../lib/progress'
import { loadUserNotes, countNotes, REQUIRED_NOTES } from '../lib/notes'
import ChallengeLockedModal from '../components/ChallengeLockedModal'
import LevelTestRequiredModal from '../components/LevelTestRequiredModal'
import SourceModal from '../components/SourceModal'
import NotesModal from '../components/NotesModal'
import NoticeModal from '../components/NoticeModal'
import type { Challenge, Review } from '../types'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import IntroVideo from '../components/IntroVideo'
import Challenges from '../components/Challenges'
import Countdown from '../components/Countdown'
import PremiumModal from '../components/PremiumModal'
import ComingSoonModal from '../components/ComingSoonModal'
import FeedbackModal from '../components/FeedbackModal'
import SpeakingModal from '../components/SpeakingModal'
import LessonModal from '../components/LessonModal'
import Reviews from '../components/Reviews'
import { OnboardingProvider } from '../context/OnboardingContext'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'
import { toArabicDigits } from '../lib/theme'

export default function Landing() {
  return (
    <OnboardingProvider>
      <LandingInner />
    </OnboardingProvider>
  )
}

function LandingInner() {
  const { premiumActive, progress } = useOnboardingContext()
  const { user } = useAuth()
  const isAdmin = isAdminEmail(user?.email)

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [showPremium, setShowPremium] = useState(false)
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
  const notesDone = (c: Challenge): boolean =>
    isAdmin || countNotes(notesByChallenge[c.id] ?? []) >= REQUIRED_NOTES

  // The level test is the mandatory first step: challenges stay locked until
  // the account has a graded attempt. Local saved attempt is checked first;
  // the server-side trial counter (x50_trials) covers other devices / cleared
  // caches — any consumed attempt counts so users who used their trials
  // without passing aren't locked out forever.
  const [levelTestDone, setLevelTestDone] = useState(false)
  useEffect(() => {
    let active = true
    const check = async () => {
      const saved = getAttempt(levelTestTaskId(user?.id))
      if (saved && (saved.outcome === 'passed' || saved.outcome === 'failed')) return true
      if (!user) return false
      const used = await fetchServerTrials('level_test', user.id)
      return used != null && used > 0
    }
    check().then((done) => {
      if (active && done) setLevelTestDone(true)
    })
    return () => {
      active = false
    }
  }, [user])

  // Real (added) challenge numbers in order — used for the sequential cooldown.
  const realNumbers = useMemo(
    () => challenges.map((c) => c.number).sort((a, b) => a - b),
    [challenges],
  )

  // Premium is DB-driven and tied to the signed-in account (redeemed code within
  // its 100-day window).
  const premium = premiumActive

  useEffect(() => {
    let active = true

    if (!supabase) return

    supabase
      .from('x50_challenges')
      .select('*')
      .order('number', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        // On error (e.g. RLS/permissions), fall back silently to the
        // placeholder challenges instead of surfacing an error in the UI.
        if (!error) setChallenges((data as Challenge[]) ?? [])
      })

    supabase
      .from('x50_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (!error) setReviews((data as Review[]) ?? [])
      })

    return () => {
      active = false
    }
  }, [])

  // Gate for locked actions (clicking a challenge or the level test). Opens
  // the premium popup, which handles Google sign-in + account-bound code
  // activation. Only ever opens on an explicit click.
  const requireAccess = () => setShowPremium(true)

  // "ابدأ التحدي" CTAs: premium accounts go straight to the challenges
  // (the level test sits at the top); everyone else gets the upgrade popup.
  const start = () => {
    if (premium || isAdmin) {
      document.getElementById('challenges')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    requireAccess()
  }

  // Single gate for every challenge action:
  //  - free user            → upgrade / onboarding popup
  //  - premium, not-yet-added challenge → "Next Week" coming-soon popup
  //  - premium, real challenge          → run the action (watch/source/speak/…)
  const gateChallenge = (c: Challenge, run: () => void) => {
    // Admin previews everything: no premium gate, no cooldown.
    if (isAdmin) {
      if (isPlaceholderChallenge(c)) return setComingSoonFor(c)
      return run()
    }
    if (!premium) return requireAccess()
    // Level test first — it's the mandatory entry point of the program.
    if (!levelTestDone) return setShowLevelTestRequired(true)
    if (isPlaceholderChallenge(c)) return setComingSoonFor(c)
    // Sequential 5-day cooldown: must finish the previous challenge + wait.
    const lock = challengeLockState(c, realNumbers, progress)
    if (lock.locked) return setLockedFor({ challenge: c, lock })
    run()
  }

  // Label shown on a locked challenge card (premium, non-admin users only).
  const lockLabelFor = (c: Challenge): string | null => {
    if (isAdmin || !premium || isPlaceholderChallenge(c)) return null
    if (!levelTestDone) return '🎤 أكمل اختبار المستوى أولاً'
    const lock = challengeLockState(c, realNumbers, progress)
    if (!lock.locked) return null
    return lock.reason === 'cooldown'
      ? `🔒 متاح بعد ${toArabicDigits(lock.daysLeft)} يوم`
      : '🔒 أكمل التحدي السابق'
  }

  // Always render the full set of slots: real challenges by number, locked
  // placeholders for the rest. Adding one real challenge no longer hides the
  // others.
  const displayedChallenges = useMemo(() => mergeWithPlaceholders(challenges), [challenges])

  // Show real uploaded reviews when present, otherwise placeholder frames so
  // the carousel design is visible before any screenshots are added.
  const displayedReviews = useMemo(
    () => (reviews.length > 0 ? reviews : PLACEHOLDER_REVIEWS),
    [reviews],
  )

  return (
      <div className="min-h-screen bg-white">
        <Navbar onStart={start} />
      <Hero onStart={start} />

      {/* Intro video */}
      <IntroVideo />

      <Challenges
        challenges={displayedChallenges}
        onSelect={() => requireAccess()}
        onFeedback={(c) => gateChallenge(c, () => setFeedbackFor(c))}
        onSpeak={(c) =>
          gateChallenge(c, () => {
            // Speaking needs the notes done AND every lesson video watched.
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
            // Notes gate: collect 10+ vocabulary before the session video opens.
            if (!notesDone(c)) return setNotesFor(c)
            setLessonFor(c)
          })
        }
        onSource={(c) => gateChallenge(c, () => setSourceFor(c))}
        onFile={(c) =>
          gateChallenge(c, () => {
            if (!c.file_url) return setComingSoonFor(c)
            // PDF is locked behind the notes gate too.
            if (!notesDone(c)) return setNotesFor(c)
            window.open(c.file_url, '_blank', 'noopener')
          })
        }
        onUpgrade={() => requireAccess()}
        onLevelTestComplete={() => setLevelTestDone(true)}
        lockLabelFor={lockLabelFor}
      />
      <Countdown onStart={start} />
      <Reviews reviews={displayedReviews} />

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

      {showPremium && <PremiumModal onClose={() => setShowPremium(false)} />}
      {showLevelTestRequired && (
        <LevelTestRequiredModal
          onClose={() => setShowLevelTestRequired(false)}
          onStart={() => {
            setShowLevelTestRequired(false)
            // Defer so the modal is unmounted before scrolling.
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
      {feedbackFor && (
        <FeedbackModal challenge={feedbackFor} onClose={() => setFeedbackFor(null)} />
      )}
      {speakingFor && (
        <SpeakingModal challenge={speakingFor} onClose={() => setSpeakingFor(null)} />
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
            // Continue straight into the lesson once the gate is cleared.
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
