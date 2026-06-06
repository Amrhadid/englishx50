import { useContext } from 'react'
import { OnboardingContext } from '../context/OnboardingContext'
import type { OnboardingContextValue } from '../context/OnboardingContext'

/** Access the shared onboarding state. Must be used within <OnboardingProvider>. */
export function useOnboardingContext(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error('useOnboardingContext must be used within an OnboardingProvider')
  }
  return ctx
}
