import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OnboardingProvider } from '../context/OnboardingContext'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'
import SpeakLoading from './components/SpeakLoading'
import PremiumGate from './PremiumGate'
import SpeakScreen from './SpeakScreen'
import { createSupabaseSpeakApi } from './api'
import { createMockSpeakApi } from './mockApi'
import { devMockFailure, devMockGate, speakDevMockEnabled } from './devMock'
import { POST_SIGNIN_KEY } from './constants'
import { T } from './text'
import type { SpeakApi } from './types'

/**
 * /speak — premium AI speaking partner.
 *
 * Gate order, same signals the rest of the site uses:
 *   1. auth still resolving            → loading
 *   2. signed out                      → the existing sign-in page (/challenge)
 *   3. subscription still resolving    → loading
 *   4. signed in, not premium/admin    → PremiumGate (no session, no mic, no API)
 *   5. premium or admin                → SpeakScreen
 * The Edge Function re-checks 2 and 4 on every call, so the client gate is a
 * courtesy, not the boundary.
 */
export default function SpeakPage({ api }: { api?: SpeakApi }) {
  return (
    <OnboardingProvider>
      <SpeakGate api={api} />
    </OnboardingProvider>
  )
}

function SpeakGate({ api: apiOverride }: { api?: SpeakApi }) {
  const { user, authReady } = useAuth()
  const { premiumActive, loading } = useOnboardingContext()
  const navigate = useNavigate()
  const [lostAccess, setLostAccess] = useState(false)

  // Dev-only overrides (tree-shaken out of production builds).
  const mockGate = import.meta.env.DEV && speakDevMockEnabled() ? devMockGate() : null
  const api = useMemo<SpeakApi>(() => {
    if (apiOverride) return apiOverride
    if (import.meta.env.DEV && speakDevMockEnabled()) return createMockSpeakApi({ fail: devMockFailure() })
    return createSupabaseSpeakApi()
  }, [apiOverride])

  const resolvedAuth = mockGate ? mockGate !== 'auth-loading' : authReady
  const signedIn = mockGate ? mockGate !== 'anon' && mockGate !== 'auth-loading' : !!user
  const resolvedPremium = mockGate ? mockGate !== 'loading' : !loading
  const premium = mockGate ? mockGate === 'premium' : premiumActive || isAdminEmail(user?.email)
  const userId = mockGate ? 'dev-mock-user' : (user?.id ?? null)

  const redirect = resolvedAuth && !signedIn
  useEffect(() => {
    if (!redirect) return
    // The existing auth flow stashes an intended destination here; keep /speak
    // in it so a future consumer of the slot can bring the learner back.
    try {
      sessionStorage.setItem(POST_SIGNIN_KEY, '/speak')
    } catch {
      /* ignore */
    }
    navigate('/challenge', { replace: true })
  }, [redirect, navigate])

  if (!resolvedAuth) return <SpeakLoading label={T.loadingAuth} />
  if (!signedIn) return <SpeakLoading label={T.loadingAuth} />
  if (!resolvedPremium) return <SpeakLoading label={T.loadingPremium} />
  if (!premium || lostAccess || !userId) return <PremiumGate />
  return <SpeakScreen api={api} userId={userId} onEntitlementLost={() => setLostAccess(true)} />
}
