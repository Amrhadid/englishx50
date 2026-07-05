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

  // Start Google OAuth. `next` is an optional post-sign-in intent (e.g.
  // '?redeem=1') used to bring the user back to a specific spot — e.g. reopen
  // the code entry once they're authenticated.
  //
  // We deliberately always redirect to the *bare* site origin and stash `next`
  // in sessionStorage instead of appending it to `redirectTo`. A bare-origin
  // URL is the one most reliably present in the Supabase project's allowed
  // Redirect URLs; a variant like `${origin}/?redeem=1` that isn't allow-listed
  // makes Supabase silently fall back to the project's Site URL. If that Site
  // URL is a different origin (e.g. www vs apex, or a stale preview), the
  // session is written to that other origin's storage and the user lands back
  // here looking signed-out — the "auto sign-out after Google" symptom.
  // sessionStorage survives the OAuth round-trip within the same tab/origin.
  const signInWithGoogle = (next?: string) => {
    if (!supabase) return
    if (next) {
      try {
        sessionStorage.setItem('x50_post_signin', next)
      } catch {
        /* ignore */
      }
    }
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
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
