import { useState } from 'react'

const VIDEO_ID = '0FeUVNqAQm8'
const THUMB = `https://img.youtube.com/vi/${VIDEO_ID}/maxresdefault.jpg`

export default function IntroVideo() {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="mx-auto max-w-4xl px-5 pb-4 sm:px-8">
      <div className="relative aspect-video w-full overflow-hidden rounded-[32px] border border-[#efeafc] shadow-[0_18px_50px_-20px_rgba(124,111,240,0.5)]">
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
            title="الفيديو التعريفي — EnglishX50"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2a2350 0%, #4b3fa0 55%, #7C6FF0 100%)' }}
            aria-label="شاهد الفيديو التعريفي"
          >
            <img
              src={THUMB}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:opacity-80"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-[#1b1730]/60 to-transparent" />

            <span className="absolute right-6 top-5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold text-white backdrop-blur" dir="rtl">
              ٢ دقيقة
            </span>
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl transition group-hover:scale-110">
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-8 w-8 text-[#7C6FF0]" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5-11-6.5Z" />
              </svg>
            </span>
            <p className="absolute bottom-6 text-sm font-semibold text-white/90">شاهد الفيديو التعريفي 🎬</p>
          </button>
        )}
      </div>
    </div>
  )
}
