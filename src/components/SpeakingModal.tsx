import SpeakingTask from './SpeakingTask'
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

export default function SpeakingModal({ challenge, onClose }: SpeakingModalProps) {
  let student: string | undefined
  try {
    student = localStorage.getItem('x50_user') ?? undefined
  } catch {
    student = undefined
  }

  const question = challenge.speaking_task || `تحدّث بالإنجليزية عن: ${challenge.title}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1b1730]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative my-6 w-full max-w-2xl rounded-[28px] border border-white bg-[#fdfcff] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f2fc] text-[#8a85a0] transition hover:bg-[#ece8f8]"
        >
          <CloseIcon />
        </button>

        <SpeakingTask
          question={question}
          challengeNumber={challenge.number}
          challengeId={challenge.id}
          student={student}
        />
      </div>
    </div>
  )
}
