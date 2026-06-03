import { useState } from 'react'
import { BRAND_GRADIENT } from '../lib/theme'
import { supabase } from '../lib/supabase'
import type { Code } from '../types'

interface PremiumModalProps {
  onClose: () => void
}

const WHATSAPP_NUMBER = '201097965058'
const USER_KEY = 'x50_user'

const FEATURES = [
  { emoji: '📚', title: 'مصدر تعليمي لكل تحدي', desc: 'مادة مختارة تبدأ بها كل تحدٍّ' },
  { emoji: '🎬', title: 'درس شرح قصير وتفاعلي', desc: 'شرح مركّز يوصّل الفكرة بسرعة' },
  { emoji: '🎤', title: 'مهمة تحدّث عملية', desc: 'تتكلّم فعليًا في كل تحدي' },
  { emoji: '🤖', title: 'تدرّب مع AI Coach', desc: 'تمرّن على النطق والمحادثة في أي وقت' },
  { emoji: '📊', title: 'تقييم واقتراحات للتطوير', desc: 'تعرف نقاط قوتك وما يحتاج تحسين' },
  { emoji: '🏆', title: 'متابعة حتى النهاية', desc: 'التزام للنهاية = نتيجة مضمونة إن شاء الله' },
]

type YesNo = 'yes' | 'no' | null

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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

export default function PremiumModal({ onClose }: PremiumModalProps) {
  const [view, setView] = useState<'features' | 'join'>('features')

  // Code redemption
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Join form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [job, setJob] = useState('')
  const [university, setUniversity] = useState<YesNo>('yes')
  const [youtube, setYoutube] = useState<YesNo>(null)

  const input =
    'mb-3 w-full rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-[13px] text-right outline-none transition focus:border-[#7C6FF0] focus:bg-white'

  const whatsappUrl = () => {
    const lines = [
      `انا اسمي ${name || '...'}`,
      `وظيفتي ${job || '...'}`,
      university === 'no' ? 'لم التحق بالجامعة' : 'التحقت بالجامعة',
      youtube === 'yes' ? 'مشترك في قناة اليوتيوب' : 'غير مشترك في قناة اليوتيوب',
      'وشاهدت الفيديو وراجعت النظام جيداً وحابب اشترك في تحدي ٥٠ يوم',
    ]
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`
  }

  const saveIdentity = () => {
    const identity = [name.trim(), phone.trim()].filter(Boolean).join(' - ')
    if (identity) {
      try {
        localStorage.setItem(USER_KEY, identity)
      } catch {
        /* ignore storage errors */
      }
    }
  }

  const submitCode = async () => {
    const value = code.trim()
    if (!value) {
      setCodeMsg({ ok: false, text: 'أدخل كود الاشتراك أولاً' })
      return
    }
    if (!supabase) {
      setCodeMsg({ ok: false, text: 'تعذّر التحقق الآن، حاول لاحقاً' })
      return
    }
    setVerifying(true)
    setCodeMsg(null)

    const { data, error } = await supabase.from('x50_codes').select('*').eq('code', value)
    const matches = (data as Code[] | null) ?? []

    if (error || matches.length === 0) {
      setVerifying(false)
      setCodeMsg({ ok: false, text: 'كود غير صحيح، تأكد منه أو اشترك للحصول على كود' })
      return
    }

    const found = matches[0]
    if (found.used_at) {
      setVerifying(false)
      setCodeMsg({ ok: false, text: 'هذا الكود مستخدم بالفعل' })
      return
    }

    let usedBy: string | null = null
    try {
      usedBy = localStorage.getItem(USER_KEY)
    } catch {
      usedBy = null
    }

    await supabase
      .from('x50_codes')
      .update({ used_at: new Date().toISOString(), used_by: usedBy })
      .eq('id', found.id)

    setVerifying(false)
    setCodeMsg({ ok: true, text: 'تم تفعيل الكود بنجاح ✓ بالتوفيق في التحدي!' })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1730]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-[28px] border border-white bg-white shadow-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className="relative overflow-hidden px-6 pb-7 pt-8 text-center" style={{ background: BRAND_GRADIENT }}>
          <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute -bottom-10 -right-6 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
          >
            <CloseIcon />
          </button>
          {view === 'join' && (
            <button
              onClick={() => setView('features')}
              aria-label="رجوع"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
            >
              <BackIcon />
            </button>
          )}
          <span className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur">
            {view === 'features' ? '✨' : '📝'}
          </span>
          <h2 className="relative text-[22px] font-black text-white">
            {view === 'features' ? 'مميزات تحدي ٥٠ يوم' : 'أكمل بياناتك للانضمام'}
          </h2>
          <p className="relative mt-1 text-[13px] font-semibold text-white/90">
            {view === 'features'
              ? 'كل اللي تحتاجه عشان تتحدث الإنجليزية بثقة'
              : 'بياناتك تساعدنا نخدمك بشكل أفضل'}
          </p>
        </div>

        {view === 'features' ? (
          <>
            {/* Feature list */}
            <div className="space-y-2.5 px-5 py-5">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3 rounded-2xl border border-[#f2eefc] bg-[#faf9ff] p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                    {f.emoji}
                  </span>
                  <div>
                    <p className="text-[14px] font-extrabold text-[#1b1730]">{f.title}</p>
                    <p className="text-[12px] text-[#7a7596]">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Primary CTA → user details */}
            <div className="px-5 pb-6">
              <button
                onClick={() => setView('join')}
                className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg shadow-[#A964F0]/30 transition hover:-translate-y-0.5"
                style={{ background: BRAND_GRADIENT }}
              >
                اشترك الآن في التحدي ←
              </button>

              {/* Divider */}
              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#efeafc]" />
                <span className="text-[12px] font-bold text-[#a39ec0]">عندك كود اشتراك؟</span>
                <span className="h-px flex-1 bg-[#efeafc]" />
              </div>

              {/* Code entry */}
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setCodeMsg(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && submitCode()}
                  placeholder="أدخل كود الاشتراك هنا..."
                  className="flex-1 rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-[13px] text-right outline-none transition focus:border-[#7C6FF0] focus:bg-white"
                />
                <button
                  onClick={submitCode}
                  disabled={verifying}
                  className="shrink-0 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#A964F0]/30 transition hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ background: BRAND_GRADIENT }}
                >
                  {verifying ? '...' : 'افتح'}
                </button>
              </div>
              {codeMsg && (
                <p
                  className={`mt-2 text-center text-[12px] font-semibold ${
                    codeMsg.ok ? 'text-[#0C7C62]' : 'text-[#C2410C]'
                  }`}
                >
                  {codeMsg.text}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* User details form */}
            <div className="px-5 py-5">
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
                className={input}
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
                onClick={saveIdentity}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:-translate-y-0.5"
              >
                <WhatsAppIcon />
                تواصل عبر واتساب للاشتراك
              </a>
              <p className="mt-3 text-center text-[12px] text-[#a39ec0]">
                عند الاشتراك ستحصل على كود لفتح كل التحديات 🔓
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
