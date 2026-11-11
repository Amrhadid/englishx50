// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signInWithGoogle = vi.fn()
const auth = { user: null as null | { id: string }, authReady: true, signInWithGoogle }

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }))

import PaymentSection from '../PaymentSection'

describe('PaymentSection', () => {
  beforeEach(() => {
    auth.user = null
    auth.authReady = true
    signInWithGoogle.mockClear()
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

  it('shows the full-price link to signed-in visitors and swaps it for the promo code', () => {
    auth.user = { id: 'u1' }
    render(<PaymentSection />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://paymob.link/y6Aac')
    expect(link.textContent).toContain('6000 EGP')

    fireEvent.change(screen.getByLabelText(/كود خصم/), { target: { value: 'youtube44' } })
    fireEvent.click(screen.getByRole('button', { name: 'تطبيق' }))
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://paymob.link/RDOaq')
    expect(screen.getByRole('link').textContent).toContain('4400 EGP')
  })

  it('rejects an unknown promo code', () => {
    auth.user = { id: 'u1' }
    render(<PaymentSection />)
    fireEvent.change(screen.getByLabelText(/كود خصم/), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'تطبيق' }))
    expect(screen.getByText('كود الخصم غير صحيح')).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://paymob.link/y6Aac')
  })
})
