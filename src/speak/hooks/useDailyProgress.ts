// Today's persisted speaking time for the signed-in learner, read from their
// own x50_speaking_turns rows (RLS lets a user read only their own). The
// screen adds the current session's seconds on top. When the table is not
// reachable (not created yet, offline) the bar simply starts from zero for
// this session — nothing is invented.

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface DailyProgress {
  /** Seconds spoken today before this session started. */
  baseSeconds: number
  /** 'db' when the value came from persisted turns, 'session' otherwise. */
  source: 'db' | 'session'
  loaded: boolean
}

function localDayStartIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useDailyProgress(userId: string | null): DailyProgress {
  const [state, setState] = useState<DailyProgress>({ baseSeconds: 0, source: 'session', loaded: false })

  useEffect(() => {
    let active = true
    const db = supabase
    if (!db || !userId) {
      queueMicrotask(() => {
        if (active) setState({ baseSeconds: 0, source: 'session', loaded: true })
      })
      return () => {
        active = false
      }
    }
    db.from('x50_speaking_turns')
      .select('speaking_seconds')
      .eq('user_id', userId)
      .gte('created_at', localDayStartIso())
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data) {
          setState({ baseSeconds: 0, source: 'session', loaded: true })
          return
        }
        const total = (data as { speaking_seconds: number | string | null }[]).reduce(
          (sum, r) => sum + (Number(r.speaking_seconds) || 0),
          0,
        )
        setState({ baseSeconds: Math.round(total), source: 'db', loaded: true })
      })
    return () => {
      active = false
    }
  }, [userId])

  return state
}
