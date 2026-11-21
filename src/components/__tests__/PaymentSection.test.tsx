// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signInWithGoogle = vi.fn()
const auth = { user: null as null | { id: string }, authReady: true, signInWithGoogle }

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }))

const activatePromo = vi.fn()
const fetchActivePromo = vi.fn()
vi.mock('../../lib/promo', async (orig) => ({
  ...(await orig<typeof import('../../lib/promo')>()),
  activatePromo: (...a: unknown[]) => activatePromo(...a),
  fetchActivePromo: () => fetchActivePromo(),
}))

const SIX_HOURS = 6 * 3600 * 1000
const activation = (status: 'active' | 'expired', expiresAt: number) => ({
  status,
  code: 'youtube44',
  activatedAt: new Date(expiresAt - SIX_HOURS).toISOString(),
  expiresAt: new Date(expiresAt).toISOString(),
})

import PaymentSection from '../PaymentSection'

describe('PaymentSection', () => {
  beforeEach(() => {
    auth.user = null
    auth.authReady = true
    signInWithGoogle.mockClear()
    activatePromo.mockReset()
    fetchActivePromo.mockReset().mockResolvedValue(null)
    vi.useRealTimers()
  })

  it('hides the price and payment link from signed-out visitors', () => {
    render(<PaymentSection />)
    expect(screen.queryByText(/EGP/)).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Google/ }))
    expect(signInWithGoogle).toHaveBeenCalledWith('/join')
  })

  it('shows nothing priced while the session is still loading', () => {
    auth.authReady = false
    render(<PaymentSection />)
    expect(screen.queryByText(/EGP/)).toBeNull()
  })

  it('shows the full-price link to signed-in visitors and swaps it for the promo code', async () => {
    auth.user = { id: 'u1' }
    activatePromo.mockResolvedValue(activation('active', Date.now() + SIX_HOURS))
    render(<PaymentSection />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://paymob.link/y6Aac')
    expect(link.textContent).toContain('6000 EGP')

    fireEvent.change(screen.getByLabelText(/كود خصم/), { target: { value: 'youtube44' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'تطبيق' }))
    })
    expect(activatePromo).toHaveBeenCalledWith('youtube44')
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://paymob.link/RDOaq')
    expect(screen.getByRole('link').textContent).toContain('4400 EGP')
    expect(screen.getByTestId('promo-countdown').textContent).toMatch(/^0[56]:/)
  })

  it('refuses a code this account already used and let expire', async () => {
    auth.user = { id: 'u1' }
    activatePromo.mockResolvedValue(activation('expired', Date.now() - 1000))
    render(<PaymentSection />)
    fireEvent.change(screen.getByLabelText(/كود خصم/), { target: { value: 'youtube44' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'تطبيق' }))
    })
    expect(screen.getByText(/انتهت صلاحيته/)).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://paymob.link/y6Aac')
  })

  it('restores a running activation and reverts to full price when it expires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    auth.user = { id: 'u1' }
    fetchActivePromo.mockResolvedValue(activation('active', Date.now() + 2000))
    await act(async () => {
      render(<PaymentSection />)
    })
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://paymob.link/RDOaq')
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://paymob.link/y6Aac')
    expect(screen.getByText('انتهت صلاحية كود الخصم')).toBeTruthy()
  })

  it('rejects an unknown promo code', async () => {
    auth.user = { id: 'u1' }
    render(<PaymentSection />)
    fireEvent.change(screen.getByLabelText(/كود خصم/), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'تطبيق' }))
    expect(screen.getByText('كود الخصم غير صحيح')).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://paymob.link/y6Aac')
  })
})
