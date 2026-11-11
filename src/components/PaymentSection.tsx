import { useState } from 'react'
import { UI } from '../lib/theme'
import { ERROR_COLOR, fieldClass } from '../lib/form'
import { useAuth } from '../hooks/useAuth'

const FULL_PRICE = { amount: '6000', link: 'https://paymob.link/y6Aac' }

/** Promo codes (matched case-insensitively) → discounted Paymob link. */
const PROMO_CODES: Record<string, { amount: string; link: string }> = {
  youtube44: { amount: '4400', link: 'https://paymob.link/RDOaq' },
}

/**
 * Paymob payment link for the 50-day challenge, with an optional promo code
 * that swaps in a discounted link. Shown on /join in place of the join form.
 * The price is only shown to signed-in visitors; everyone else gets a Google
 * sign-in button that brings them back here.
 */
export default function PaymentSection() {
  const { user, authReady, signInWithGoogle } = useAuth()
  const [code, setCode] = useState('')
  const [applied, setApplied] = useState<string | null>(null)
  const [error, setError] = useState('')

  const offer = (applied && PROMO_CODES[applied]) || FULL_PRICE

  const apply = () => {
    const key = code.trim().toLowerCase()
    if (!key) return
    if (PROMO_CODES[key]) {
      setApplied(key)
      setError('')
    } else {
      setApplied(null)
      setError('كود الخصم غير صحيح')
    }
  }

  return (
    <section id="payment" className="px-5 py-16 sm:px-8" style={{ backgroundColor: UI.sand }} dir="rtl">
      <div className="mx-auto max-w-xl">
        <div
          className="flex flex-col gap-5 rounded-[20px] border bg-white p-6 text-center sm:p-8"
          style={{ borderColor: UI.line }}
        >
          <h2 className="text-[28px] font-black leading-tight tracking-tight sm:text-[36px]" style={{ color: UI.ink }}>
            اشترك في تحدي ٥٠ يوم
          </h2>

          {!authReady ? (
            <p className="py-6 text-[16px]" style={{ color: UI.muted }}>
              جاري التحميل…
            </p>
          ) : !user ? (
            <>
              <p className="text-[16px] leading-relaxed" style={{ color: UI.muted }}>
                سجّل دخولك عشان تشوف السعر وتكمل الاشتراك.
              </p>
              <button
                type="button"
                onClick={() => signInWithGoogle('/join')}
                className="flex w-full items-center justify-center gap-2 rounded-[16px] px-8 py-5 text-[20px] font-bold transition hover:brightness-95"
                style={{ backgroundColor: UI.pink, color: UI.ink }}
              >
                <span aria-hidden="true">🔑</span>
                الدخول بـ Google
              </button>
            </>
          ) : (
            <>
              <p
                className="flex items-baseline justify-center gap-3 text-[34px] font-black"
                style={{ color: UI.pinkInk }}
              >
                <span dir="ltr">{offer.amount} EGP</span>
                {applied && (
                  <span dir="ltr" className="text-[22px] font-bold line-through" style={{ color: UI.muted }}>
                    {FULL_PRICE.amount} EGP
                  </span>
                )}
              </p>

              <a
                href={offer.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-3 rounded-[16px] px-8 py-5 text-[20px] font-bold transition hover:brightness-95 sm:text-[22px]"
                style={{ backgroundColor: UI.pink, color: UI.ink }}
              >
                اشترك في تحدي ٥٠ يوم {offer.amount} EGP
                <span aria-hidden="true">←</span>
              </a>

              <div className="text-start">
                <label htmlFor="promo-code" className="mb-2 block text-[15px] font-bold" style={{ color: UI.ink }}>
                  عندك كود خصم؟
                </label>
                <div className="flex gap-2">
                  <input
                    id="promo-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && apply()}
                    placeholder="اكتب الكود"
                    dir="ltr"
                    className={fieldClass(Boolean(error))}
                    aria-invalid={Boolean(error)}
                  />
                  <button
                    type="button"
                    onClick={apply}
                    className="shrink-0 rounded-[12px] px-5 text-[16px] font-bold text-white transition hover:brightness-110"
                    style={{ backgroundColor: UI.ink }}
                  >
                    تطبيق
                  </button>
                </div>
                {error && (
                  <p className="mt-2 text-[14px] font-bold" style={{ color: ERROR_COLOR }}>
                    {error}
                  </p>
                )}
                {applied && (
                  <p className="mt-2 text-[14px] font-bold" style={{ color: '#16A34A' }}>
                    تم تطبيق كود الخصم ✓
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
