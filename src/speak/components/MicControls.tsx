import { formatDuration } from '../format'
import { T } from '../text'
import type { SessionPhase } from '../types'

interface Props {
  phase: SessionPhase
  canSpeak: boolean
  supported: boolean
  recordingSeconds: number
  maxSeconds: number
  canReplay: boolean
  onMic: () => void
  onCancel: () => void
  onStopAudio: () => void
  onReplay: () => void
  onKeyboard: () => void
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />
    </svg>
  )
}
function ReplayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.5-5.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 4v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function KeyboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M7 10h1M11 10h1M15 10h1M7 14h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function SpeakerOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function Spinner() {
  return (
    <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/40 border-t-white" aria-hidden="true" />
  )
}

function statusText(phase: SessionPhase, seconds: number): string {
  switch (phase) {
    case 'starting':
      return T.starting
    case 'requesting_mic':
      return T.requestingMic
    case 'recording':
      return `${T.recording} · ${formatDuration(seconds)}`
    case 'transcribing':
      return T.transcribing
    case 'thinking':
      return T.thinking
    case 'speaking':
      return T.speaking
    default:
      return T.micInstruction
  }
}

/** The push-to-talk bar: big mic in the middle, replay / keyboard around it. */
export default function MicControls(props: Props) {
  const { phase, canSpeak, supported, recordingSeconds, maxSeconds, canReplay } = props
  const recording = phase === 'recording'
  const requesting = phase === 'requesting_mic'
  const working = phase === 'transcribing' || phase === 'thinking' || phase === 'starting'
  const speaking = phase === 'speaking'
  const micDisabled = !supported || working || requesting || (!canSpeak && !recording)
  const micLabel = recording ? T.stopRecording : T.startRecording

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="min-h-[22px] text-center text-[13px] font-semibold text-[#7a7596]" aria-live="polite" role="status">
        {statusText(phase, recordingSeconds)}
      </p>

      <div className="flex w-full items-center justify-center gap-4">
        {/* Keyboard (left in RTL = end) */}
        <button
          type="button"
          onClick={props.onKeyboard}
          disabled={!canSpeak}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[#ece7fb] bg-white text-[#534AB7] transition hover:bg-[#f4f2fc] disabled:opacity-40"
          aria-label={T.keyboard}
          title={T.keyboard}
        >
          <KeyboardIcon />
        </button>

        {/* Primary control */}
        {speaking ? (
          <button
            type="button"
            onClick={props.onStopAudio}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-[#7C6FF0] text-white shadow-[0_14px_30px_-12px_rgba(124,111,240,0.8)] transition hover:brightness-95"
            aria-label={T.stopAudio}
            title={T.stopAudio}
          >
            <SpeakerOffIcon />
          </button>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={props.onMic}
              disabled={micDisabled}
              aria-pressed={recording}
              aria-label={micLabel}
              title={micLabel}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white transition disabled:opacity-60 ${
                recording
                  ? 'spk-ring bg-[#F25C8A] shadow-[0_14px_30px_-12px_rgba(242,92,138,0.8)]'
                  : 'bg-[#534AB7] shadow-[0_14px_30px_-12px_rgba(83,74,183,0.8)] hover:bg-[#46409c]'
              }`}
            >
              {working || requesting ? <Spinner /> : recording ? <StopIcon /> : <MicIcon />}
            </button>
            {recording && (
              <span
                className="spk-en absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#FFE1EC] px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-[#B11D54]"
                aria-hidden="true"
              >
                {formatDuration(recordingSeconds)} / {formatDuration(maxSeconds)}
              </span>
            )}
          </div>
        )}

        {/* Replay (right in RTL = start) */}
        <button
          type="button"
          onClick={props.onReplay}
          disabled={!canReplay || !canSpeak}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[#ece7fb] bg-white text-[#534AB7] transition hover:bg-[#f4f2fc] disabled:opacity-40"
          aria-label={T.replay}
          title={T.replay}
        >
          <ReplayIcon />
        </button>
      </div>

      {/* Fixed-height footer row so the bar never changes height between states. */}
      <div className="mt-3 flex h-11 items-center justify-center">
        {recording ? (
          <button
            type="button"
            onClick={props.onCancel}
            className="h-11 rounded-full px-4 text-[13px] font-bold text-[#7a7596] transition hover:bg-[#f4f2fc] hover:text-[#1b1730]"
          >
            {T.cancelRecording}
          </button>
        ) : (
          <div className="flex h-5 items-end gap-1" aria-hidden="true">
            {speaking &&
              [0, 1, 2, 3].map((i) => <span key={i} className="spk-bar w-1.5 rounded-full bg-[#7C6FF0]" />)}
          </div>
        )}
      </div>
    </div>
  )
}
