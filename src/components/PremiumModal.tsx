import { useEffect, useRef, useState } from 'react'
import { BRAND_GRADIENT } from '../lib/theme'
import { supabase } from '../lib/supabase'
import { checkCode, redeemCode } from '../lib/redeem'
import { useAuth } from '../hooks/useAuth'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { dialCountries, arabNationalities } from '../lib/countries'
import { createLead } from '../lib/leads'

interface PremiumModalProps {
  onClose: () => void
  initialCode?: string
  /** Open on the features view and focus the code box (used after sign-in). */
  focusCode?: boolean
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

const TERMS = [
  'بالتسجيل في EnglishX50، أنت توافق على الالتزام بالتحديات الـ50 يومًا كاملة.',
  'الكود الخاص بك صالح لمدة 100 يوم من تاريخ تفعيله ولا يمكن نقله لشخص آخر.',
  'المحتوى التعليمي (الفيديوهات والتحديات) مخصص للاستخدام الشخصي فقط ولا يجوز مشاركته.',
  'يتم حفظ تسجيلاتك الصوتية لتحليلها بالذكاء الاصطناعي وتقديم التغذية الراجعة لك.',
  'لا يوجد استرداد للمبلغ بعد تفعيل الكود.',
  'يحق للإدارة إلغاء حسابك في حال ثبت إساءة استخدام المنصة.',
  'التقدم في التحديات يعتمد على أدائك الفعلي — لا يمكن تخطي تحدٍّ دون إكماله.',
  'بيانات حسابك (الاسم، الهاتف، الجامعة) تُستخدم فقط لأغراض المنصة ولا تُشارك مع أطراف خارجية.',
  'EnglishX50 غير مسؤولة عن أي انقطاع في الخدمة بسبب ظروف خارجة عن إرادتها.',
  'تحتفظ الإدارة بحق تعديل هذه الشروط في أي وقت مع إشعار المستخدمين مسبقًا.',
  'بعد انتهاء الـ100 يوم لا يوجد أي استثناء أو تمديد تحت أي ظرف كان.',
]

type YesNo = 'yes' | 'no' | null

const REFERRAL_OPTIONS = [
  { value: 'تيك توك', label: 'تيك توك' },
  { value: 'انستجرام', label: 'انستجرام' },
  { value: 'يوتيوب', label: 'يوتيوب' },
  { value: 'صديق', label: 'صديق' },
]

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 opacity-60" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Close the dropdown when clicking anywhere outside of it.
function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return { open, setOpen, ref }
}

// Searchable country-code picker for the phone field. Tracks the selected
// country by its ISO code (dial codes are not unique, e.g. +1 for US/CA).
function PhoneCodeSelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { open, setOpen, ref } = useDropdown()
  const [search, setSearch] = useState('')
  const selected = dialCountries.find((c) => c.code === value) ?? dialCountries[0]
  const q = search.trim()
  const list = q
    ? dialCountries.filter(
        (c) => c.name.includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q.toLowerCase()),
      )
    : dialCountries
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-full items-center gap-1 rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-3 py-3 text-[13px] font-semibold text-[#8a85a0] transition hover:border-[#cfc6f5]"
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span dir="ltr">{selected.dialCode}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-2 w-64 overflow-hidden rounded-2xl border border-[#ece7fb] bg-white shadow-xl">
          <div className="border-b border-[#f2eefc] p-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن دولة أو كود..."
              className="w-full rounded-xl border border-[#ece7fb] bg-[#faf9ff] px-3 py-2 text-[12.5px] text-right outline-none focus:border-[#7C6FF0]"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {list.length === 0 ? (
              <p className="px-3 py-3 text-center text-[12px] text-[#a39ec0]">لا توجد نتائج</p>
            ) : (
              list.map((c) => (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => {
                    onChange(c.code)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-[13px] transition hover:bg-[#f6f4ff] ${
                    c.code === value ? 'bg-[#f1edff]' : ''
                  }`}
                >
                  <span className="text-base">{c.flag}</span>
                  <span className="flex-1 truncate text-[#1b1730]">{c.name}</span>
                  <span dir="ltr" className="text-[#8a85a0]">
                    {c.dialCode}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Arab-only nationality picker.
function NationalitySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { open, setOpen, ref } = useDropdown()
  const selected = arabNationalities.find((n) => n.code === value)
  return (
    <div className="relative mb-3" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-[13px] outline-none transition hover:border-[#cfc6f5]"
      >
        {selected ? (
          <span className="flex items-center gap-2 text-[#1b1730]">
            <span className="text-base">{selected.flag}</span>
            {selected.label}
          </span>
        ) : (
          <span className="text-[#8a85a0]">الجنسية</span>
        )}
        <ChevronIcon />
      </button>
      {open && (
        <div className="absolute inset-x-0 z-10 mt-2 overflow-hidden rounded-2xl border border-[#ece7fb] bg-white shadow-xl">
          <div className="max-h-56 overflow-y-auto">
            {arabNationalities.map((n) => (
              <button
                type="button"
                key={n.code}
                onClick={() => {
                  onChange(n.code)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-right text-[13px] transition hover:bg-[#f6f4ff] ${
                  n.code === value ? 'bg-[#f1edff]' : ''
                }`}
              >
                <span className="text-base">{n.flag}</span>
                <span className="flex-1 text-[#1b1730]">{n.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ChoiceSelector({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div className="mb-3.5">
      <p className="mb-2 text-[13px] font-bold text-[#1b1730]">{label}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((o) => {
          const active = value === o.value
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => onChange(o.value)}
              className={
                active
                  ? 'cursor-pointer rounded-2xl border-2 border-[#7C6FF0] bg-[#f1edff] p-2.5 text-center text-[13px] font-bold text-[#7C6FF0]'
                  : 'cursor-pointer rounded-2xl border border-[#ece7fb] p-2.5 text-center text-[13px] font-semibold text-[#9a95ad] hover:border-[#cfc6f5]'
              }
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

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

export default function PremiumModal({ onClose, initialCode, focusCode }: PremiumModalProps) {
  const { user, signInWithGoogle } = useAuth()
  const { refetch } = useOnboardingContext()
  const [view, setView] = useState<'features' | 'join' | 'redeem'>(initialCode ? 'redeem' : 'features')

  // Bring the code box into view and focus it when the modal is opened right
  // after sign-in (the visitor came here specifically to enter their code).
  const codeInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (focusCode && user && view === 'features') {
      codeInputRef.current?.scrollIntoView({ block: 'center' })
      codeInputRef.current?.focus()
    }
  }, [focusCode, user, view])

  // Code redemption
  const [code, setCode] = useState(initialCode ?? '')
  const [verifying, setVerifying] = useState(false)
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [validatedCode, setValidatedCode] = useState<string | null>(initialCode ?? null)

  // Activation form (after a valid code)
  const [redeemName, setRedeemName] = useState('')
  const [redeemPhone, setRedeemPhone] = useState('')
  const [redeemCountry, setRedeemCountry] = useState('EG')
  const [redeemJob, setRedeemJob] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [activated, setActivated] = useState(false)

  const redeemDialCode = dialCountries.find((c) => c.code === redeemCountry)?.dialCode ?? '+20'

  // Join form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('EG')
  const [job, setJob] = useState('')
  const [nationality, setNationality] = useState('')
  const [university, setUniversity] = useState<YesNo>('yes')
  const [youtube, setYoutube] = useState<YesNo>(null)
  const [referral, setReferral] = useState<string | null>(null)

  const dialCode = dialCountries.find((c) => c.code === country)?.dialCode ?? '+20'

  const input =
    'mb-3 w-full rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-[13px] text-right outline-none transition focus:border-[#7C6FF0] focus:bg-white'

  const whatsappUrl = () => {
    const nat = arabNationalities.find((n) => n.code === nationality)?.label
    const lines = [
      `انا اسمي ${name || '...'}`,
      ...(nat ? [`وجنسيتي ${nat}`] : []),
      ...(phone.trim() ? [`ورقمي ${dialCode}${phone.trim()}`] : []),
      `وظيفتي ${job || '...'}`,
      university === 'no' ? 'لم التحق بالجامعة' : 'التحقت بالجامعة',
      youtube === 'yes' ? 'مشترك في قناة اليوتيوب' : 'غير مشترك في قناة اليوتيوب',
      ...(referral ? [`وعرفت عن التحدي من ${referral}`] : []),
      'وشاهدت الفيديو وراجعت النظام جيداً وحابب اشترك في تحدي ٥٠ يوم',
    ]
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`
  }

  const saveIdentity = () => {
    const fullPhone = phone.trim() ? `${dialCode}${phone.trim()}` : ''
    const identity = [name.trim(), fullPhone].filter(Boolean).join(' - ')
    if (identity) {
      try {
        localStorage.setItem(USER_KEY, identity)
      } catch {
        /* ignore storage errors */
      }
    }
  }

  // Persist the lead and mirror identity when the user heads to WhatsApp.
  const submitJoin = () => {
    saveIdentity()
    const nat = arabNationalities.find((n) => n.code === nationality)?.label ?? ''
    void createLead({
      name,
      phone: phone.trim() ? `${dialCode}${phone.trim()}` : '',
      countryCode: dialCode,
      job,
      nationality: nat,
      university,
      youtube,
      referral,
    })
  }

  const submitCode = async () => {
    // Redemption is tied to a Google account (durable across devices, not
    // shareable), so a code can only be activated while signed in.
    if (!user) {
      setCodeMsg({ ok: false, text: 'سجّل الدخول بحساب Google أولاً لتفعيل الكود' })
      return
    }
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

    // Server-side check (the codes table itself is not readable by clients).
    const status = await checkCode(value)
    setVerifying(false)

    if (status === 'used') {
      setCodeMsg({ ok: false, text: 'هذا الكود مستخدم بالفعل' })
      return
    }
    if (status === 'error') {
      setCodeMsg({ ok: false, text: 'تعذّر التحقق الآن، حاول لاحقاً' })
      return
    }
    if (status === 'invalid') {
      setCodeMsg({ ok: false, text: 'كود غير صحيح، تأكد منه أو اشترك للحصول على كود' })
      return
    }

    // Valid code — collect the user's details and agreement before activating.
    setCodeMsg(null)
    setValidatedCode(value)
    setView('redeem')
  }

  // Finalize: bind the code to the signed-in account (DB) and unlock premium.
  const confirmActivation = async () => {
    if (!user) {
      setCodeMsg({ ok: false, text: 'سجّل الدخول بحساب Google أولاً' })
      return
    }
    if (!redeemName.trim() || !redeemJob.trim() || !redeemPhone.trim()) {
      setCodeMsg({ ok: false, text: 'من فضلك أكمل الاسم ورقم الهاتف والوظيفة' })
      return
    }
    if (!agreed) {
      setCodeMsg({ ok: false, text: 'يجب الموافقة على الشروط والأحكام للمتابعة' })
      return
    }
    if (!validatedCode) {
      setCodeMsg({ ok: false, text: 'تعذّر التفعيل الآن، حاول لاحقاً' })
      return
    }
    setVerifying(true)
    setCodeMsg(null)

    const result = await redeemCode({
      code: validatedCode,
      name: redeemName.trim(),
      job: redeemJob.trim(),
      phone: `${redeemDialCode}${redeemPhone.trim()}`,
    })

    if (!result.ok) {
      setVerifying(false)
      setCodeMsg({
        ok: false,
        text:
          result.reason === 'used'
            ? 'هذا الكود مستخدم بالفعل، حاول بكود آخر'
            : result.reason === 'invalid'
              ? 'كود غير صحيح'
              : 'تعذّر التفعيل الآن، حاول لاحقاً',
      })
      return
    }

    // Mirror the identity for activity logging (Students view groups by it).
    try {
      localStorage.setItem(USER_KEY, `${redeemName.trim()} - ${redeemJob.trim()}`)
    } catch {
      /* ignore storage errors */
    }

    await refetch()
    setVerifying(false)
    setActivated(true)
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
          {(view === 'join' || (view === 'redeem' && !activated)) && (
            <button
              onClick={() => setView('features')}
              aria-label="رجوع"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
            >
              <BackIcon />
            </button>
          )}
          <span className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur">
            {activated ? '🎉' : view === 'features' ? '✨' : view === 'join' ? '📝' : '🔑'}
          </span>
          <h2 className="relative text-[22px] font-black text-white">
            {activated
              ? 'تم تفعيل حسابك'
              : view === 'features'
                ? 'مميزات تحدي ٥٠ يوم'
                : view === 'join'
                  ? 'أكمل بياناتك للانضمام'
                  : 'تفعيل حسابك'}
          </h2>
          <p className="relative mt-1 text-[13px] font-semibold text-white/90">
            {activated
              ? 'يمكنك الآن البدء في التحديات 🎯'
              : view === 'features'
                ? 'كل اللي تحتاجه عشان تتحدث الإنجليزية بثقة'
                : view === 'join'
                  ? 'بياناتك تساعدنا نخدمك بشكل أفضل'
                  : 'أكمل بياناتك ووافق على الشروط لتفعيل الكود'}
          </p>
        </div>

        {activated ? (
          <div className="px-6 py-8 text-center">
            <p className="mb-2 text-5xl">✅</p>
            <p className="mb-1 text-lg font-extrabold text-[#1b1730]">أهلاً {redeemName.trim()}!</p>
            <p className="mb-6 text-[14px] text-[#7a7596]">
              تم تفعيل اشتراكك بنجاح. كودك صالح لمدة ١٠٠ يوم من الآن. بالتوفيق! 💪
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
              style={{ background: BRAND_GRADIENT }}
            >
              ابدأ الآن ←
            </button>
          </div>
        ) : view === 'redeem' ? (
          <div className="px-5 py-5">
            <input
              value={redeemName}
              onChange={(e) => setRedeemName(e.target.value)}
              placeholder="الاسم"
              className={input}
              autoFocus
            />
            <div className="mb-3 flex gap-2.5">
              <input
                value={redeemPhone}
                onChange={(e) => setRedeemPhone(e.target.value)}
                placeholder="رقم الهاتف"
                className="flex-1 rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-[13px] text-right outline-none transition focus:border-[#7C6FF0] focus:bg-white"
              />
              <PhoneCodeSelect value={redeemCountry} onChange={setRedeemCountry} />
            </div>
            <input
              value={redeemJob}
              onChange={(e) => setRedeemJob(e.target.value)}
              placeholder="الوظيفة"
              className={input}
            />

            <p className="mb-2 mt-1 text-[13px] font-bold text-[#1b1730]">الشروط والأحكام</p>
            <div className="mb-3 max-h-48 overflow-y-auto rounded-2xl border border-[#ece7fb] bg-[#faf9ff] p-3.5">
              <ul className="space-y-2">
                {TERMS.map((t, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-[#5b5670]">
                    <span className="text-[#7C6FF0]">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="mb-3 flex cursor-pointer items-start gap-2.5 text-[13px] font-semibold text-[#1b1730]">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#7C6FF0]"
              />
              <span>قرأت ووافقت على جميع الشروط والأحكام أعلاه</span>
            </label>

            {codeMsg && !codeMsg.ok && (
              <p className="mb-2 text-center text-[12px] font-semibold text-[#C2410C]">{codeMsg.text}</p>
            )}

            <button
              onClick={confirmActivation}
              disabled={verifying || !redeemName.trim() || !redeemPhone.trim() || !redeemJob.trim() || !agreed}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg shadow-[#A964F0]/30 transition hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: BRAND_GRADIENT }}
            >
              {verifying ? 'جارٍ التفعيل…' : 'تفعيل حسابي'}
            </button>
          </div>
        ) : view === 'features' ? (
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

              {/* Code entry — requires sign-in (premium binds to the account) */}
              {user ? (
                <>
                  <div className="flex gap-2">
                    <input
                      ref={codeInputRef}
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
                </>
              ) : (
                <>
                  <button
                    onClick={() => signInWithGoogle('?redeem=1')}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e7e3ff] bg-white py-3 text-sm font-extrabold text-[#1b1730] transition hover:bg-[#f1edff]"
                  >
                    <span className="text-base">🔑</span>
                    الدخول بـ Google لتفعيل الكود
                  </button>
                  <p className="mt-2 text-center text-[12px] text-[#a39ec0]">
                    اشتراكك مرتبط بحسابك ويعمل على أي جهاز بعد تسجيل الدخول.
                  </p>
                </>
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
                <PhoneCodeSelect value={country} onChange={setCountry} />
              </div>

              <input
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder="الوظيفة"
                className={input}
              />

              <NationalitySelect value={nationality} onChange={setNationality} />

              <YesNoSelector label="هل التحقت بالجامعة؟" value={university} onChange={setUniversity} />
              <YesNoSelector
                label="هل أنت مشترك بقناة اليوتيوب؟"
                value={youtube}
                onChange={setYoutube}
              />
              <ChoiceSelector
                label="كيف عرفت عن التحدي؟"
                options={REFERRAL_OPTIONS}
                value={referral}
                onChange={setReferral}
              />

              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noreferrer"
                onClick={submitJoin}
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
