import { useState } from 'react'
import { createLead } from '../lib/leads'
import { UI } from '../lib/theme'
import { ChoiceSelector, NationalitySelect, PhoneCodeSelect, YesNoSelector } from './FormFields'
import { dialCodeFor, inputClass, nationalityLabel, type YesNo } from '../lib/form'

const WHATSAPP_NUMBER = '201097965058'
const USER_KEY = 'x50_user'

const REFERRAL_OPTIONS = [
  { value: 'تيك توك', label: 'تيك توك' },
  { value: 'انستجرام', label: 'انستجرام' },
  { value: 'يوتيوب', label: 'يوتيوب' },
  { value: 'صديق', label: 'صديق' },
]

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.6 4.7-1.2A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.7 1 .9 1.8 1.1 2.1 1.3.2.1.4.1.6-.1l.7-.8c.2-.2.3-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
    </svg>
  )
}

/**
 * The join form + WhatsApp hand-off (the old PremiumModal "join" view, now an
 * ordinary page section on /join).
 *
 * The form itself is not the subscription: it records a lead and composes the
 * WhatsApp message the visitor sends to complete the subscription manually.
 * Recording the lead is best-effort and must never block that hand-off.
 */
export default function JoinForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('EG')
  const [job, setJob] = useState('')
  const [nationality, setNationality] = useState('')
  const [university, setUniversity] = useState<YesNo>('yes')
  const [youtube, setYoutube] = useState<YesNo>(null)
  const [referral, setReferral] = useState<string | null>(null)

  const dialCode = dialCodeFor(country)
  const fullPhone = phone.trim() ? `${dialCode}${phone.trim()}` : ''

  const whatsappUrl = () => {
    const nat = nationalityLabel(nationality)
    const lines = [
      `انا اسمي ${name || '...'}`,
      ...(nat ? [`وجنسيتي ${nat}`] : []),
      ...(fullPhone ? [`ورقمي ${fullPhone}`] : []),
      `وظيفتي ${job || '...'}`,
      university === 'no' ? 'لم التحق بالجامعة' : 'التحقت بالجامعة',
      youtube === 'yes' ? 'مشترك في قناة اليوتيوب' : 'غير مشترك في قناة اليوتيوب',
      ...(referral ? [`وعرفت عن التحدي من ${referral}`] : []),
      'وشاهدت الفيديو وراجعت النظام جيداً وحابب اشترك في تحدي ٥٠ يوم',
    ]
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`
  }

  // Persist the lead and mirror the identity when the visitor heads to WhatsApp.
  const submitJoin = () => {
    const identity = [name.trim(), fullPhone].filter(Boolean).join(' - ')
    if (identity) {
      try {
        localStorage.setItem(USER_KEY, identity)
      } catch {
        /* ignore storage errors */
      }
    }
    void createLead({
      name,
      phone: fullPhone,
      countryCode: dialCode,
      job,
      nationality: nationalityLabel(nationality),
      university,
      youtube,
      referral,
    })
  }

  return (
    <section id="join-form" className="px-5 py-16 sm:px-8" style={{ backgroundColor: UI.sand }} dir="rtl">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <h2 className="text-[30px] font-black leading-tight tracking-tight sm:text-[40px]" style={{ color: UI.ink }}>
            أكمل بياناتك
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed" style={{ color: UI.muted }}>
            بياناتك تساعدنا نخدمك بشكل أفضل، وبعدها تكمل الاشتراك على واتساب.
          </p>
        </div>

        <div
          className="flex flex-col gap-4 rounded-[20px] border bg-white p-6 sm:p-8"
          style={{ borderColor: UI.line }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className={inputClass} />

          <div className="flex gap-2.5">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الهاتف"
              className={`flex-1 ${inputClass}`}
            />
            <PhoneCodeSelect value={country} onChange={setCountry} />
          </div>

          <input value={job} onChange={(e) => setJob(e.target.value)} placeholder="الوظيفة" className={inputClass} />

          <NationalitySelect value={nationality} onChange={setNationality} />

          <YesNoSelector label="هل التحقت بالجامعة؟" value={university} onChange={setUniversity} />
          <YesNoSelector label="هل أنت مشترك بقناة اليوتيوب؟" value={youtube} onChange={setYoutube} />
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
            className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-[#25D366] py-4 text-[17px] font-bold text-white transition hover:brightness-95"
          >
            <WhatsAppIcon />
            تواصل عبر واتساب للاشتراك
          </a>
          <p className="text-center text-[13.5px]" style={{ color: UI.muted }}>
            عند الاشتراك ستحصل على كود تفعّله من «ابدأ التحدي» 🔓
          </p>
        </div>
      </div>
    </section>
  )
}
