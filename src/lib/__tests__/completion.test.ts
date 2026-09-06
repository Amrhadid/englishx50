import { describe, it, expect } from 'vitest'
import { challengeLockState, COOLDOWN_DAYS } from '../completion'
import { allVideosWatched } from '../videoProgress'
import type { Challenge } from '../../types'

const DAY = 86_400_000

function challenge(number: number, extra: Partial<Challenge> = {}): Challenge {
  return {
    id: `c${number}`,
    number,
    title: `Challenge ${number}`,
    video_url: null,
    pdf_url: null,
    speaking_task: null,
    is_locked: false,
    ...extra,
  }
}

describe('challengeLockState', () => {
  const numbers = [1, 2, 3, 4]
  const now = Date.parse('2026-09-06T12:00:00Z')

  it('opens the first challenge', () => {
    expect(challengeLockState(challenge(1), numbers, {}, [], [], now)).toEqual({ locked: false })
  })

  it('locks a challenge until the previous one is complete', () => {
    expect(challengeLockState(challenge(2), numbers, {}, [], [], now)).toEqual({
      locked: true,
      reason: 'prev',
    })
  })

  it('applies the sequential lock to challenges without a source link too', () => {
    const noSource = challenge(4, { pdf_url: null })
    expect(challengeLockState(noSource, numbers, {}, [], [], now)).toEqual({
      locked: true,
      reason: 'prev',
    })
  })

  it('holds the cooldown after completion and opens the moment it ends', () => {
    const completed = new Date(now - 4.5 * DAY).toISOString()
    expect(challengeLockState(challenge(2), numbers, { 1: completed }, [], [], now)).toEqual({
      locked: true,
      reason: 'cooldown',
      daysLeft: 1,
    })
    const justDone = new Date(now - COOLDOWN_DAYS * DAY).toISOString()
    expect(challengeLockState(challenge(2), numbers, { 1: justDone }, [], [], now)).toEqual({
      locked: false,
    })
  })

  it('reports whole days left, rounded up', () => {
    const completed = new Date(now - 0.2 * DAY).toISOString()
    expect(challengeLockState(challenge(3), numbers, { 2: completed }, [], [], now)).toEqual({
      locked: true,
      reason: 'cooldown',
      daysLeft: 5,
    })
  })

  it('honours admin cooldown skips and outright unlocks', () => {
    const completed = new Date(now - DAY).toISOString()
    expect(challengeLockState(challenge(2), numbers, { 1: completed }, [2], [], now)).toEqual({
      locked: false,
    })
    expect(challengeLockState(challenge(3), numbers, {}, [], [3], now)).toEqual({ locked: false })
  })
})

describe('allVideosWatched', () => {
  const c = challenge(1, { videos: [{ title: 'a', uid: 'A' }, { title: 'b', uid: 'B' }] })
  const row = (watched: boolean) => ({ position: 0, maxReached: 0, percent: 0, watched })

  it('needs every video watched on the server', () => {
    expect(allVideosWatched(c, { A: row(true) })).toBe(false)
    expect(allVideosWatched(c, { A: row(true), B: row(false) })).toBe(false)
    expect(allVideosWatched(c, { A: row(true), B: row(true) })).toBe(true)
  })

  it('is never satisfied for a challenge with no videos', () => {
    expect(allVideosWatched(challenge(2), {})).toBe(false)
  })
})
