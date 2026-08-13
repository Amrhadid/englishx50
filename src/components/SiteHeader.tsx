import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { UI } from '../lib/theme'

/**
 * The single site header: wordmark on one side, whatever the page needs on the
 * other. Deliberately plain — every destination is a section of the page, so
 * there is no nav to speak of.
 */
export default function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b bg-white" style={{ borderColor: UI.line }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8" dir="rtl">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-black text-white"
            style={{ backgroundColor: UI.pink }}
          >
            50
          </span>
          <span className="text-[22px] font-black tracking-tight" style={{ color: UI.ink }}>
            English<span style={{ color: UI.pinkInk }}>X50</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">{children}</div>
      </div>
    </header>
  )
}
