// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isScenarioId } from '../scenarios'
import type { SpeakApi } from '../types'

// The page reads the same two signals the rest of the site uses; stub them.
const auth = { user: null as null | { id: string; email?: string }, authReady: true }
const onboarding = { premiumActive: false, loading: false }

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../../hooks/useOnboardingContext', () => ({ useOnboardingContext: () => onboarding }))
vi.mock('../../context/OnboardingContext', () => ({
  OnboardingProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }))

import SpeakPage from '../SpeakPage'

function fakeApi(): SpeakApi & { session: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> } {
  const conversation = {
    id: 'conv-1',
    scenario: 'daily' as const,
    level: 'intermediate' as const,
    status: 'active' as const,
    speakingSeconds: 0,
    goalSeconds: 300,
    startedAt: '2026-09-03T10:00:00Z',
    completedAt: null,
    opener: 'Hi! What was the best part of your day?',
    turns: [],
  }
  return {
    session: vi.fn(async () => ({ ok: true as const, current: null, nextAvailableAt: null, history: [] })),
    conversation: vi.fn(async () => ({ ok: true as const, conversation })),
    start: vi.fn(async () => ({ ok: true as const, conversation, reply: conversation.opener, audio: null, resumed: false })),
    transcribe: vi.fn(async () => ({ ok: true as const, transcript: 'x' })),
    respond: vi.fn(async () => ({
      ok: true as const,
      reply: 'y',
      feedback: { positive: 'z' },
      audio: null,
      speakingSeconds: 5,
      goalSeconds: 300,
      completed: false,
      completedAt: null,
      nextAvailableAt: null,
    })),
    end: vi.fn(async () => ({ ok: true as const, conversation: { ...conversation, status: 'completed' as const }, nextAvailableAt: null })),
  }
}

function renderPage(api: SpeakApi) {
  return render(
    <MemoryRouter initialEntries={['/speak']}>
      <Routes>
        <Route path="/speak" element={<SpeakPage api={api} />} />
        <Route path="/challenge" element={<h1>challenge sign-in page</h1>} />
        <Route path="/join" element={<h1>join</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SpeakPage access control', () => {
  beforeEach(() => {
    auth.user = null
    auth.authReady = true
    onboarding.premiumActive = false
    onboarding.loading = false
    sessionStorage.clear()
  })

  it('shows the auth loading state while the session is unresolved and calls nothing', () => {
    auth.authReady = false
    const api = fakeApi()
    renderPage(api)
    expect(screen.getByRole('status').textContent).toContain('جارٍ التحقق من حسابك')
    expect(api.start).not.toHaveBeenCalled()
  })

  it('redirects an unauthenticated visitor to the existing sign-in page and remembers /speak', async () => {
    const api = fakeApi()
    renderPage(api)
    await waitFor(() => expect(screen.getByText('challenge sign-in page')).toBeTruthy())
    expect(sessionStorage.getItem('x50_post_signin')).toBe('/speak')
    expect(api.session).not.toHaveBeenCalled()
  })

  it('shows the entitlement loading state for a signed-in user whose subscription is unresolved', () => {
    auth.user = { id: 'u1', email: 'a@b.c' }
    onboarding.loading = true
    const api = fakeApi()
    renderPage(api)
    expect(screen.getByRole('status').textContent).toContain('جارٍ التحقق من اشتراكك')
    expect(api.session).not.toHaveBeenCalled()
  })

  it('shows the premium gate to a free user and never initialises a session', async () => {
    auth.user = { id: 'u1', email: 'free@example.com' }
    const api = fakeApi()
    renderPage(api)
    expect(screen.getByRole('heading', { name: 'تدريب المحادثة متاح للمشتركين' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /اشترك الآن/ }).getAttribute('href')).toBe('/join')
    expect(screen.getByRole('link', { name: 'الرجوع للتحدي' }).getAttribute('href')).toBe('/challenge')
    // No microphone button, no API call.
    expect(screen.queryByRole('button', { name: 'ابدأ التسجيل' })).toBeNull()
    await new Promise((r) => setTimeout(r, 10))
    expect(api.session).not.toHaveBeenCalled()
    expect(api.start).not.toHaveBeenCalled()
  })

  it('lets a paid user in, loads their session, and starts on request', async () => {
    auth.user = { id: 'u1', email: 'paid@example.com' }
    onboarding.premiumActive = true
    const api = fakeApi()
    renderPage(api)
    expect(screen.getByRole('heading', { name: 'اتكلم إنجليزي من غير توتر' })).toBeTruthy()
    await waitFor(() => expect(api.session).toHaveBeenCalledTimes(1))
    const startBtn = await screen.findByRole('button', { name: 'ابدأ المحادثة' })
    await waitFor(() => expect(startBtn.hasAttribute('disabled')).toBe(false))
    startBtn.click()
    await waitFor(() => expect(api.start).toHaveBeenCalledTimes(1))
    // Emma assigns the topic at random now — just check it's a real one and the level is unchanged.
    expect(api.start.mock.calls[0][0]).toMatchObject({ level: 'intermediate' })
    expect(isScenarioId(api.start.mock.calls[0][0].scenario)).toBe(true)
    await waitFor(() => expect(screen.getAllByText('Hi! What was the best part of your day?').length).toBeGreaterThan(0))
  })

  it('lets the admin in without premium', async () => {
    auth.user = { id: 'admin', email: 'siramrhadid@gmail.com' }
    const api = fakeApi()
    renderPage(api)
    await waitFor(() => expect(api.session).toHaveBeenCalledTimes(1))
  })

  it('falls back to the gate when the server says the entitlement is gone', async () => {
    auth.user = { id: 'u1', email: 'paid@example.com' }
    onboarding.premiumActive = true
    const api = fakeApi()
    api.session.mockResolvedValue({ ok: false, code: 'not_premium', status: 403 })
    renderPage(api)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'تدريب المحادثة متاح للمشتركين' })).toBeTruthy())
  })
})
