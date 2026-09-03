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
  const latestEmmaPrompt = [...session.turns].reverse().find((t) => t.role === 'ai')?.text
  const transcriptTurns = session.turns.length > 0 && session.turns.at(-1)?.role === 'ai' ? session.turns.slice(0, -1) : session.turns
  const latestFeedback = [...session.turns].reverse().find((t) => t.role === 'user' && t.feedback)?.feedback ?? null

  return (
    <div className="spk" dir="rtl">
      <SpeakHeader onSettings={() => setShowSettings(true)} />

      <main className="spk-layout">
        {/* Column 1 — partner, scenarios, controls */}
        <div className="spk-primary-column">
          <h1 id="spk-title" className="sr-only">{T.heading}</h1>
          <PartnerCard
            level={level}
            scenario={scenario}
            phase={session.phase}
            prompt={latestEmmaPrompt}
            onReplay={session.replay}
            canReplay={player.canReplay}
          />
          <ScenarioChips value={scenario} onChange={changeScenario} disabled={busy || session.phase === 'recording'} />
          <DailyProgress seconds={todaySeconds} />

          {!recorder.supported && (
            <p className="rounded-[18px] bg-[#FEEFD2] px-4 py-3 text-[13px] font-semibold leading-relaxed text-[#A66A09]" role="note">
              {T.unsupported}
            </p>
          )}

          {/* Desktop: the controls live here; on mobile the same element is a fixed bottom bar. */}
          <div className="spk-controls-dock">
            <div className="spk-safe-bottom spk-controls-inner">
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
        <aside className="spk-secondary-column">
          {session.error && (
            <StatusNotice error={session.error} onRetry={session.retry} onDismiss={session.dismissError} />
          )}
          <div className="spk-section-title"><div><span>سجل الجلسة</span><h2>{T.conversationLabel}</h2></div><span className="spk-turn-count">{session.turns.length} رسائل</span></div>
          <ConversationLog turns={transcriptTurns} phase={session.phase} inlineFeedback />
          {latestFeedback && (
            <div className="hidden min-[900px]:block">
              <h2 className="mb-2 text-[15px] font-extrabold text-[#1b1730]">{T.feedbackTitle}</h2>
              <FeedbackCard feedback={latestFeedback} />
            </div>
          )}
        </aside>
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
