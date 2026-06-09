import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import DaysLeftBadge from './DaysLeftBadge'
import { supabase } from '../lib/supabase'
import { isAdminEmail } from '../lib/admin'
import { isPremium, getPremiumDaysLeft } from '../lib/premium'

interface NavbarProps {
  onStart: () => void
}

export default function Navbar({ onStart }: NavbarProps) {
  const { user, signOut } = useAuth()
  const { needsOnboarding, needsCode, daysLeft } = useOnboardingContext()

  // Show the days-left badge to any premium user (code-box or signed-in).
  const premium = isPremium()
  const premiumDays = getPremiumDaysLeft()

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

          {premium && (premiumDays != null || (!needsOnboarding && !needsCode)) && (
            <DaysLeftBadge daysLeft={premiumDays ?? daysLeft} />
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
