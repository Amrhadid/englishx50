import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  /** False until the session has been resolved (or there is no Supabase client). */
  ready: boolean
}

// The session is resolved once per page load and shared by every useAuth()
// caller. Previously each caller kept its own state, so a component mounting
// later — a modal opened mid-session, say — started at `user = null` and only
// learned the real account a tick later. Anything reading user-scoped data at
// mount (localStorage keys such as the video resume position) therefore looked
// up the anonymous key and came back empty.
let state: AuthState = { user: null, ready: !supabase }
const subscribers = new Set<() => void>()
let started = false

function publish(next: AuthState) {
  state = next
  subscribers.forEach((notify) => notify())
}

function startAuth() {
  if (started || !supabase) return
  started = true
  supabase.auth.getSession().then(({ data }) => {
    publish({ user: data.session?.user ?? null, ready: true })
  })
  // Kept for the lifetime of the page: the state is a module-level singleton,
  // so there is no per-component subscription to tear down.
  supabase.auth.onAuthStateChange((_event, session) => {
    publish({ user: session?.user ?? null, ready: true })
  })
}

function subscribe(notify: () => void): () => void {
  startAuth()
  subscribers.add(notify)
  return () => {
    subscribers.delete(notify)
  }
}

export function useAuth() {
  // Subscribing to the shared store (rather than keeping per-component state)
  // means a component mounting after the session resolved sees the account on
  // its very first render.
  const snapshot = useSyncExternalStore(subscribe, () => state)

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
    publish({ user: null, ready: true })
  }

  return { user: snapshot.user, authReady: snapshot.ready, signInWithGoogle, signOut }
}
