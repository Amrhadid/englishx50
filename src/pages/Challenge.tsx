import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { OnboardingProvider } from '../context/OnboardingContext'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'
import Splash from '../components/Splash'
import RedeemPanel from '../components/RedeemPanel'
import StudentHome from './StudentHome'

/**
 * «ابدأ التحدي» (/challenge).
 *
 * The only place a code is ever asked for. A subscriber signs in with Google;
 * if the account hasn't redeemed yet (or the code came in on ?code=), the
 * RedeemPanel handles activation, and the challenges appear as soon as
 * `premiumActive` flips.
 */
export default function Challenge() {
  return (
    <OnboardingProvider>
      <ChallengeInner />
    </OnboardingProvider>
  )
}

function ChallengeInner() {
  const { premiumActive, loading } = useOnboardingContext()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // A code can arrive as ?code= (e.g. from the speaking page). Read it on the
  // first render and strip it from the URL so it doesn't linger in the bar.
  const [initialCode] = useState<string | undefined>(() => searchParams.get('code') ?? undefined)
  useEffect(() => {
    if (initialCode) setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <Splash />
  if (premiumActive || isAdminEmail(user?.email)) return <StudentHome />
  return <RedeemPanel initialCode={initialCode} />
}
