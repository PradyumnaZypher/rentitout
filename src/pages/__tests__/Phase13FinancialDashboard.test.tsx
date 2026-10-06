import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AdminFinancials from '../Admin/Financials'

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'rec-1',
            booking_id: 'book-1234',
            reconciliation_status: 'MATCHED',
            payment_state: 'PAID',
            transfer_state: 'PROCESSED',
            settlement_state: 'SETTLED',
            discrepancy_type: null,
            last_checked_at: new Date().toISOString()
          },
          {
            id: 'rec-2',
            booking_id: 'book-5678',
            reconciliation_status: 'DISCREPANCY',
            payment_state: 'PAID',
            transfer_state: 'CREATED',
            settlement_state: 'PENDING',
            discrepancy_type: 'AMOUNT_MISMATCH',
            discrepancy_message: 'Transfer amount mismatch',
            last_checked_at: new Date().toISOString()
          }
        ],
        error: null
      })
    })),
    rpc: vi.fn().mockResolvedValue({ data: { processed: 2, discrepancies_found: 1 }, error: null })
  }
}))

describe('Phase 13 Financial Dashboard Tests', () => {
  it('renders dashboard layout and buttons', async () => {
    render(<AdminFinancials />)
    expect(screen.getByText('Financial Control Plane')).toBeDefined()
    expect(screen.getByText('Run Reconciliation Batch')).toBeDefined()
  })

  it('renders summary statistics', async () => {
    render(<AdminFinancials />)
    await waitFor(() => {
      expect(screen.getByText('Matched')).toBeDefined()
      expect(screen.getByText('Pending')).toBeDefined()
      expect(screen.getByText('Discrepancy')).toBeDefined()
      expect(screen.getByText('Failed')).toBeDefined()
    })
  })

  it('renders reconciliation table rows correctly', async () => {
    render(<AdminFinancials />)
    await waitFor(() => {
      expect(screen.getByText('MATCHED')).toBeDefined()
      expect(screen.getByText('DISCREPANCY')).toBeDefined()
      expect(screen.getByText('AMOUNT_MISMATCH')).toBeDefined()
    })
  })
})
