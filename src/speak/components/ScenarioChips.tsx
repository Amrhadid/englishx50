import { SCENARIOS } from '../scenarios'
import { T } from '../text'
import type { ScenarioId } from '../types'

interface Props {
  value: ScenarioId
  onChange: (id: ScenarioId) => void
  disabled?: boolean
}

/** Horizontally scrollable, keyboard-navigable scenario picker (radiogroup). */
export default function ScenarioChips({ value, onChange, disabled }: Props) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = SCENARIOS.findIndex((s) => s.id === value)
    let next: number
    // RTL row: ArrowLeft moves forward visually.
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = (idx + 1) % SCENARIOS.length
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = (idx - 1 + SCENARIOS.length) % SCENARIOS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = SCENARIOS.length - 1
    else return
    e.preventDefault()
    if (!disabled) {
      onChange(SCENARIOS[next].id)
      const el = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]
      el?.focus()
    }
  }

  return (
    <div>
      <p className="mb-2 text-[13px] font-bold text-[#7a7596]" id="spk-scenarios-label">
        {T.scenariosLabel}
      </p>
      <div
        role="radiogroup"
        aria-labelledby="spk-scenarios-label"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 min-[900px]:flex-wrap"
        onKeyDown={onKeyDown}
      >
        {SCENARIOS.map((s) => {
          const selected = s.id === value
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(s.id)}
              className={`flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[14px] font-bold transition disabled:opacity-60 ${
                selected
                  ? 'border-[#534AB7] bg-[#534AB7] text-white'
                  : 'border-[#ece7fb] bg-white text-[#1b1730] hover:border-[#7C6FF0] hover:bg-[#f4f2fc]'
              }`}
            >
              <span aria-hidden="true">{s.emoji}</span>
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
