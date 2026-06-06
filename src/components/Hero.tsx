import voiceChat from '../assets/Voice chat-pana.svg'

interface HeroProps {
  onStart: () => void
}

const PROGRESS = [
  { label: 'Speaking', value: 86, color: '#8B5CF6' },
  { label: 'Vocabulary', value: 54, color: '#F59E0B' },
  { label: 'Confidence', value: 72, color: '#EC4899' },
]

const AVATARS = [
  { letter: 'م', bg: '#8B5CF6' },
  { letter: 'أ', bg: '#EC4899' },
  { letter: 'ف', bg: '#F59E0B' },
  { letter: 'س', bg: '#1b1730' },
  { letter: 'ه', bg: '#0F6E56' },
]

const STATS = [
  { n: '50', l: 'Days', color: '#8B5CF6' },
  { n: '10', l: 'Challenges', color: '#EC4899' },
  { n: '2,000+', l: 'Students', color: '#F59E0B' },
  { n: '100%', l: 'Guaranteed', color: '#1b1730' },
]

export default function Hero({ onStart }: HeroProps) {
  return (
    <section className="bg-[#ECEAFF]">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 sm:px-8 md:grid-cols-[1.15fr_1fr] md:py-16">
        {/* Left — copy */}
        <div className="flex flex-col" dir="rtl">
          <span className="mb-5 inline-flex items-center gap-2 self-start rounded-full border border-[#e8e3ff] bg-white px-4 py-1.5 text-[12px] font-extrabold text-[#8B5CF6]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#EC4899]" />
            تحدي ٥٠ يوم للإنجليزية
          </span>

          <h1 className="mb-5 text-[38px] font-black leading-[1.15] text-[#1b1730] sm:text-[46px]" dir="ltr">
            <span className="text-[#EC4899]">EnglishX50</span>
            <br />
            <span className="text-[#8B5CF6]">50 Days</span> Hard Work
            <br />
            = Years of Progress
          </h1>

          <p
            className="mb-7 max-w-md self-start rounded-xl border-r-[3px] border-[#EC4899] bg-white px-4 py-3 text-[14px] font-bold leading-relaxed text-[#5a5570]"
            dir="ltr"
          >
            Unorganized effort gets you nowhere — one structured challenge changes everything.
          </p>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-start" dir="ltr">
            <button
              onClick={onStart}
              className="rounded-full bg-[#1b1730] px-7 py-3.5 text-[14px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#8B5CF6]"
            >
              Start Now →
            </button>
            <a
              href="#challenges"
              className="rounded-full border-2 border-[#8B5CF6] bg-white px-7 py-3 text-center text-[14px] font-extrabold text-[#8B5CF6] transition hover:bg-[#8B5CF6] hover:text-white"
            >
              See Challenges
            </a>
          </div>

          {/* Social proof */}
          <div className="mt-7 flex items-center gap-3 self-start rounded-2xl bg-white px-4 py-2.5 shadow-sm" dir="ltr">
            <div className="flex">
              {AVATARS.map((a, i) => (
                <span
                  key={a.letter}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#ECEAFF] text-[9px] font-extrabold text-white"
                  style={{ background: a.bg, marginLeft: i === 0 ? 0 : -8 }}
                >
                  {a.letter}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-black text-[#1b1730]">+2,000 students joined</span>
              <span className="flex items-center gap-1 text-[13px] text-[#F59E0B]">
                ★★★★★
                <span className="mr-1 text-[10px] font-bold text-[#8b85a0]">5.0 — Rated by students</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right — illustration card */}
        <div className="relative flex items-center justify-end px-2 py-12 sm:py-10">
          {/* Floating progress card (top-left corner) */}
          <div
            className="absolute -left-2 top-0 z-10 w-[190px] rounded-2xl border border-[#f0eeff] bg-white p-3.5 shadow-xl shadow-[#8B5CF6]/10 sm:-left-4"
            dir="ltr"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3F0FF] text-lg">🎤</span>
              <div>
                <p className="text-[12px] font-extrabold text-[#1b1730]">Your Progress</p>
                <p className="text-[10px] font-semibold text-[#8b85a0]">50-Day Challenge</p>
              </div>
            </div>
            {PROGRESS.map((p) => (
              <div key={p.label} className="mb-2.5 last:mb-0">
                <div className="mb-1 flex justify-between text-[10px] font-bold">
                  <span className="text-[#5a5570]">{p.label}</span>
                  <span style={{ color: p.color }}>{p.value}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f0eeff]">
                  <div className="h-full rounded-full" style={{ width: `${p.value}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Illustration card */}
          <div className="ml-auto w-full max-w-[330px] shrink-0 rounded-[40px] bg-white p-7 shadow-2xl shadow-[#8B5CF6]/15">
            <img src={voiceChat} alt="AI voice coaching" className="w-full" />
          </div>

          {/* AI Coach badge (bottom-right corner) */}
          <div
            className="absolute -bottom-2 -right-2 z-10 flex items-center gap-2 rounded-2xl border border-[#f0eeff] bg-white px-3.5 py-2.5 text-[12px] font-extrabold text-[#8B5CF6] shadow-xl shadow-[#8B5CF6]/10 sm:-right-3"
            dir="ltr"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
            </span>
            AI Coach — Live
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 border-t border-[#f0eeff] bg-white sm:grid-cols-4">
        {STATS.map((s, i) => (
          <div
            key={s.l}
            className={`px-5 py-4 text-center ${i !== 0 ? 'border-r border-[#f0eeff] sm:border-l sm:border-r-0' : ''}`}
          >
            <div className="text-[22px] font-black" style={{ color: s.color }}>
              {s.n}
            </div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8b85a0]">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
