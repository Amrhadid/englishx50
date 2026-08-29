import { useState } from 'react'
import { createLead } from '../lib/leads'
import { UI } from '../lib/theme'
import { ChoiceSelector, FieldError, NationalitySelect, PhoneCodeSelect, YesNoSelector } from './FormFields'
import { ERROR_COLOR, dialCodeFor, fieldClass, isValidLocalPhone, nationalityLabel, type YesNo } from '../lib/form'

const WHATSAPP_NUMBER = '201097965058'
const USER_KEY = 'x50_user'

const REFERRAL_OPTIONS = [
  { value: 'تيك توك', label: 'تيك توك' },
  { value: 'انستجرام', label: 'انستجرام' },
  { value: 'يوتيوب', label: 'يوتيوب' },
  { value: 'صديق', label: 'صديق' },
]

/** The field ids, in the order they appear — used to scroll to the first error. */
const FIELD_ORDER = ['name', 'phone', 'job', 'nationality', 'university', 'youtube', 'referral'] as const
type FieldKey = (typeof FIELD_ORDER)[number]
type Errors = Partial<Record<FieldKey, string>>

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.6 4.7-1.2A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.7 1 .9 1.8 1.1 2.1 1.3.2.1.4.1.6-.1l.7-.8c.2-.2.3-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
    </svg>
  )
}

/** One field plus the red message it shows once it has failed validation. */
function Field({ id, error, children }: { id: FieldKey; error?: string; children: React.ReactNode }) {
  return (
    <div id={`join-field-${id}`} className="scroll-mt-24">
      {children}
      <FieldError>{error}</FieldError>
    </div>
  )
}

const CTA_CLASS =
  'mt-2 flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-[#25D366] py-4 text-[17px] font-bold text-white transition hover:brightness-95'

/**
 * The join form + WhatsApp hand-off (the old PremiumModal "join" view, now an
 * ordinary page section on /join).
 *
 * The form itself is not the subscription: it records a lead and composes the
 * WhatsApp message the visitor sends to complete the subscription manually.
 * Every field is required — an incomplete form has no WhatsApp link at all
 * (the CTA is a plain button that reveals the red errors instead), so there is
 * nothing to open in a new tab and no half-filled lead to follow up on.
 * Recording the lead is still best-effort and must never block the hand-off.
 */
export default function JoinForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('EG')
  const [job, setJob] = useState('')
  const [nationality, setNationality] = useState('')
  const [university, setUniversity] = useState<YesNo>(null)
  const [youtube, setYoutube] = useState<YesNo>(null)
  const [referral, setReferral] = useState<string | null>(null)
  // Errors stay hidden until the visitor first tries to send; after that they
  // track the fields live, so fixing one clears its message straight away.
  const [showErrors, setShowErrors] = useState(false)

  const dialCode = dialCodeFor(country)
  const fullPhone = phone.trim() ? `${dialCode}${phone.trim().replace(/\D/g, '')}` : ''

  const errors: Errors = {}
  if (name.trim().length < 2) errors.name = 'من فضلك اكتب اسمك'
  if (!phone.trim()) errors.phone = 'من فضلك اكتب رقم هاتفك'
  else if (!isValidLocalPhone(phone)) errors.phone = 'رقم الهاتف غير صحيح'
  if (!job.trim()) errors.job = 'من فضلك اكتب وظيفتك'
  if (!nationality) errors.nationality = 'من فضلك اختر جنسيتك'
  if (university === null) errors.university = 'من فضلك اختر إجابة'
  if (youtube === null) errors.youtube = 'من فضلك اختر إجابة'
  if (!referral) errors.referral = 'من فضلك اختر كيف عرفت عن التحدي'

  const complete = FIELD_ORDER.every((key) => !errors[key])
  const shown = (key: FieldKey) => (showErrors ? errors[key] : undefined)

  const whatsappUrl = () => {
    const lines = [
      `انا اسمي ${name.trim()}`,
      `وجنسيتي ${nationalityLabel(nationality)}`,
      `ورقمي ${fullPhone}`,
      `وظيفتي ${job.trim()}`,
      university === 'no' ? 'لم التحق بالجامعة' : 'التحقت بالجامعة',
      youtube === 'yes' ? 'مشترك في قناة اليوتيوب' : 'غير مشترك في قناة اليوتيوب',
      `وعرفت عن التحدي من ${referral}`,
      'وشاهدت الفيديو وراجعت النظام جيداً وحابب اشترك في تحدي ٥٠ يوم',
    ]
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`
  }

  // Reveal the errors and take the visitor to the first field that needs them.
  const revealErrors = () => {
    setShowErrors(true)
    const first = FIELD_ORDER.find((key) => errors[key])
    if (first) {
      document.getElementById(`join-field-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
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
            بياناتك تساعدنا نخدمك بشكل أفضل، وبعدها تكمل الاشتراك على واتساب. كل الحقول مطلوبة.
          </p>
        </div>

        <div
          className="flex flex-col gap-4 rounded-[20px] border bg-white p-6 sm:p-8"
          style={{ borderColor: UI.line }}
        >
          <Field id="name" error={shown('name')}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم"
              aria-invalid={Boolean(shown('name'))}
              className={fieldClass(Boolean(shown('name')))}
            />
          </Field>

          <Field id="phone" error={shown('phone')}>
            <div className="flex gap-2.5">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الهاتف"
                inputMode="tel"
                aria-invalid={Boolean(shown('phone'))}
                className={`flex-1 ${fieldClass(Boolean(shown('phone')))}`}
              />
              <PhoneCodeSelect value={country} onChange={setCountry} />
            </div>
          </Field>

          <Field id="job" error={shown('job')}>
            <input
              value={job}
              onChange={(e) => setJob(e.target.value)}
              placeholder="الوظيفة"
              aria-invalid={Boolean(shown('job'))}
              className={fieldClass(Boolean(shown('job')))}
            />
          </Field>

          <Field id="nationality" error={shown('nationality')}>
            <NationalitySelect value={nationality} onChange={setNationality} invalid={Boolean(shown('nationality'))} />
          </Field>

          <Field id="university" error={shown('university')}>
            <YesNoSelector
              label="هل التحقت بالجامعة؟"
              value={university}
              onChange={setUniversity}
              invalid={Boolean(shown('university'))}
            />
          </Field>

          <Field id="youtube" error={shown('youtube')}>
            <YesNoSelector
              label="هل أنت مشترك بقناة اليوتيوب؟"
              value={youtube}
              onChange={setYoutube}
              invalid={Boolean(shown('youtube'))}
            />
          </Field>

          <Field id="referral" error={shown('referral')}>
            <ChoiceSelector
              label="كيف عرفت عن التحدي؟"
              options={REFERRAL_OPTIONS}
              value={referral}
              onChange={setReferral}
              invalid={Boolean(shown('referral'))}
            />
          </Field>

          {complete ? (
            <a href={whatsappUrl()} target="_blank" rel="noreferrer" onClick={submitJoin} className={CTA_CLASS}>
              <WhatsAppIcon />
              تواصل عبر واتساب للاشتراك
            </a>
          ) : (
            // Deliberately a real, enabled button rather than a disabled one:
            // clicking it is how the visitor finds out what is still missing.
            <button type="button" onClick={revealErrors} className={CTA_CLASS}>
              <WhatsAppIcon />
              تواصل عبر واتساب للاشتراك
            </button>
          )}

          {showErrors && !complete && (
            <p role="alert" className="text-center text-[13.5px] font-bold" style={{ color: ERROR_COLOR }}>
              من فضلك أكمل كل البيانات المطلوبة قبل المتابعة على واتساب.
            </p>
          )}

          <p className="text-center text-[13.5px]" style={{ color: UI.muted }}>
            عند الاشتراك ستحصل على كود تفعّله من «ابدأ التحدي» 🔓
          </p>
        </div>
      </div>
    </section>
  )
}
