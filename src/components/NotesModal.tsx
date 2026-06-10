import { useState } from 'react'
import type { Challenge } from '../types'
import { toArabicDigits } from '../lib/theme'
import {
  REQUIRED_NOTES,
  MAX_NOTES,
  sanitizeEnglish,
  countNotes,
  saveNotes,
} from '../lib/notes'

const PURPLE = '#534AB7'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/** Pad a list of entries to at least `min` empty boxes. */
function padEntries(entries: string[], min: number): string[] {
  const out = entries.slice()
  while (out.length < min) out.push('')
  return out
}

/**
 * "Write down your notes": the student records at least REQUIRED_NOTES
 * vocabulary words from the source video. Submitting unlocks the session
 * video / PDF (and the speaking task once the videos are watched).
 */
export default function NotesModal({
  challenge,
  userId,
  student,
  initialEntries,
  onClose,
  onSaved,
}: {
  challenge: Challenge
  userId: string
  student: string | null
  initialEntries: string[]
  onClose: () => void
  onSaved: (entries: string[]) => void
}) {
  const [entries, setEntries] = useState<string[]>(() =>
    padEntries(initialEntries.filter(Boolean), REQUIRED_NOTES),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filled = countNotes(entries)
  const canSubmit = filled >= REQUIRED_NOTES

  const setAt = (i: number, value: string) => {
    const next = entries.slice()
    next[i] = sanitizeEnglish(value)
    setEntries(next)
  }
  const addBox = () => {
    if (entries.length >= MAX_NOTES) return
    setEntries([...entries, ''])
  }
  const removeAt = (i: number) => {
    if (entries.length <= REQUIRED_NOTES) return
    setEntries(entries.filter((_, j) => j !== i))
  }

  const submit = async () => {
    if (!canSubmit || busy) return
    setBusy(true)
    setError(null)
    const clean = entries.map((e) => e.trim()).filter(Boolean)
    const ok = await saveNotes({
      userId,
      student,
      challengeId: challenge.id,
      challengeNumber: challenge.number,
      entries: clean,
    })
    setBusy(false)
    if (!ok) {
      setError('تعذّر حفظ الملاحظات، حاول مرة أخرى')
      return
    }
    onSaved(clean)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1b1730]/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative my-6 w-full max-w-lg rounded-[28px] border border-white bg-[#fdfcff] shadow-2xl"
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f2fc] text-[#8a85a0] transition hover:bg-[#ece8f8]"
        >
          <CloseIcon />
        </button>

        <div className="px-5 py-7 sm:px-7">
          <p className="mb-1 text-[12px] font-bold" style={{ color: PURPLE }}>
            التحدي {toArabicDigits(challenge.number)}
          </p>
          <h2 className="text-2xl font-black text-[#1b1730]">Write down your notes</h2>
          <p className="mt-1 text-[14px] font-semibold leading-relaxed text-[#7a7596]">
            اكتب ١٠ كلمات على الأقل تعلمتها من المصدر — باللغة الإنجليزية.
          </p>

          {/* Progress counter */}
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEEDFE]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (filled / REQUIRED_NOTES) * 100)}%`,
                  backgroundColor: canSubmit ? '#23C4A0' : PURPLE,
                }}
              />
            </div>
            <span
              className="shrink-0 text-[13px] font-extrabold tabular-nums"
              style={{ color: canSubmit ? '#0C7C62' : PURPLE }}
            >
              {toArabicDigits(filled)} / {toArabicDigits(REQUIRED_NOTES)}
            </span>
          </div>

          {/* Entry boxes */}
          <div className="mt-4 flex max-h-[42vh] flex-col gap-2 overflow-y-auto pl-1">
            {entries.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-[12px] font-bold text-[#a39ec0]">
                  {toArabicDigits(i + 1)}
                </span>
                <input
                  value={v}
                  onChange={(e) => setAt(i, e.target.value)}
                  dir="ltr"
                  inputMode="text"
                  placeholder="English word / phrase"
                  className="min-w-0 flex-1 rounded-xl border border-[#e8e0f0] px-3 py-2 text-left text-sm outline-none focus:border-[#534AB7]"
                />
                {entries.length > REQUIRED_NOTES && (
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label="حذف"
                    className="shrink-0 rounded-lg bg-[#FEE2E2] px-2.5 py-2 text-sm font-bold text-[#DC2626]"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addBox}
            disabled={entries.length >= MAX_NOTES}
            className="mt-3 rounded-lg bg-[#EEEDFE] px-3 py-1.5 text-xs font-bold text-[#534AB7] disabled:opacity-50"
          >
            + إضافة كلمة ({toArabicDigits(entries.length)}/{toArabicDigits(MAX_NOTES)})
          </button>

          {error && <p className="mt-3 text-center text-[13px] font-semibold text-[#C2410C]">{error}</p>}

          <button
            onClick={submit}
            disabled={!canSubmit || busy}
            className="mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition enabled:hover:-translate-y-0.5 disabled:opacity-50"
            style={{ backgroundColor: canSubmit ? PURPLE : '#b9b4d6' }}
          >
            {busy
              ? 'جارٍ الحفظ…'
              : canSubmit
                ? 'حفظ وفتح الدرس'
                : `أضف ${toArabicDigits(REQUIRED_NOTES - filled)} كلمة لإكمال`}
          </button>
        </div>
      </div>
    </div>
  )
}
