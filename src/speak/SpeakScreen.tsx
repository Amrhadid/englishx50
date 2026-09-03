import { useCallback, useEffect, useRef, useState } from 'react'
import SpeakHeader from './components/SpeakHeader'
import PartnerCard from './components/PartnerCard'
import ScenarioChips from './components/ScenarioChips'
import DailyProgress from './components/DailyProgress'
import ConversationLog from './components/ConversationLog'
import ConversationReview from './components/ConversationReview'
import LockedNotice from './components/LockedNotice'
import HistoryList from './components/HistoryList'
import MicControls from './components/MicControls'
import KeyboardInput from './components/KeyboardInput'
import StatusNotice from './components/StatusNotice'
import SettingsSheet from './components/SettingsSheet'
import { useRecorder } from './hooks/useRecorder'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import { useSpeakSession } from './hooks/useSpeakSession'
import { DEFAULT_LEVEL, DEFAULT_SCENARIO, isLevelId } from './scenarios'
import { LEVEL_STORAGE_PREFIX, MAX_RECORDING_SECONDS, VOICE_STORAGE_PREFIX } from './constants'
import { downloadBytes, feedbackFileName, renderFeedbackPdf } from './feedbackPdf'
import { T } from './text'
import type { Conversation, LevelId, ScenarioId, SpeakApi } from './types'
import './speak.css'

interface Props {
  api: SpeakApi
  userId: string
  /** Called when the server says the account is no longer entitled. */
  onEntitlementLost?: () => void
  /** Test seam for the PDF generator (defaults to the canvas renderer). */
  makePdf?: (c: Conversation) => Promise<Uint8Array>
  download?: (bytes: Uint8Array, fileName: string) => void
}

function readStored<Tv>(key: string, guard: (v: unknown) => v is Tv, fallback: Tv): Tv {
  try {
    const raw = localStorage.getItem(key)
    return guard(raw) ? raw : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

/**
 * The speaking interface. Mounted only once the page has confirmed the
 * account is entitled; the server re-checks on every call.
 *
 * Lifecycle: load the learner's conversation → pick a scenario and start (or
 * resume) → push-to-talk until the 5-minute speaking goal → review + PDF →
 * locked until the next day.
 */
export default function SpeakScreen({
  api,
  userId,
  onEntitlementLost,
  makePdf = renderFeedbackPdf,
  download = downloadBytes,
}: Props) {
  const [scenario, setScenario] = useState<ScenarioId>(DEFAULT_SCENARIO)
  const [level, setLevel] = useState<LevelId>(() => readStored(LEVEL_STORAGE_PREFIX + userId, isLevelId, DEFAULT_LEVEL))
  const [voice, setVoice] = useState<boolean>(
    () => readStored(VOICE_STORAGE_PREFIX + userId, (v): v is 'on' | 'off' => v === 'on' || v === 'off', 'on') === 'on',
  )
  const [showSettings, setShowSettings] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)
  // A past conversation opened from the history list.
  const [viewing, setViewing] = useState<Conversation | null>(null)
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null)

  const recorder = useRecorder({ maxSeconds: MAX_RECORDING_SECONDS })
  const endedRef = useRef<() => void>(() => {})
  const player = useAudioPlayer({ onEnded: () => endedRef.current() })
  const session = useSpeakSession({ api, recorder, player, level, voice })
  useEffect(() => {
    endedRef.current = session.onPlaybackEnded
  }, [session.onPlaybackEnded])

  // Load the learner's current conversation once.
  const loadRef = useRef(session.load)
  useEffect(() => {
    loadRef.current = session.load
  }, [session.load])
  useEffect(() => {
    loadRef.current()
  }, [])

  // The active conversation's scenario is the one that counts.
  const activeScenario = session.conversation?.scenario ?? scenario
  const conversationOpen =
    session.phase !== 'idle' && session.phase !== 'loading' && session.phase !== 'locked' && session.phase !== 'completed'

  // A 401/403 mid-session means the subscription ended: leave the screen.
  useEffect(() => {
    if (session.error && (session.error.code === 'unauthenticated' || session.error.code === 'not_premium')) {
      onEntitlementLost?.()
    }
  }, [session.error, onEntitlementLost])

  const changeLevel = (l: LevelId) => {
    setLevel(l)
    writeStored(LEVEL_STORAGE_PREFIX + userId, l)
  }
  const changeVoice = (on: boolean) => {
    setVoice(on)
    writeStored(VOICE_STORAGE_PREFIX + userId, on ? 'on' : 'off')
    if (!on) session.stopSpeaking()
  }

  const openHistory = useCallback(
    async (c: Conversation) => {
      setLoadingHistoryId(c.id)
      const res = await api.conversation({ conversationId: c.id })
      setLoadingHistoryId(null)
      if (res.ok) {
        setViewing(res.conversation)
        window.scrollTo({ top: 0 })
      }
    },
    [api],
  )

  const busy = session.phase === 'starting' || session.phase === 'transcribing' || session.phase === 'thinking' || session.phase === 'loading'
  const speaking = session.phase === 'speaking'
  const goalDone = session.speakingSeconds >= session.goalSeconds && session.goalSeconds > 0
  const reviewing = session.phase === 'completed' || session.phase === 'locked'

  const rightColumn = viewing ? (
    <ConversationReview
      conversation={viewing}
      title={T.reviewTitle}
      intro={T.reviewIntro}
      makePdf={makePdf}
      download={download}
      fileName={feedbackFileName}
      onBack={() => setViewing(null)}
    />
  ) : reviewing ? (
    <>
      {session.phase === 'locked' && <LockedNotice nextAvailableAt={session.nextAvailableAt} />}
      {session.conversation && (
        <ConversationReview
          conversation={session.conversation}
          title={session.phase === 'completed' ? T.completedTitle : T.reviewTitle}
          intro={session.phase === 'completed' ? T.completedBody : T.reviewIntro}
          makePdf={makePdf}
          download={download}
          fileName={feedbackFileName}
        />
      )}
    </>
  ) : (
    <>
      {session.resumed && conversationOpen && (
        <p className="rounded-[18px] bg-[#f4f2fc] px-4 py-2.5 text-[13px] font-bold text-[#534AB7]" role="status">
          {T.resumeHint}
        </p>
      )}
      <h2 className="text-[15px] font-extrabold text-[#1b1730]">{T.conversationLabel}</h2>
      <ConversationLog turns={session.turns} phase={session.phase} />
    </>
  )

  return (
    <div className="spk" dir="rtl">
      <SpeakHeader onSettings={() => setShowSettings(true)} />

      <main className="mx-auto max-w-5xl px-4 pb-[calc(190px+env(safe-area-inset-bottom,0px))] pt-5 sm:px-6 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] min-[900px]:gap-8 min-[900px]:pb-12">
        {/* Column 1 — partner, scenarios, controls */}
        <div className="flex flex-col gap-4">
          <section aria-labelledby="spk-title">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f2fc] px-3 py-1 text-[12px] font-extrabold text-[#534AB7]">
              <span className="h-2 w-2 rounded-full bg-[#23C4A0]" aria-hidden="true" />
              {goalDone ? T.goalDone : T.statusPill}
            </span>
            <h1 id="spk-title" className="mt-3 text-[26px] font-black leading-tight text-[#1b1730] sm:text-[30px]">
              {T.heading}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#7a7596]">{T.intro}</p>
          </section>

          <DailyProgress seconds={session.speakingSeconds} goalSeconds={session.goalSeconds} />
          <PartnerCard level={level} speaking={speaking} />
          <ScenarioChips
            value={activeScenario}
            onChange={setScenario}
            // Locked to the conversation's scenario once one exists.
            disabled={session.phase !== 'idle'}
          />

          {!recorder.supported && (
            <p className="rounded-[18px] bg-[#FEEFD2] px-4 py-3 text-[13px] font-semibold leading-relaxed text-[#A66A09]" role="note">
              {T.unsupported}
            </p>
          )}

          {/* Desktop: the controls live here; on mobile the same element is a fixed bottom bar. */}
          {!reviewing && !viewing && (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece7fb] bg-white/95 backdrop-blur min-[900px]:static min-[900px]:mt-2 min-[900px]:rounded-[28px] min-[900px]:border min-[900px]:bg-white min-[900px]:shadow-[0_10px_30px_-22px_rgba(83,74,183,0.5)]">
              <div className="spk-safe-bottom mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 min-[900px]:px-6 min-[900px]:py-6">
                {showKeyboard && session.canSpeak && (
                  <KeyboardInput
                    disabled={!session.canSpeak}
                    onSend={(t) => {
                      setShowKeyboard(false)
                      session.sendText(t)
                    }}
                    onClose={() => setShowKeyboard(false)}
                  />
                )}
                <MicControls
                  phase={session.phase}
                  canSpeak={session.canSpeak}
                  supported={recorder.supported}
                  recordingSeconds={session.recordingSeconds}
                  maxSeconds={MAX_RECORDING_SECONDS}
                  canReplay={player.canReplay}
                  onStart={() => session.start(scenario)}
                  onMic={session.toggleMic}
                  onCancel={session.cancelRecording}
                  onStopAudio={session.stopSpeaking}
                  onReplay={session.replay}
                  onKeyboard={() => setShowKeyboard((s) => !s)}
                />
              </div>
            </div>
          )}

          {/* History (desktop: under the controls; mobile: after the conversation) */}
          <div className="hidden min-[900px]:block">
            <HistoryList history={session.history} onOpen={openHistory} loadingId={loadingHistoryId} />
          </div>
        </div>

        {/* Column 2 — conversation, or the review */}
        <div className="mt-5 flex flex-col gap-4 min-[900px]:mt-0">
          {session.error && <StatusNotice error={session.error} onRetry={session.retry} onDismiss={session.dismissError} />}
          {rightColumn}
          <div className="min-[900px]:hidden">
            <HistoryList history={session.history} onOpen={openHistory} loadingId={loadingHistoryId} />
          </div>
        </div>
      </main>

      {showSettings && (
        <SettingsSheet
          level={level}
          voice={voice}
          onLevel={changeLevel}
          onVoice={changeVoice}
          onClose={() => setShowSettings(false)}
        />
      )}
      <span className="sr-only" aria-live="polite">
        {busy ? '' : goalDone ? T.goalDone : ''}
      </span>
    </div>
  )
}
