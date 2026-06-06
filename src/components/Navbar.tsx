interface NavbarProps {
  onStart: () => void
}

export default function Navbar({ onStart }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#f0eeff] bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <a href="#" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#8B5CF6] text-[12px] font-black text-white">
            50
          </span>
          <span className="text-[17px] font-black tracking-tight text-[#1b1730]">
            English<span className="text-[#8B5CF6]">X50</span>
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="#challenges"
            className="hidden rounded-full px-3.5 py-2 text-sm font-bold text-[#6b6685] transition hover:bg-[#f1edff] hover:text-[#8B5CF6] sm:inline-block"
          >
            التحديات
          </a>
          <a
            href="#reviews"
            className="hidden rounded-full px-3.5 py-2 text-sm font-bold text-[#6b6685] transition hover:bg-[#f1edff] hover:text-[#8B5CF6] sm:inline-block"
          >
            آراء الطلاب
          </a>
          <button
            onClick={onStart}
            className="rounded-full bg-[#1b1730] px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#8B5CF6]"
          >
            ابدأ التحدي
          </button>
        </div>
      </nav>
    </header>
  )
}
