import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { supabase } from '../lib/supabase'
import { setPremium, markPremiumActivated } from '../lib/premium'
import { CloseIcon } from './icons'
import type { Code } from '../types'

const PURPLE = '#534AB7'
const TEAL = '#0F6E56'
const CORAL = '#993C1D'

function Logo() {
  return (
    <span
      className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-white"
      style={{ backgroundColor: PURPLE }}
    >
      50
    </span>
  )
}

export default function OnboardingModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { user } = useAuth()
  const { needsOnboarding, needsCode, refetch } = useOnboardingContext()

  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 2 — info form
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [job, setJob] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoError, setInfoError] = useState<string | null>(null)

  // Step 3 — code redemption
  const [code, setCode] = useState('')
  const [activating, setActivating] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // After success, give the user a moment to read it, then close the modal
  // (needsCode is already false post-refetch).
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => {
      setSuccess(false)
      onClose()
    }, 2200)
    return () => clearTimeout(t)
  }, [success, onClose])

  // Controlled: only render when explicitly opened (e.g. the user clicked a
  // challenge or the level test) AND onboarding/code is still required. This
  // prevents the popup from appearing automatically on every visit.
  if (!open || (!needsOnboarding && !needsCode && !success)) return null

  // The code step is optional — free users may close it and keep browsing.
  // The info step (onboarding) stays required.
  const closable = !success && step === 3

  const input =
    'w-full rounded-2xl border border-[#ece7fb] bg-white px-4 py-3 text-right text-[14px] outline-none transition focus:border-[#534AB7]'

  const submitInfo = async () => {
    if (!fullName.trim() || !phone.trim()) {
      setInfoError('من فضلك أكمل اسمك ورقم هاتفك على الأقل')
      return
    }
    if (!supabase || !user) {
      setInfoError('تعذّر الحفظ الآن، حاول لاحقاً')
      return
    }
    setSavingInfo(true)
    setInfoError(null)
    const { error } = await supabase.from('x50_students').insert({
      user_id: user.id,
      name: fullName.trim(),
      phone: phone.trim(),
      job: job.trim(),
    })
    setSavingInfo(false)
    if (error) {
      console.error('Onboarding insert error:', error)
      setInfoError('حدث خطأ أثناء الحفظ، حاول مرة أخرى')
      return
    }
    await refetch()
    setStep(3)
  }

  const activateCode = async () => {
    const value = code.trim()
    if (!value) {
      setCodeError('أدخل كود الاشتراك أولاً')
      return
    }
    if (!supabase || !user) {
      setCodeError('تعذّر التفعيل الآن، حاول لاحقاً')
      return
    }
    setActivating(true)
    setCodeError(null)

    const { data, error } = await supabase
      .from('x50_codes')
      .select('*')
      .eq('code', value)
      .is('used_at', null)
    const matches = (data as Code[] | null) ?? []

    if (error || matches.length === 0) {
      setActivating(false)
      setCodeError('الكود غير صحيح أو مستخدم من قبل')
      return
    }

    const now = new Date().toISOString()
    await supabase.from('x50_codes').update({ used_at: now }).eq('code', value)
    await supabase
      .from('x50_students')
      .update({ code: value, code_redeemed_at: now })
      .eq('user_id', user.id)

    setPremium(true)
    markPremiumActivated()
    await refetch()
    setActivating(false)
    setSuccess(true)
  }

  // Key the inner content so each step/state replays the fade-in.
  const stateKey = success ? 'success' : `step-${step}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1b1730]/70 p-4 backdrop-blur-sm"
      dir="rtl"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <style>{`
        @keyframes ob-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>

      <div className="relative w-full max-w-md rounded-[28px] border border-white bg-[#fdfcff] p-7 shadow-2xl sm:p-8">
        {closable && (
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f2fc] text-[#8a85a0] transition hover:bg-[#ece8f8]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        )}
        <div key={stateKey} style={{ animation: 'ob-fade 300ms ease' }}>
          {success ? (
            /* Success */
            <div className="py-6 text-center">
              <p className="mb-3 text-5xl">🎉</p>
              <p className="text-lg font-extrabold leading-relaxed" style={{ color: TEAL }}>
                تم تفعيل اشتراكك! يمكنك الآن البدء
              </p>
            </div>
          ) : step === 1 ? (
            /* Step 1 — Welcome */
            <div className="text-center">
              <div className="mb-5 flex justify-center">
                <Logo />
              </div>
              <h2 className="mb-2 text-2xl font-black text-[#1b1730]">مرحباً بك في EnglishX50 👋</h2>
              <p className="mb-7 text-[14px] text-[#7a7596]">سنحتاج بعض المعلومات للبدء</p>
              <button
                onClick={() => setStep(needsOnboarding ? 2 : 3)}
                className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
                style={{ backgroundColor: PURPLE }}
              >
                ابدأ
              </button>
            </div>
          ) : step === 2 ? (
            /* Step 2 — Info form */
            <div>
              <h2 className="mb-1 text-center text-xl font-extrabold text-[#1b1730]">بياناتك</h2>
              <p className="mb-5 text-center text-[13px] text-[#7a7596]">
                تساعدنا نخدمك بشكل أفضل خلال التحدي
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[13px] font-bold text-[#1b1730]">اسمك الكامل</label>
                  <input
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value)
                      setInfoError(null)
                    }}
                    className={input}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-bold text-[#1b1730]">رقم هاتفك</label>
                  <input
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      setInfoError(null)
                    }}
                    className={input}
                    inputMode="tel"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-bold text-[#1b1730]">وظيفتك</label>
                  <input value={job} onChange={(e) => setJob(e.target.value)} className={input} />
                </div>
              </div>
              {infoError && (
                <p className="mt-3 text-center text-[13px] font-semibold" style={{ color: CORAL }}>
                  {infoError}
                </p>
              )}
              <button
                onClick={submitInfo}
                disabled={savingInfo}
                className="mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
                style={{ backgroundColor: PURPLE }}
              >
                {savingInfo ? 'جارٍ الحفظ…' : 'التالي'}
              </button>
            </div>
          ) : (
            /* Step 3 — Code redemption */
            <div>
              <h2 className="mb-1 text-center text-xl font-extrabold text-[#1b1730]">أدخل كود الاشتراك</h2>
              <p className="mb-5 text-center text-[13px] text-[#7a7596]">الكود مكون من أحرف وأرقام</p>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setCodeError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && activateCode()}
                placeholder="مثال: X50-AB12-CD34"
                className={input}
                autoFocus
              />
              {codeError && (
                <p className="mt-3 text-center text-[13px] font-semibold" style={{ color: CORAL }}>
                  {codeError}
                </p>
              )}
              <button
                onClick={activateCode}
                disabled={activating}
                className="mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
                style={{ backgroundColor: PURPLE }}
              >
                {activating ? 'جارٍ التفعيل…' : 'تفعيل'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
