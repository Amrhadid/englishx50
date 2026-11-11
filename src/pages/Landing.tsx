import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { OnboardingProvider } from '../context/OnboardingContext'
import { useAuth } from '../hooks/useAuth'
import Home from './Home'

const POST_SIGNIN_KEY = 'x50_post_signin'

/**
 * Google sign-in always returns to the bare origin (see useAuth). When the
 * sign-in was started with a path intent (e.g. '/join'), send the visitor back
 * there. Non-path intents (such as '?redeem=1') are left untouched.
 */
function PostSignInRedirect() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    let next: string | null
    try {
      next = sessionStorage.getItem(POST_SIGNIN_KEY)
    } catch {
      return
    }
    if (!next || !next.startsWith('/') || next.startsWith('//')) return
    try {
      sessionStorage.removeItem(POST_SIGNIN_KEY)
    } catch {
      /* ignore */
    }
    navigate(next, { replace: true })
  }, [user, navigate])

  return null
}

/**
 * The site root (`/`). Home needs the onboarding state to know whether the
 * visitor is already subscribed (which of the three sections to emphasise), so
 * the provider is mounted here.
 */
export default function Landing() {
  return (
    <OnboardingProvider>
      <PostSignInRedirect />
      <Home />
    </OnboardingProvider>
  )
}
