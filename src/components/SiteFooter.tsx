import { Link } from 'react-router-dom'
import { UI } from '../lib/theme'

/** Shared footer — one copy instead of the four that had drifted apart. */
export default function SiteFooter() {
  return (
    <footer className="border-t bg-white py-12 text-center" dir="rtl" style={{ borderColor: UI.line }}>
      <div className="mx-auto mb-4 flex items-center justify-center gap-2.5">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black text-white"
          style={{ backgroundColor: UI.pink }}
        >
          50
        </span>
        <span className="text-[18px] font-black tracking-tight" style={{ color: UI.ink }}>
          English<span style={{ color: UI.pinkInk }}>X50</span>
        </span>
      </div>
      <Link to="/terms" className="text-[14px] font-bold underline" style={{ color: UI.ink }}>
        الشروط والأحكام
      </Link>
      <p className="mt-4 text-[14px]" style={{ color: UI.muted }}>
        © {new Date().getFullYear()} EnglishX50 — تحدي جديد كل ٥ أيام
      </p>
    </footer>
  )
}
