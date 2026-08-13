import { Link } from 'react-router-dom'
import { UI, toArabicDigits } from '../lib/theme'
import { TERMS, SUBSCRIBE_REASONS, DONT_SUBSCRIBE_REASONS } from '../lib/terms'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'

/** The public Terms and Conditions page, linked from every footer. */
export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader>
        <Link to="/" className="text-[14px] font-bold underline" style={{ color: UI.muted }}>
          الرئيسية
        </Link>
      </SiteHeader>

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20" dir="rtl">
        <h1
          className="text-center text-[36px] font-black leading-[1.12] tracking-tight sm:text-[52px]"
          style={{ color: UI.ink }}
        >
          الشروط <span style={{ color: UI.pinkInk }}>والأحكام</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-center text-[17px] leading-relaxed" style={{ color: UI.muted }}>
          بالاشتراك في التحدي أنت توافق على البنود التالية — اقرأها كاملة قبل ما تشترك.
        </p>

        <ol className="mt-12 flex flex-col gap-3">
          {TERMS.map((t, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-[18px] border p-5"
              style={{ borderColor: UI.line, backgroundColor: UI.sand }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black"
                style={{ backgroundColor: UI.pink, color: UI.ink }}
              >
                {toArabicDigits(i + 1)}
              </span>
              <span className="text-[16px] leading-relaxed" style={{ color: UI.ink }}>
                {t}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <ReasonCard title="اشترك لو..." items={SUBSCRIBE_REASONS} bullet="✓" />
          <ReasonCard title="متشتركش لو..." items={DONT_SUBSCRIBE_REASONS} bullet="✕" />
        </div>

        <Link
          to="/join"
          className="mt-12 flex items-center justify-center gap-2 rounded-[14px] px-6 py-4 text-[18px] font-bold transition hover:brightness-95"
          style={{ backgroundColor: UI.pink, color: UI.ink }}
        >
          انضم للتحدي
          <span aria-hidden="true">←</span>
        </Link>
      </main>

      <SiteFooter />
    </div>
  )
}

function ReasonCard({ title, items, bullet }: { title: string; items: string[]; bullet: string }) {
  return (
    <div className="rounded-[20px] border p-6" style={{ borderColor: UI.line }}>
      <h2 className="mb-5 text-[22px] font-black tracking-tight" style={{ color: UI.ink }}>
        {title}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: UI.muted }}>
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
              style={{ backgroundColor: UI.pinkSoft, color: UI.pinkInk }}
            >
              {bullet}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
