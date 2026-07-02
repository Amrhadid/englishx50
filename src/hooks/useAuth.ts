import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Start Google OAuth. `next` is an optional relative target (e.g. '?redeem=1')
  // appended to the site origin, so we can bring the user back to a specific
  // spot after the sign-in redirect reloads the page — used to reopen the code
  // entry once they're authenticated.
  const signInWithGoogle = (next?: string) => {
    if (!supabase) return
    const redirectTo = next
      ? `${window.location.origin}/${next.replace(/^\/+/, '')}`
      : window.location.origin
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    // Clear the activity identity so it doesn't carry over to the next account
    // signing in on this browser.
    try {
      localStorage.removeItem('x50_user')
    } catch {
      /* ignore */
    }
    setUser(null)
  }

  return { user, signInWithGoogle, signOut }
}
