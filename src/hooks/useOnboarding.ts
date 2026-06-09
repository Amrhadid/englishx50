import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import type { Student } from '../types'

const PROGRAM_DAYS = 100

/** Whole days elapsed since an ISO timestamp (0 if missing). */
function daysSince(iso: string | null): number {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / 86_400_000)
}

/**
 * Drives the onboarding + subscription gate for the logged-in user.
 *
 * - no x50_students row        -> needsOnboarding
 * - row exists but code is null -> needsCode
 * - row with a redeemed code    -> daysLeft = 100 - daysSince(code_redeemed_at)
 */
export function useOnboarding() {
  const { user } = useAuth()
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!supabase || !user) {
      setStudent(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('x50_students')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    setStudent((data as Student | null) ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Keep the activity identity in sync with the signed-in account (matches the
  // code's used_by so the admin Students view attributes activity correctly).
  useEffect(() => {
    if (student?.name) {
      try {
        localStorage.setItem('x50_user', `${student.name} - ${student.job ?? ''}`.trim())
      } catch {
        /* ignore */
      }
    }
  }, [student])

  const needsOnboarding = !!user && !loading && student === null
  const needsCode = !!user && !loading && student !== null && !student.code
  const daysLeft = student?.code_redeemed_at
    ? PROGRAM_DAYS - daysSince(student.code_redeemed_at)
    : 0

  // Premium is now DB-driven and tied to the signed-in account: active only
  // while a redeemed code's 100-day window is still open. Durable across
  // devices / cache clears (re-evaluated from the DB on sign-in) and not
  // shareable (a used code can't be redeemed by another account).
  const premiumActive = !!student?.code && daysLeft > 0

  return { needsOnboarding, needsCode, daysLeft, premiumActive, student, refetch, loading }
}
