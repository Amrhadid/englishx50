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

  const needsOnboarding = !!user && !loading && student === null
  const needsCode = !!user && !loading && student !== null && !student.code
  const daysLeft = student?.code_redeemed_at
    ? PROGRAM_DAYS - daysSince(student.code_redeemed_at)
    : 0

  return { needsOnboarding, needsCode, daysLeft, student, refetch, loading }
}
