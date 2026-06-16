const STATS = [
  { n: '50', l: 'يوم', sub: 'Days', icon: '📅', color: '#8B5CF6', soft: '#F1ECFF' },
  { n: '10', l: 'تحديات', sub: 'Challenges', icon: '🎯', color: '#EC4899', soft: '#FDEAF3' },
  { n: '+2,000', l: 'طالب', sub: 'Students', icon: '👥', color: '#F59E0B', soft: '#FEF2DD' },
  { n: '100%', l: 'ضمان', sub: 'Guaranteed', icon: '✅', color: '#0C7C62', soft: '#D8FAF0' },
]

/**
 * Attractive stats row used on the homepage hero and the program page.
 * Replaces the old flat divider strip with lifted gradient stat cards.
 */
export default function StatsStrip() {
  return (
    <div className="bg-[#ECEAFF] px-4 pb-8 pt-2 sm:px-6">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.sub}
            className="group relative overflow-hidden rounded-[22px] border border-white bg-white p-4 text-center shadow-[0_10px_30px_-18px_rgba(124,111,240,0.6)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(124,111,240,0.7)] sm:p-5"
          >
            {/* Soft top accent bar */}
            <span
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: `linear-gradient(90deg, ${s.color}, ${s.color}55)` }}
            />
            <span
              className="mx-auto mb-2.5 mt-1 flex h-11 w-11 items-center justify-center rounded-2xl text-xl transition group-hover:scale-110 sm:h-12 sm:w-12"
              style={{ backgroundColor: s.soft }}
            >
              {s.icon}
            </span>
            <div className="text-[26px] font-black leading-none tabular-nums sm:text-[30px]" style={{ color: s.color }}>
              {s.n}
            </div>
            <div className="mt-1.5 text-[13px] font-extrabold text-[#1b1730]" dir="rtl">
              {s.l}
            </div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#a39ec0]">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
