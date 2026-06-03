interface NavbarProps {
  onStart: () => void
}

export default function Navbar({ onStart }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b-[0.5px] border-[#eee] bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
        <a href="#" className="flex items-center gap-2">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#534AB7] text-[13px] font-extrabold text-white">
            50
          </span>
          <span className="text-base font-bold text-[#111]">EnglishX50</span>
        </a>

        <div className="flex items-center gap-5">
          <a href="#challenges" className="hidden text-sm text-[#666] hover:text-[#534AB7] sm:inline">
            التحديات
          </a>
          <a href="#reviews" className="hidden text-sm text-[#666] hover:text-[#534AB7] sm:inline">
            آراء الطلاب
          </a>
          <button
            onClick={onStart}
            className="rounded-[10px] bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#46409c]"
          >
            ابدأ التحدي
          </button>
        </div>
      </nav>
    </header>
  )
}
