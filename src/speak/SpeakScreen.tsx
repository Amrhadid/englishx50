import { useCallback, useEffect, useRef, useState } from 'react'
import SpeakHeader from './components/SpeakHeader'
import PartnerCard from './components/PartnerCard'
import ScenarioChips from './components/ScenarioChips'
import DailyProgress from './components/DailyProgress'
import ConversationLog from './components/ConversationLog'
import FeedbackCard from './components/FeedbackCard'
import MicControls from './components/MicControls'
import KeyboardInput from './components/KeyboardInput'
import StatusNotice from './components/StatusNotice'
import SettingsSheet from './components/SettingsSheet'
import { useRecorder } from './hooks/useRecorder'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import { useSpeakSession } from './hooks/useSpeakSession'
import { useDailyProgress } from './hooks/useDailyProgress'
import { DEFAULT_LEVEL, DEFAULT_SCENARIO, isLevelId, isScenarioId } from './scenarios'
import { LEVEL_STORAGE_PREFIX, MAX_RECORDING_SECONDS, VOICE_STORAGE_PREFIX } from './constants'
import { T } from './text'
import type { LevelId, ScenarioId, SpeakApi } from './types'
import './speak.css'

interface Props {
  api: SpeakApi
  userId: string
  /** Called when the server says the account is no longer entitled. */
  onEntitlementLost?: () => void
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
 */
export default function SpeakScreen({ api, userId, onEntitlementLost }: Props) {
  const [scenario, setScenario] = useState<ScenarioId>(DEFAULT_SCENARIO)
  const [level, setLevel] = useState<LevelId>(() =>
    readStored(LEVEL_STORAGE_PREFIX + userId, isLevelId, DEFAULT_LEVEL),
  )
  const [voice, setVoice] = useState<boolean>(() =>
    readStored(VOICE_STORAGE_PREFIX + userId, (v): v is 'on' | 'off' => v === 'on' || v === 'off', 'on') === 'on',
  )
  const [showSettings, setShowSettings] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)

  const recorder = useRecorder({ maxSeconds: MAX_RECORDING_SECONDS })
  const endedRef = useRef<() => void>(() => {})
  const player = useAudioPlayer({ onEnded: () => endedRef.current() })
  const session = useSpeakSession({ api, recorder, player, scenario, level, voice })
  useEffect(() => {
    endedRef.current = session.onPlaybackEnded
  }, [session.onPlaybackEnded])

  const daily = useDailyProgress(userId)
  const todaySeconds = daily.baseSeconds + session.speakingSeconds

  // First session on mount (no autoplay: browsers block audio before a gesture).
  const startRef = useRef(session.start)
  useEffect(() => {
    startRef.current = session.start
  }, [session.start])
  useEffect(() => {
    startRef.current({ autoplay: false })
  }, [])

  // A 401/403 mid-session means the subscription ended: leave the screen.
  useEffect(() => {
    if (session.error && (session.error.code === 'unauthenticated' || session.error.code === 'not_premium')) {
      onEntitlementLost?.()
    }
  }, [session.error, onEntitlementLost])

  const changeScenario = useCallback(
    (id: ScenarioId) => {
      if (id === scenario || !isScenarioId(id)) return
      setScenario(id)
      setShowKeyboard(false)
      // `session.start` reads the new scenario after this render commits.
      queueMicrotask(() => startRef.current({ autoplay: true }))
    },
    [scenario],
  )

  const changeLevel = (l: LevelId) => {
    setLevel(l)
    writeStored(LEVEL_STORAGE_PREFIX + userId, l)
  }
  const changeVoice = (on: boolean) => {
    setVoice(on)
    writeStored(VOICE_STORAGE_PREFIX + userId, on ? 'on' : 'off')
    if (!on) session.stopSpeaking()
  }

  const busy = session.phase !== 'ready' && session.phase !== 'speaking' && session.phase !== 'idle'
  const speaking = session.phase === 'speaking'
  const latestFeedback = [...session.turns].reverse().find((t) => t.role === 'user' && t.feedback)?.feedback ?? null

  return (
    <div className="spk" dir="rtl">
      <SpeakHeader onSettings={() => setShowSettings(true)} />

      <main className="mx-auto max-w-5xl px-4 pb-[calc(190px+env(safe-area-inset-bottom,0px))] pt-5 sm:px-6 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] min-[900px]:gap-8 min-[900px]:pb-12">
        {/* Column 1 — partner, scenarios, controls */}
        <div className="flex flex-col gap-4">
          <section aria-labelledby="spk-title">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f2fc] px-3 py-1 text-[12px] font-extrabold text-[#534AB7]">
              <span className="h-2 w-2 rounded-full bg-[#23C4A0]" aria-hidden="true" />
              {T.statusPill}
            </span>
            <h1 id="spk-title" className="mt-3 text-[26px] font-black leading-tight text-[#1b1730] sm:text-[30px]">
              {T.heading}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#7a7596]">{T.intro}</p>
          </section>

          <DailyProgress seconds={todaySeconds} />
          <PartnerCard level={level} speaking={speaking} />
          <ScenarioChips value={scenario} onChange={changeScenario} disabled={busy || session.phase === 'recording'} />

          {!recorder.supported && (
            <p className="rounded-[18px] bg-[#FEEFD2] px-4 py-3 text-[13px] font-semibold leading-relaxed text-[#A66A09]" role="note">
              {T.unsupported}
            </p>
          )}

          {/* Desktop: the controls live here; on mobile the same element is a fixed bottom bar. */}
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
                onMic={session.toggleMic}
                onCancel={session.cancelRecording}
                onStopAudio={session.stopSpeaking}
                onReplay={session.replay}
                onKeyboard={() => setShowKeyboard((s) => !s)}
              />
            </div>
          </div>
        </div>

        {/* Column 2 — conversation + feedback */}
        <div className="mt-5 flex flex-col gap-4 min-[900px]:mt-0">
          {session.error && (
            <StatusNotice error={session.error} onRetry={session.retry} onDismiss={session.dismissError} />
          )}
          <h2 className="text-[15px] font-extrabold text-[#1b1730]">{T.conversationLabel}</h2>
          <ConversationLog turns={session.turns} phase={session.phase} inlineFeedback />
          {latestFeedback && (
            <div className="hidden min-[900px]:block">
              <h2 className="mb-2 text-[15px] font-extrabold text-[#1b1730]">{T.feedbackTitle}</h2>
              <FeedbackCard feedback={latestFeedback} />
            </div>
          )}
        </div>
      </main>

      {showSettings && (
        <SettingsSheet
          level={level}
          voice={voice}
          onLevel={changeLevel}
          onVoice={changeVoice}
          onNewChat={() => {
            setShowSettings(false)
            setShowKeyboard(false)
            session.start({ autoplay: true })
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
