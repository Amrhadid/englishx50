import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { UI } from '../lib/theme'

/**
 * The single site header: wordmark, the three destinations, and whatever else
 * the page needs on the far side.
 */
const NAV = [
  { to: '/challenge', label: 'ادخل التحدي' },
  { to: '/join', label: 'اشترك' },
  { to: '/reviews', label: 'آراء الطلاب' },
]

export default function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b bg-white" style={{ borderColor: UI.line }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-5 sm:px-8" dir="rtl">
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

        <nav className="order-3 flex w-full items-center justify-center gap-6 sm:order-none sm:w-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="text-[15px] font-bold transition hover:opacity-70"
              style={({ isActive }) => ({
                color: isActive ? UI.pinkInk : UI.ink,
                textDecoration: isActive ? 'underline' : 'none',
                textUnderlineOffset: '6px',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">{children}</div>
      </div>
    </header>
  )
}
