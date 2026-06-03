import { BRAND_GRADIENT } from '../lib/theme'

interface NavbarProps {
  onStart: () => void
}

export default function Navbar({ onStart }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/60 bg-white/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <a href="#" className="flex items-center gap-2.5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-extrabold text-white shadow-lg shadow-[#7C6FF0]/30"
            style={{ background: BRAND_GRADIENT }}
          >
            50
          </span>
          <span className="text-[17px] font-extrabold tracking-tight text-[#1b1730]">
            English<span className="text-[#7C6FF0]">X50</span>
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-5">
          <a
            href="#challenges"
            className="hidden rounded-full px-3 py-2 text-sm font-semibold text-[#6b6685] transition hover:bg-[#f1edff] hover:text-[#7C6FF0] sm:inline-block"
          >
            التحديات
          </a>
          <a
            href="#reviews"
            className="hidden rounded-full px-3 py-2 text-sm font-semibold text-[#6b6685] transition hover:bg-[#f1edff] hover:text-[#7C6FF0] sm:inline-block"
          >
            آراء الطلاب
          </a>
          <button
            onClick={onStart}
            className="rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#A964F0]/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#A964F0]/40"
            style={{ background: BRAND_GRADIENT }}
          >
            ابدأ التحدي
          </button>
        </div>
      </nav>
    </header>
  )
}
