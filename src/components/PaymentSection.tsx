import { useEffect, useState } from 'react'
import { UI } from '../lib/theme'
import { ERROR_COLOR, fieldClass } from '../lib/form'
import { useAuth } from '../hooks/useAuth'
import { activatePromo, fetchActivePromo, formatCountdown } from '../lib/promo'

const FULL_PRICE = { amount: '6000', link: 'https://paymob.link/y6Aac' }

/**
 * Promo codes (matched case-insensitively) → discounted Paymob link. Validity
 * is decided server-side (x50_activate_promo): a code only works for a
 * signed-in user, lasts 6 hours from first activation, and can't be reused.
 */
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
  // Tagged with the account it belongs to, so switching accounts drops it.
  const [activation, setActivation] = useState<{ userId: string; code: string; expiresAt: number } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const userId = user?.id
  // Restore a still-running activation (e.g. after a reload) for this account.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchActivePromo().then((a) => {
      if (!cancelled && a && PROMO_CODES[a.code]) {
        setNow(Date.now())
        setActivation({ userId, code: a.code, expiresAt: new Date(a.expiresAt).getTime() })
      }
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const applied = activation && activation.userId === userId ? activation : null
  const remaining = applied ? applied.expiresAt - now : 0
  const active = applied !== null && remaining > 0
  const expired = applied !== null && !active

  // Tick the countdown while the discount is running.
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])

  const offer = (applied && active && PROMO_CODES[applied.code]) || FULL_PRICE
  const message = error || (expired ? 'انتهت صلاحية كود الخصم' : '')

  const apply = async () => {
    const key = code.trim().toLowerCase()
    if (!key || busy) return
    if (!PROMO_CODES[key]) {
      setActivation(null)
      setError('كود الخصم غير صحيح')
      return
    }
    setBusy(true)
    const res = await activatePromo(key)
    setBusy(false)
    if (res.status === 'active' && userId) {
      setNow(Date.now())
      setActivation({ userId, code: res.code, expiresAt: new Date(res.expiresAt).getTime() })
      setError('')
    } else {
      setActivation(null)
      setError(
        res.status === 'expired'
          ? 'الكود ده اتستخدم قبل كده وانتهت صلاحيته'
          : res.status === 'invalid'
            ? 'كود الخصم غير صحيح'
            : res.status === 'unauthenticated'
              ? 'سجّل دخولك الأول عشان تستخدم الكود'
              : 'حصلت مشكلة، جرّب تاني',
      )
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
                {active && (
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
                    className={fieldClass(Boolean(message))}
                    aria-invalid={Boolean(message)}
                  />
                  <button
                    type="button"
                    onClick={apply}
                    disabled={busy}
                    className="shrink-0 rounded-[12px] px-5 text-[16px] font-bold text-white transition hover:brightness-110"
                    style={{ backgroundColor: UI.ink }}
                  >
                    تطبيق
                  </button>
                </div>
                {message && (
                  <p className="mt-2 text-[14px] font-bold" style={{ color: ERROR_COLOR }}>
                    {message}
                  </p>
                )}
                {active && (
                  <p className="mt-2 text-[14px] font-bold" style={{ color: '#16A34A' }}>
                    تم تطبيق كود الخصم ✓ — ينتهي خلال{' '}
                    <span dir="ltr" data-testid="promo-countdown">
                      {formatCountdown(remaining)}
                    </span>
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
