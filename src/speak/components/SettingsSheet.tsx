import { useEffect, useRef } from 'react'
import { LEVELS } from '../scenarios'
import { T } from '../text'
import type { LevelId } from '../types'

interface Props {
  level: LevelId
  voice: boolean
  onLevel: (l: LevelId) => void
  onVoice: (on: boolean) => void
  onClose: () => void
}

/** Bottom sheet (dialog) with the session settings. */
export default function SettingsSheet({ level, voice, onLevel, onVoice, onClose }: Props) {
  const firstRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center min-[900px]:items-center" dir="rtl">
      <button type="button" className="absolute inset-0 bg-[#1b1730]/40" aria-label={T.close} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="spk-settings-title"
        className="spk-safe-bottom relative w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl min-[900px]:rounded-[28px]"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#ece7fb] min-[900px]:hidden" aria-hidden="true" />
        <h2 id="spk-settings-title" className="text-[18px] font-black text-[#1b1730]">
          {T.settings}
        </h2>

        <p className="mt-4 text-[13px] font-bold text-[#7a7596]" id="spk-level-label">
          {T.settingsLevel}
        </p>
        <div role="radiogroup" aria-labelledby="spk-level-label" className="mt-2 grid grid-cols-3 gap-2">
          {LEVELS.map((l, i) => {
            const selected = l.id === level
            return (
              <button
                key={l.id}
                ref={i === 0 ? firstRef : undefined}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onLevel(l.id)}
                className={`flex min-h-[64px] flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center transition ${
                  selected ? 'border-[#534AB7] bg-[#534AB7] text-white' : 'border-[#ece7fb] bg-white text-[#1b1730] hover:bg-[#f4f2fc]'
                }`}
              >
                <span className="text-[14px] font-extrabold">{l.label}</span>
                <span className={`mt-0.5 text-[11px] ${selected ? 'text-white/80' : 'text-[#7a7596]'}`}>{l.hint}</span>
              </button>
            )
          })}
        </div>

        <label className="mt-5 flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[#f4f2fc] px-4 py-2">
          <span className="text-[14px] font-bold text-[#1b1730]">{T.settingsVoice}</span>
          <input
            type="checkbox"
            role="switch"
            aria-checked={voice}
            checked={voice}
            onChange={(e) => onVoice(e.target.checked)}
            className="h-5 w-5"
            style={{ accentColor: '#534AB7' }}
          />
        </label>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl bg-[#534AB7] text-[14px] font-bold text-white transition hover:bg-[#46409c]"
          >
            {T.close}
          </button>
        </div>
      </div>
    </div>
  )
}
