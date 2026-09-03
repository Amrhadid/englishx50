// Development-only switches for /speak. Everything here is behind
// `import.meta.env.DEV`, which Vite replaces with `false` in production
// builds, so the mock never ships.

export type DevGate = 'anon' | 'free' | 'premium' | 'loading' | 'auth-loading'

export function speakDevMockEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_SPEAK_MOCK === '1'
}

function param(name: string): string | null {
  if (!speakDevMockEnabled() || typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get(name)
  } catch {
    return null
  }
}

/** `?mock=anon|free|premium|loading|auth-loading` forces a gate state. */
export function devMockGate(): DevGate | null {
  const v = param('mock')
  return v === 'anon' || v === 'free' || v === 'premium' || v === 'loading' || v === 'auth-loading' ? v : null
}

/** `?fail=<step>` makes the mock API fail at one step (see mockApi.ts). */
export function devMockFailure(): string | null {
  return param('fail')
}
