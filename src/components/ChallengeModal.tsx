import { useState } from 'react'
import type { Challenge } from '../types'
import { BRAND_GRADIENT, toArabicDigits } from '../lib/theme'

interface ChallengeModalProps {
  challenge: Challenge
  onClose: () => void
}

const WHATSAPP_NUMBER = '201097965058'

function KeyIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 block h-7 w-7" style={{ color }} aria-hidden="true">
      <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M11 11l8 8m-3 0 2-2m-4-2 2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function UserPlusIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 block h-7 w-7" style={{ color }} aria-hidden="true">
      <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3 20a6 6 0 0 1 12 0M18 8v6M15 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.6 4.7-1.2A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.7 1 .9 1.8 1.1 2.1 1.3.2.1.4.1.6-.1l.7-.8c.2-.2.3-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

type YesNo = 'yes' | 'no' | null

function YesNoSelector({
  label,
  value,
  onChange,
}: {
  label: string
  value: YesNo
  onChange: (v: 'yes' | 'no') => void
}) {
  const opt = (active: boolean) =>
    active
      ? 'flex-1 cursor-pointer rounded-2xl border-2 border-[#7C6FF0] bg-[#f1edff] p-2.5 text-center text-[13px] font-bold text-[#7C6FF0]'
      : 'flex-1 cursor-pointer rounded-2xl border border-[#ece7fb] p-2.5 text-center text-[13px] font-semibold text-[#9a95ad] hover:border-[#cfc6f5]'
  return (
    <div className="mb-3.5">
      <p className="mb-2 text-[13px] font-bold text-[#1b1730]">{label}</p>
      <div className="flex gap-2.5">
        <button type="button" className={opt(value === 'yes')} onClick={() => onChange('yes')}>
          نعم
        </button>
        <button type="button" className={opt(value === 'no')} onClick={() => onChange('no')}>
          لا
        </button>
      </div>
    </div>
  )
}

export default function ChallengeModal({ challenge, onClose }: ChallengeModalProps) {
  const [page, setPage] = useState<'code' | 'join'>('code')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [job, setJob] = useState('')
  const [university, setUniversity] = useState<YesNo>('yes')
  const [youtube, setYoutube] = useState<YesNo>(null)

  const input =
    'mb-3 w-full rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-[13px] text-right outline-none transition focus:border-[#7C6FF0] focus:bg-white'

  const whatsappUrl = () => {
    const lines = [
      `انا اسمي ${name}`,
      `وظيفتي ${job}`,
      university === 'yes' ? 'التحقت بالجامعة' : 'لم التحق بالجامعة',
      youtube === 'yes' ? 'مشترك في قناة اليوتيوب' : 'غير مشترك في قناة اليوتيوب',
      'وشاهدت الفيديو وراجعت النظام جيداً وحابب اشترك في تحدي ٥٠ يوم',
    ]
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1730]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-[420px] overflow-y-auto rounded-[28px] border border-white bg-white p-6 shadow-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f2fc] text-[#8a85a0] transition hover:bg-[#ece8f8]"
        >
          <CloseIcon />
        </button>

        {page === 'code' ? (
          <>
            <span
              className="mb-2 inline-block rounded-full px-3 py-1 text-[11px] font-extrabold text-white"
              style={{ background: BRAND_GRADIENT }}
            >
              التحدي {toArabicDigits(challenge.number)}
            </span>
            <p className="mb-5 text-lg font-extrabold text-[#1b1730]">للوصول لهذا التحدي</p>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPage('code')}
                className="rounded-2xl border-2 border-[#7C6FF0] bg-[#f1edff] p-4 text-center"
              >
                <KeyIcon color="#7C6FF0" />
                <p className="text-[13px] font-bold text-[#7C6FF0]">أدخل الكود</p>
                <p className="mt-1 text-[11px] text-[#a39ec0]">عندك كود اشتراك؟</p>
              </button>
              <button
                type="button"
                onClick={() => setPage('join')}
                className="rounded-2xl border border-[#ece7fb] p-4 text-center transition hover:border-[#23C4A0] hover:bg-[#f2fcf9]"
              >
                <UserPlusIcon color="#23C4A0" />
                <p className="text-[13px] font-bold text-[#0C7C62]">انضم للتحدي</p>
                <p className="mt-1 text-[11px] text-[#9fd9c9]">مشترك جديد؟</p>
              </button>
            </div>

            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="أدخل كود الاشتراك هنا..."
              className={input}
            />
            <button
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg shadow-[#A964F0]/30 transition hover:-translate-y-0.5"
              style={{ background: BRAND_GRADIENT }}
            >
              فتح التحدي 🔓
            </button>
          </>
        ) : (
          <>
            <p className="mb-5 text-lg font-extrabold text-[#1b1730]">أكمل بياناتك للانضمام</p>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم"
              className={input}
            />

            <div className="mb-3 flex gap-2.5">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الهاتف"
                className="flex-1 rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-[13px] text-right outline-none transition focus:border-[#7C6FF0] focus:bg-white"
              />
              <div className="flex w-20 items-center justify-center rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-2.5 py-3 text-[13px] font-semibold text-[#8a85a0]">
                +20
              </div>
            </div>

            <input
              value={job}
              onChange={(e) => setJob(e.target.value)}
              placeholder="الوظيفة"
              className="mb-4 w-full rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-[13px] text-right outline-none transition focus:border-[#7C6FF0] focus:bg-white"
            />

            <YesNoSelector label="هل التحقت بالجامعة؟" value={university} onChange={setUniversity} />
            <YesNoSelector
              label="هل أنت مشترك بقناة اليوتيوب؟"
              value={youtube}
              onChange={setYoutube}
            />

            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:-translate-y-0.5"
            >
              <WhatsAppIcon />
              تواصل عبر واتساب للاشتراك
            </a>
          </>
        )}
      </div>
    </div>
  )
}
