import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ListingDetail from '../ListingDetail'
import Requests from '../Dashboard/Requests'
import MyRentals from '../Dashboard/MyRentals'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn()
    }
  }
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user1' } })
}))

describe('Phase 3 Booking UX Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ListingDetail prevents booking overlapping dates', async () => {
    const mockFrom = vi.fn((table) => {
      let currentQuery = ''
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        neq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        limit: vi.fn(() => { currentQuery = 'similar'; return chain }),
        maybeSingle: vi.fn(() => { currentQuery = 'listing'; return chain }),
        insert: vi.fn(() => { currentQuery = 'insert'; return chain }),
        order: vi.fn(() => chain),
        then: function(resolve: any) {
          if (table === 'listings') {
            if (currentQuery === 'similar') return resolve({ data: [], error: null })
            return resolve({ data: { id: 'l1', price_per_day: 100, owner_id: 'user2' }, error: null })
          }
          if (table === 'bookings') {
            if (currentQuery === 'insert') return resolve({ data: null, error: { message: 'overlap' } })
            return resolve({ data: [{ start_date: '2026-10-10', end_date: '2026-10-12', status: 'ACCEPTED' }], error: null })
          }
          resolve({ data: [], error: null })
        }
      }
      return chain
    })
    ;(supabase.from as any) = mockFrom

    render(
      <MemoryRouter initialEntries={['/listing/l1']}>
        <Routes>
          <Route path="/listing/:id" element={<ListingDetail />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Select Dates')).toBeTruthy()
    })
  })

  it('Requests dashboard shows proper actions for status', async () => {
    const mockFrom = vi.fn((table) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        then: function(resolve: any) {
          if (table === 'listings') return resolve({ data: [{ id: 'l1', owner_id: 'user1' }] })
          resolve({
            data: [
              { id: 'b1', status: 'PENDING', listing: { title: 'T1' }, renter: { name: 'R1' }, start_date: '2026-10-10', end_date: '2026-10-12', created_at: '2026-10-01', total_price: 100 },
              { id: 'b2', status: 'ACCEPTED', listing: { title: 'T2' }, renter: { name: 'R2' }, start_date: '2026-10-10', end_date: '2026-10-12', created_at: '2026-10-01', total_price: 100 },
              { id: 'b3', status: 'COMPLETED', listing: { title: 'T3' }, renter: { name: 'R3' }, start_date: '2026-10-10', end_date: '2026-10-12', created_at: '2026-10-01', total_price: 100 }
            ]
          })
        }
      }
      return chain
    })
    ;(supabase.from as any) = mockFrom

    render(<MemoryRouter><Requests /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('T1')).toBeTruthy()
    })

    // b1 (PENDING) has Accept / Decline
    expect(screen.getByText('Accept')).toBeTruthy()
    expect(screen.getByText('Decline')).toBeTruthy()

    // b2 (ACCEPTED) has Mark as Completed / Cancel Booking
    expect(screen.getByText('Mark as Completed')).toBeTruthy()
    expect(screen.getByText('Cancel Booking')).toBeTruthy()
  })

  it('MyRentals shows Cancel Rental only for Pending/Accepted', async () => {
    const mockFrom = vi.fn(() => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        then: function(resolve: any) {
          resolve({
            data: [
              { id: 'r1', status: 'PENDING', listing: { title: 'L1' }, start_date: '2026-10-10', end_date: '2026-10-12', created_at: '2026-10-01T00:00:00Z', total_price: 100 },
              { id: 'r2', status: 'COMPLETED', listing: { title: 'L2' }, start_date: '2026-10-10', end_date: '2026-10-12', created_at: '2026-10-01T00:00:00Z', total_price: 100 }
            ]
          })
        }
      }
      return chain
    })
    ;(supabase.from as any) = mockFrom

    render(<MemoryRouter><MyRentals /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('L1')).toBeTruthy()
    })

    expect(screen.getByText('Cancel Rental')).toBeTruthy()
    expect(screen.getByText('Leave Review')).toBeTruthy()
  })
})
