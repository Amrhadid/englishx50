import { DAILY_GOAL_SECONDS } from '../constants'
import { formatDuration } from '../format'
import { T } from '../text'

export default function DailyProgress({ seconds, goalSeconds = DAILY_GOAL_SECONDS }: { seconds: number; goalSeconds?: number }) {
  const pct = Math.min(100, Math.round((seconds / goalSeconds) * 100))
  return (
    <section className="rounded-[24px] border border-[#ece7fb] bg-white p-4" aria-label={T.dailyGoal}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-bold text-[#1b1730]">{T.dailyGoal}</p>
        <p className="spk-en text-[14px] font-extrabold tabular-nums text-[#534AB7]" aria-live="polite">
          {formatDuration(seconds)} / {formatDuration(goalSeconds)}
        </p>
      </div>
      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#f4f2fc]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goalSeconds}
        aria-valuenow={Math.min(goalSeconds, Math.round(seconds))}
        aria-label={T.dailyGoal}
      >
        <div
          className="spk-progress h-full rounded-full"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #534AB7 0%, #7C6FF0 100%)' }}
        />
      </div>
    </section>
  )
}
