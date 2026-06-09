import { useState } from 'react'
import SpeakingTask from './SpeakingTask'
import { challengeSpeakingTasks } from '../lib/challenge'
import { toArabicDigits } from '../lib/theme'
import type { Challenge } from '../types'

interface SpeakingModalProps {
  challenge: Challenge
  onClose: () => void
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SpeakingModal({ challenge, onClose }: SpeakingModalProps) {
  let student: string | undefined
  try {
    student = localStorage.getItem('x50_user') ?? undefined
  } catch {
    student = undefined
  }

  const tasks = challengeSpeakingTasks(challenge)
  const prompts = tasks.length > 0 ? tasks : [`تحدّث بالإنجليزية عن: ${challenge.title}`]
  // Single task → go straight in; multiple → show a picker first.
  const [selected, setSelected] = useState<number | null>(prompts.length === 1 ? 0 : null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1b1730]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative my-6 w-full max-w-2xl rounded-[28px] border border-white bg-[#fdfcff] shadow-2xl"
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
        {selected !== null && prompts.length > 1 && (
          <button
            onClick={() => setSelected(null)}
            aria-label="رجوع"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f2fc] text-[#8a85a0] transition hover:bg-[#ece8f8]"
          >
            <BackIcon />
          </button>
        )}

        {selected === null ? (
          <div className="px-6 py-10" dir="rtl">
            <span
              className="mb-3 inline-block rounded-full bg-[#EEEDFE] px-3 py-1 text-[12px] font-extrabold text-[#534AB7]"
            >
              التحدي {toArabicDigits(challenge.number)}
            </span>
            <h2 className="mb-1 text-xl font-extrabold text-[#1b1730]">مهام التحدّث</h2>
            <p className="mb-5 text-[13px] text-[#7a7596]">اختر المهمة التي تريد التدرّب عليها</p>
            <div className="space-y-2.5">
              {prompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#ece7fb] bg-white p-4 text-right transition hover:border-[#c4b8ff] hover:bg-[#faf9ff]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEEDFE] text-[13px] font-extrabold text-[#534AB7]">
                    {toArabicDigits(i + 1)}
                  </span>
                  <span className="text-[14px] font-semibold text-[#1b1730]">{p}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <SpeakingTask
            question={prompts[selected]}
            challengeNumber={challenge.number}
            challengeId={challenge.id}
            student={student}
            taskIndex={selected}
          />
        )}
      </div>
    </div>
  )
}
