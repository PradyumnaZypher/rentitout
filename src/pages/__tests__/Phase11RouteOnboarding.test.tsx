import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Payouts from '../Dashboard/Payouts'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

vi.mock('@/hooks/useAuth')
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn()
    }
  }
}))

const mockFetch = vi.fn()
globalThis.fetch = mockFetch as any

describe('Phase 11 Route Onboarding Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuth as any).mockReturnValue({
      user: { id: 'user-123' }
    })
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        provider_account_id: 'acc_123',
        status: 'CREATED',
        message: 'Success'
      })
    })
  })

  it('renders correctly for unauthenticated user', () => {
    ;(useAuth as any).mockReturnValue({ user: null })
    render(<Payouts />)
    expect(screen.getByRole('status')).toBeDefined() // Spinner
  })

  it('renders Not Connected state', async () => {
    ;(supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(async () => {
        // Mock platform fee
        return { data: { platform_fee_bps: 500 } }
      })
    })

    // Override the first call (payout_profiles) to return null
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'payout_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null })
        }
      }
      if (table === 'route_transfers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [] })
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { platform_fee_bps: 500 } })
      }
    })

    render(<Payouts />)
    
    await waitFor(() => {
      expect(screen.getByText('Not Connected')).toBeDefined()
      expect(screen.getByText('5.0%')).toBeDefined()
    })
  })

  it('allows user to initiate onboarding', async () => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'payout_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { kyc_status: 'NOT_STARTED' } })
        }
      }
      if (table === 'route_transfers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [] })
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { platform_fee_bps: 500 } })
      }
    })

    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { access_token: 'token-123' } }
    })

    render(<Payouts />)
    
    await waitFor(() => {
      expect(screen.getByText('Set Up Payout Account')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Set Up Payout Account'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('create-route-account'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token-123'
          })
        })
      )
    })
  })

  it('renders ACTIVE status correctly', async () => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'payout_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ 
            data: { 
              provider_account_id: 'acc_123',
              kyc_status: 'ACTIVE' 
            } 
          })
        }
      }
      if (table === 'route_transfers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [] })
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { platform_fee_bps: 750 } })
      }
    })

    render(<Payouts />)
    
    await waitFor(() => {
      expect(screen.getByText('Payout Account Active')).toBeDefined()
      expect(screen.getByText('7.5%')).toBeDefined()
    })
  })
})
