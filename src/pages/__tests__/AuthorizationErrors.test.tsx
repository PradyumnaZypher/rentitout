import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Requests from '../Dashboard/Requests'
import MyRentals from '../Dashboard/MyRentals'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user1' } })
}))

describe('Dashboard Component Authorization Errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Requests dashboard handles unauthorized update gracefully', async () => {
    let updateCalled = false
    const mockFrom = vi.fn((table) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        update: vi.fn(() => { updateCalled = true; return chain }),
        then: function(resolve: any) {
          if (table === 'listings') return resolve({ data: [{ id: 'l1', owner_id: 'user1' }] })
          if (table === 'bookings') {
            if (updateCalled) return resolve({ error: { message: 'Invalid transition from PENDING' } })
            return resolve({
              data: [{ id: 'b1', status: 'PENDING', listing: { title: 'T1' }, renter: { name: 'Bob' }, start_date: '2026-01-01', end_date: '2026-01-02', created_at: '2026-01-01' }]
            })
          }
          resolve({ data: [] })
        }
      }
      return chain
    })
    ;(supabase.from as any) = mockFrom

    render(<MemoryRouter><Requests /></MemoryRouter>)
    
    // Wait for load
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(5)
    })

    const buttons = screen.getAllByRole('button')
    // The first 5 are filters, the 6th is Accept
    fireEvent.click(buttons[5])

    await waitFor(() => {
      // The update should be called with status: ACCEPTED
      expect(updateCalled).toBe(true)
    })
  })

  it('MyRentals handles duplicate review error gracefully', async () => {
    let insertCalled = false
    const mockFrom = vi.fn((table) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        update: vi.fn(() => chain),
        insert: vi.fn(() => { insertCalled = true; return chain }),
        then: function(resolve: any) {
          if (table === 'bookings') {
            return resolve({
              data: [{ id: 'b1', status: 'COMPLETED', listing: { title: 'Test Item' }, start_date: '2026-01-01', end_date: '2026-01-02', created_at: '2026-01-01T00:00:00Z', total_price: 100 }]
            })
          }
          if (table === 'reviews' && insertCalled) {
            return resolve({ error: { message: 'duplicate key value violates unique constraint' } })
          }
          resolve({ data: [] })
        }
      }
      // Attach a mock property to assert on
      if (table === 'reviews') chain.insertMock = chain.insert
      return chain
    })
    ;(supabase.from as any) = mockFrom

    render(<MemoryRouter><MyRentals /></MemoryRouter>)
    
    await waitFor(() => {
      expect(screen.getByText(/Leave Review/i)).toBeTruthy()
    })

    // Click leave review
    fireEvent.click(screen.getByText(/Leave Review/i))
    
    await waitFor(() => {
      expect(screen.getByText('Submit Review')).toBeTruthy()
    })

    // Submit the review
    fireEvent.click(screen.getByText('Submit Review'))

    await waitFor(() => {
      expect(insertCalled).toBe(true)
    })
  })
})
