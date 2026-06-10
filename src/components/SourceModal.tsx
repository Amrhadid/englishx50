import type { Challenge } from '../types'
import { toArabicDigits } from '../lib/theme'

const PURPLE = '#534AB7'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

const STEPS = [
  'افتح المصدر',
  'شاهد الفيديو جيداً',
  'سجل كل المفردات المهمة أو الجديدة',
  'لا تشاهد الدرس قبل تجميع ملاحظات كافية',
  'اكتب ملاحظاتك وسجلها على الموقع',
]

/**
 * Shown when a student opens a challenge's "المصدر" action: the study
 * instructions, then a button that opens the source link in a new tab.
 */
export default function SourceModal({
  challenge,
  onClose,
}: {
  challenge: Challenge
  onClose: () => void
}) {
  const link = challenge.pdf_url ?? ''
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1730]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-[28px] border border-white bg-[#fdfcff] p-7 shadow-2xl"
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f2fc] text-[#8a85a0] transition hover:bg-[#ece8f8]"
        >
          <CloseIcon />
        </button>

        <p className="mb-1 text-[12px] font-bold" style={{ color: PURPLE }}>
          التحدي {toArabicDigits(challenge.number)}
        </p>
        <h2 className="mb-5 text-2xl font-black text-[#1b1730]">خطوات دراسة المصدر</h2>

        <ol className="mb-6 flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={i} className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-black text-white"
                style={{ backgroundColor: PURPLE }}
              >
                {toArabicDigits(i + 1)}
              </span>
              <span className="text-[15px] font-semibold leading-relaxed text-[#3a3550]">{step}</span>
            </li>
          ))}
        </ol>

        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
            style={{ backgroundColor: PURPLE }}
          >
            اذهب للمصدر ↗
          </a>
        ) : (
          <p className="rounded-2xl bg-[#FEEFD2] p-4 text-center text-sm font-semibold text-[#A66A09]">
            لم تتم إضافة رابط المصدر لهذا التحدي بعد.
          </p>
        )}
      </div>
    </div>
  )
}
