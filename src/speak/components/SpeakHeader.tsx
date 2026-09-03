import { Link } from 'react-router-dom'
import { T } from '../text'

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Local header: wordmark, back to the dashboard, session settings. */
export default function SpeakHeader({ onSettings }: { onSettings: () => void }) {
  return (
    <header className="spk-safe-top sticky top-0 z-30 border-b border-[#ece7fb] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <Link
            to="/challenge"
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-[#534AB7] transition hover:bg-[#f4f2fc]"
            aria-label={T.back}
            title={T.back}
          >
            <BackIcon />
          </Link>
          <Link to="/" className="flex items-center gap-2" aria-label="EnglishX50">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#534AB7] text-[12px] font-black text-white">
              50
            </span>
            <span className="text-[17px] font-black tracking-tight text-[#1b1730]">
              English<span className="text-[#534AB7]">X50</span>
            </span>
          </Link>
        </div>
        <button
          type="button"
          onClick={onSettings}
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-[#534AB7] transition hover:bg-[#f4f2fc]"
          aria-label={T.settings}
          title={T.settings}
        >
          <GearIcon />
        </button>
      </div>
    </header>
  )
}
