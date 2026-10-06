import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

describe('Phase 12 Transfer UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuth as any).mockReturnValue({
      user: { id: 'user-123' }
    })
  })

  it('renders transfer history when data is present', async () => {
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
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { platform_fee_bps: 500 } })
        }
      }
      if (table === 'route_transfers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'trans_1',
                created_at: new Date('2024-01-01').toISOString(),
                owner_amount: 95000,
                status: 'PROCESSED',
                settlement_status: 'ON_HOLD'
              },
              {
                id: 'trans_2',
                created_at: new Date('2024-01-02').toISOString(),
                owner_amount: 190000,
                status: 'FAILED',
                settlement_status: 'PENDING'
              }
            ]
          })
        }
      }
    })

    render(<Payouts />)
    
    await waitFor(() => {
      expect(screen.getByText('Transfer History')).toBeDefined()
      expect(screen.getByText('₹950')).toBeDefined()
      expect(screen.getByText('PROCESSED')).toBeDefined()
      expect(screen.getByText('ON HOLD')).toBeDefined()

      expect(screen.getByText('₹1,900')).toBeDefined()
      expect(screen.getByText('FAILED')).toBeDefined()
      expect(screen.getAllByText('PENDING').length).toBeGreaterThan(0)
    })
  })

  it('renders empty state when no transfers', async () => {
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
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { platform_fee_bps: 500 } })
        }
      }
      if (table === 'route_transfers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [] })
        }
      }
    })

    render(<Payouts />)
    
    await waitFor(() => {
      expect(screen.getByText('No transfers yet. Transfers will appear here once bookings are completed.')).toBeDefined()
    })
  })
})
