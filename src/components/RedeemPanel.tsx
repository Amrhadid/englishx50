import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UI } from '../lib/theme'
import { TERMS } from '../lib/terms'
import { supabase } from '../lib/supabase'
import { checkCode, redeemCode } from '../lib/redeem'
import { useAuth } from '../hooks/useAuth'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import SiteHeader from './SiteHeader'
import { PhoneCodeSelect } from './FormFields'
import { dialCodeFor, inputClass } from '../lib/form'

const USER_KEY = 'x50_user'

/**
 * The gate in front of «ابدأ التحدي».
 *
 * Codes are no longer offered anywhere in the join flow — someone who bought a
 * subscription (or already redeemed on another device) lands here instead:
 *
 *   1. signed out            → sign in with Google
 *   2. signed in, no code    → enter the code, then details + terms → activate
 *   3. redeemed              → the parent renders the challenges
 *
 * Redemption binds the code to the Google account, which is what makes premium
 * durable across devices and non-shareable.
 */
export default function RedeemPanel({ initialCode }: { initialCode?: string }) {
  const { user, signInWithGoogle } = useAuth()
  const { refetch, student, daysLeft } = useOnboardingContext()

  const [code, setCode] = useState(initialCode ?? '')
  const [validatedCode, setValidatedCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('EG')
  const [job, setJob] = useState('')
  const [agreed, setAgreed] = useState(false)

  const verifyCode = async (value: string) => {
    if (!value.trim()) {
      setError('أدخل كود الاشتراك أولاً')
      return
    }
    if (!supabase) {
      setError('تعذّر التحقق الآن، حاول لاحقاً')
      return
    }
    setBusy(true)
    setError(null)
    // Server-side check — the codes table itself is not readable by clients.
    const status = await checkCode(value.trim())
    setBusy(false)
    if (status === 'used') return setError('هذا الكود مستخدم بالفعل')
    if (status === 'invalid') return setError('كود غير صحيح، تأكد منه أو انضم للتحدي للحصول على كود')
    if (status === 'error') return setError('تعذّر التحقق الآن، حاول لاحقاً')
    setValidatedCode(value.trim())
  }

  const activate = async () => {
    if (!name.trim() || !phone.trim() || !job.trim()) {
      setError('من فضلك أكمل الاسم ورقم الهاتف والوظيفة')
      return
    }
    if (!agreed) {
      setError('يجب الموافقة على الشروط والأحكام للمتابعة')
      return
    }
    if (!validatedCode) return
    setBusy(true)
    setError(null)

    const result = await redeemCode({
      code: validatedCode,
      name: name.trim(),
      job: job.trim(),
      phone: `${dialCodeFor(country)}${phone.trim()}`,
    })

    if (!result.ok) {
      setBusy(false)
      setError(
        result.reason === 'used'
          ? 'هذا الكود مستخدم بالفعل، حاول بكود آخر'
          : result.reason === 'invalid'
            ? 'كود غير صحيح'
            : 'تعذّر التفعيل الآن، حاول لاحقاً',
      )
      return
    }

    // Mirror the identity for activity logging (the admin Students view groups
    // submissions by it).
    try {
      localStorage.setItem(USER_KEY, `${name.trim()} - ${job.trim()}`)
    } catch {
      /* ignore storage errors */
    }

    await refetch()
    setBusy(false)
  }

  const expired = !!student?.code && daysLeft <= 0

  return (
    <>
      <SiteHeader />
      <div className="flex min-h-[70vh] items-center justify-center bg-white px-5 py-16" dir="rtl">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-[20px] border" style={{ borderColor: UI.line }}>
          <div className="px-7 pb-8 pt-9 text-center" style={{ backgroundColor: UI.sand }}>
            <span className="mb-4 inline-block text-4xl">
              {expired ? '⏳' : !user ? '🔐' : validatedCode ? '📝' : '🔑'}
            </span>
            <h1 className="text-[28px] font-black leading-tight tracking-tight" style={{ color: UI.ink }}>
              {expired ? 'انتهى اشتراكك' : !user ? 'سجّل الدخول لتبدأ' : validatedCode ? 'تفعيل حسابك' : 'أدخل كود الاشتراك'}
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed" style={{ color: UI.muted }}>
              {expired
                ? 'مدة الـ١٠٠ يوم انتهت — انضم للتحدي من جديد للحصول على كود جديد.'
                : !user
                  ? 'اشتراكك مرتبط بحسابك ويعمل على أي جهاز بعد تسجيل الدخول.'
                  : validatedCode
                    ? 'أكمل بياناتك ووافق على الشروط لتفعيل الكود'
                    : 'الكود اللي استلمته بعد الاشتراك يفتح لك كل التحديات'}
            </p>
          </div>

          <div className="px-5 py-6">
            {expired ? (
              <Link
                to="/join"
                className="block w-full rounded-[14px] py-4 text-center text-[16px] font-bold transition hover:brightness-95"
                style={{ backgroundColor: UI.pink, color: UI.ink }}
              >
                انضم للتحدي من جديد ←
              </Link>
            ) : !user ? (
              <button
                onClick={() => signInWithGoogle('?redeem=1')}
                className="flex w-full items-center justify-center gap-2 rounded-[14px] py-4 text-[16px] font-bold transition hover:brightness-95"
                style={{ backgroundColor: UI.pink, color: UI.ink }}
              >
                <span className="text-base">🔑</span>
                الدخول بـ Google
              </button>
            ) : !validatedCode ? (
              <>
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value)
                      setError(null)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && verifyCode(code)}
                    placeholder="أدخل كود الاشتراك هنا..."
                    className={`flex-1 ${inputClass}`}
                    autoFocus
                  />
                  <button
                    onClick={() => verifyCode(code)}
                    disabled={busy}
                    className="shrink-0 rounded-[14px] px-6 py-3 text-[15px] font-bold transition hover:brightness-95 disabled:opacity-60"
                    style={{ backgroundColor: UI.pink, color: UI.ink }}
                  >
                    {busy ? '...' : 'افتح'}
                  </button>
                </div>
                {error && <p className="mt-3 text-center text-[13px] font-bold text-[#C2410C]">{error}</p>}
                <p className="mt-6 text-center text-[14px]" style={{ color: UI.muted }}>
                  لسه معندكش كود؟{' '}
                  <Link to="/join" className="font-bold underline" style={{ color: UI.ink }}>
                    انضم للتحدي
                  </Link>
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className={inputClass} autoFocus />
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

                <p className="mt-1 text-[14px] font-bold" style={{ color: UI.ink }}>الشروط والأحكام</p>
                <div
                  className="max-h-48 overflow-y-auto rounded-[14px] border p-4"
                  style={{ borderColor: UI.line, backgroundColor: UI.sand }}
                >
                  <ul className="space-y-2.5">
                    {TERMS.map((t, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: UI.muted }}>
                        <span style={{ color: UI.pinkInk }}>•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link to="/terms" className="text-[13px] font-bold underline" style={{ color: UI.ink }}>
                  اقرأ الشروط والأحكام كاملة
                </Link>

                <label className="flex cursor-pointer items-start gap-2.5 text-[14px] font-semibold" style={{ color: UI.ink }}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                    style={{ accentColor: UI.pink }}
                  />
                  <span>قرأت ووافقت على جميع الشروط والأحكام أعلاه</span>
                </label>

                {error && <p className="text-center text-[13px] font-bold text-[#C2410C]">{error}</p>}

                <button
                  onClick={activate}
                  disabled={busy || !name.trim() || !phone.trim() || !job.trim() || !agreed}
                  className="w-full rounded-[14px] py-4 text-[16px] font-bold transition hover:brightness-95 disabled:opacity-60"
                  style={{ backgroundColor: UI.pink, color: UI.ink }}
                >
                  {busy ? 'جارٍ التفعيل…' : 'تفعيل حسابي'}
                </button>
              </div>
            )}
          </div>
        </div>

        <Link to="/" className="mt-6 block text-center text-[14px] font-bold underline" style={{ color: UI.muted }}>
            ← الرجوع للصفحة الرئيسية
          </Link>
        </div>
      </div>
    </>
  )
}
