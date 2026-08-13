import { OnboardingProvider } from '../context/OnboardingContext'
import Home from './Home'

/**
 * The site root (`/`). Home needs the onboarding state to know whether the
 * visitor is already subscribed (which of the three sections to emphasise), so
 * the provider is mounted here.
 */
export default function Landing() {
  return (
    <OnboardingProvider>
      <Home />
    </OnboardingProvider>
  )
}
