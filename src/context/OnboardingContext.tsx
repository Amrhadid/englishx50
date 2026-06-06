import { createContext } from 'react'
import type { ReactNode } from 'react'
import { useOnboarding } from '../hooks/useOnboarding'

export interface OnboardingContextValue {
  needsOnboarding: boolean
  needsCode: boolean
  daysLeft: number
  student: ReturnType<typeof useOnboarding>['student']
  refetch: () => Promise<void>
  loading: boolean
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null)

/** Single shared instance of the onboarding state for the whole tree. */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const value = useOnboarding()
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}
