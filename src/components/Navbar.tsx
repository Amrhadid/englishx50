import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import DaysLeftBadge from './DaysLeftBadge'
import { supabase } from '../lib/supabase'
import { isAdminEmail } from '../lib/admin'

interface NavbarProps {
  onStart: () => void
  // Optional shortcut for existing buyers to redeem a code / sign in without
  // going through the program page first.
  onRedeem?: () => void
}

export default function Navbar({ onStart, onRedeem }: NavbarProps) {
  const { user, signOut } = useAuth()
  const { daysLeft, student } = useOnboardingContext()
  const location = useLocation()
  const navigate = useNavigate()

  const scrollToId = (id: string) => {
    if (location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/')
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 300)
    }
  }

  // Show the days-left badge to a signed-in account that redeemed a code
  // (including after expiry, so it reads "انتهى اشتراكك"). DB-driven.
  const hasWindow = !!student?.code

  const signInWithGoogle = () => {
    if (!supabase) return
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#f0eeff] bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#8B5CF6] text-[12px] font-black text-white">
            50
          </span>
          <span className="text-[17px] font-black tracking-tight text-[#1b1730]">
            English<span className="text-[#8B5CF6]">X50</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => scrollToId('challenges')}
            className="hidden rounded-full px-3.5 py-2 text-sm font-bold text-[#6b6685] transition hover:bg-[#f1edff] hover:text-[#8B5CF6] sm:inline-block"
          >
            التحديات
          </button>
          <button
            onClick={() => scrollToId('reviews')}
            className="hidden rounded-full px-3.5 py-2 text-sm font-bold text-[#6b6685] transition hover:bg-[#f1edff] hover:text-[#8B5CF6] sm:inline-block"
          >
            آراء الطلاب
          </button>
          {onRedeem && (
            <button
              onClick={onRedeem}
              className="hidden rounded-full px-3.5 py-2 text-sm font-bold text-[#6b6685] transition hover:bg-[#f1edff] hover:text-[#8B5CF6] sm:inline-block"
            >
              عندك كود؟
            </button>
          )}
          <button
            onClick={onStart}
            className="rounded-full bg-[#1b1730] px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#8B5CF6]"
          >
            ابدأ التحدي
          </button>

          {hasWindow && <DaysLeftBadge daysLeft={daysLeft} />}
          {hasWindow && daysLeft <= 0 && (
            <button
              onClick={onStart}
              className="rounded-full bg-[#993C1D] px-4 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110"
            >
              تجديد الاشتراك
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              {isAdminEmail(user.email) && (
                <Link
                  to="/admin"
                  className="rounded-full bg-[#534AB7] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#46409c]"
                >
                  Admin
                </Link>
              )}
              {user.user_metadata.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata.full_name ?? ''}
                  className="h-9 w-9 rounded-full object-cover"
                />
              )}
              <span className="hidden text-sm font-bold text-[#1b1730] sm:inline-block">
                {user.user_metadata.full_name}
              </span>
              <button
                onClick={signOut}
                className="rounded-full px-3 py-2 text-sm font-bold text-[#6b6685] transition hover:bg-[#f1edff] hover:text-[#8B5CF6]"
              >
                خروج
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="rounded-full border border-[#e7e3ff] px-4 py-2.5 text-sm font-extrabold text-[#1b1730] transition hover:bg-[#f1edff] hover:text-[#8B5CF6]"
            >
              الدخول بـ Google
            </button>
          )}
        </div>
      </nav>
    </header>
  )
}
