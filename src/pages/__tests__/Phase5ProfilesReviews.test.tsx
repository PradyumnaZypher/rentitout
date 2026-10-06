import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicProfile from '../PublicProfile'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  }
}))

describe('Phase 5 Public Profile & Reviews Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Renders safe public profile fields without crashing', async () => {
    // Mock the chain for public_profiles, listings, and reviews
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockOrder = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockMaybeSingle = vi.fn()

    ;(supabase.from as any).mockImplementation((table: string) => {
      return {
        select: (_query: string) => {
          if (table === 'public_profiles') {
            mockMaybeSingle.mockResolvedValueOnce({
              data: { id: 'U1', name: 'John Safe', city: 'Public City', created_at: '2025-01-01', is_verified: true, bio: 'A safe bio' }
            })
            return { eq: () => ({ maybeSingle: mockMaybeSingle }) }
          }
          if (table === 'listings') {
            return {
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: [{ id: 'L1', title: 'Safe Listing', price_per_day: 10 }]
                  })
                })
              })
            }
          }
          if (table === 'reviews') {
            return {
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [{ id: 'R1', rating: 5, comment: 'Great safe rental', author: { name: 'Alice' }, created_at: '2025-01-01T00:00:00Z' }]
                  })
                })
              })
            }
          }
          return { select: mockSelect, eq: mockEq, order: mockOrder, limit: mockLimit, maybeSingle: mockMaybeSingle }
        }
      }
    })

    ;(supabase.rpc as any).mockResolvedValueOnce({
      data: [{ avg_rating: 4.8, review_count: 12 }]
    })

    render(
      <MemoryRouter initialEntries={['/profile/U1']}>
        <Routes>
          <Route path="/profile/:id" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('John Safe')).toBeTruthy()
      expect(screen.getByText('Public City')).toBeTruthy()
      expect(screen.getByText('A safe bio')).toBeTruthy()
      
      // Should render listing and review
      expect(screen.getByText('Safe Listing')).toBeTruthy()
      expect(screen.getByText('Great safe rental')).toBeTruthy()
      
      // Check rating summary
      expect(screen.getByText('12 Reviews')).toBeTruthy()
      expect(screen.getByText('4.8')).toBeTruthy()
    })
  })

  it('Renders error state when profile not found', async () => {
    ;(supabase.from as any).mockImplementation((_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Not found' } })
        })
      })
    }))

    render(
      <MemoryRouter initialEntries={['/profile/U2']}>
        <Routes>
          <Route path="/profile/:id" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Profile Unavailable')).toBeTruthy()
    })
  })
})
