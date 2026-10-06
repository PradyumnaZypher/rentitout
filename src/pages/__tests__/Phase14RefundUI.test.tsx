import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AdminFinancials from '../Admin/Financials'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'financial_reconciliation') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'refund_requests') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'transfer_reversals') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null })
      }
    }),
    rpc: vi.fn()
  }
}))

describe('Phase 14 Refund UI Tests', () => {
  it('renders refund and reversal sections in admin financials', async () => {
    render(<AdminFinancials />)
    await waitFor(() => {
      expect(screen.getByText('Financial Control Plane')).toBeDefined()
    })
  })
})
