import { errorMessage, T } from '../text'
import type { SpeakError } from '../types'

interface Props {
  error: SpeakError
  onRetry: () => void
  onDismiss: () => void
}

/** One error at a time, in Arabic, with retry when the failed step can be repeated. */
export default function StatusNotice({ error, onRetry, onDismiss }: Props) {
  const warn = error.code === 'rate_limited' || error.code.startsWith('mic_') || error.code === 'empty_recording'
  return (
    <div
      role="alert"
      className={`flex flex-col gap-2 rounded-[18px] px-4 py-3 text-[13px] font-semibold leading-relaxed ${
        warn ? 'bg-[#FEEFD2] text-[#A66A09]' : 'bg-[#FFE7F1] text-[#B11D54]'
      }`}
    >
      <p>{errorMessage(error.code)}</p>
      <div className="flex items-center gap-2">
        {error.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="h-10 rounded-full bg-white/80 px-4 text-[13px] font-bold text-[#1b1730] transition hover:bg-white"
          >
            {T.retry}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="h-10 rounded-full px-3 text-[13px] font-bold text-current/80 transition hover:bg-white/50"
        >
          {T.dismiss}
        </button>
      </div>
    </div>
  )
}
