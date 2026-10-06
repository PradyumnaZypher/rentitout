import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Browse from '../Browse'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
  CATEGORIES: ['Electronics', 'Vehicles'],
  CONDITIONS: ['New', 'Good']
}))

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value
}))

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn().mockImplementationOnce((success) => Promise.resolve(success({
    coords: {
      latitude: 51.1,
      longitude: 45.3
    }
  })))
};
Object.defineProperty(globalThis, 'navigator', {
  value: { geolocation: mockGeolocation },
  writable: true
});

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Phase 4 Marketplace Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Renders empty state when no listings found', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: [] })

    render(
      <MemoryRouter initialEntries={['/browse']}>
        <Routes>
          <Route path="/browse" element={<Browse />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No listings available')).toBeTruthy()
    })
  })

  it('Renders error state on database failure', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: { message: 'DB Error' } })

    render(
      <MemoryRouter initialEntries={['/browse']}>
        <Routes>
          <Route path="/browse" element={<Browse />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/We couldn't load the listings/)).toBeTruthy()
      expect(screen.getByText('Try Again')).toBeTruthy()
    })
  })

  it('Renders results and applies debounced search', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{
        id: 'L1', title: 'Test Item', category: 'Electronics', price_per_day: 100,
        owner_name: 'John', total_count: 1
      }]
    })

    render(
      <MemoryRouter initialEntries={['/browse']}>
        <Routes>
          <Route path="/browse" element={<Browse />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Item')).toBeTruthy()
    })

    const searchInput = screen.getByPlaceholderText('Search items...')
    
    // Type in search
    fireEvent.change(searchInput, { target: { value: 'drone' } })

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        'search_listings_advanced',
        expect.objectContaining({ search_query: 'drone' })
      )
    })
  })

  it('Pagination controls render correctly', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{
        id: 'L1', title: 'Test Item', category: 'Electronics', price_per_day: 100,
        owner_name: 'John', total_count: 45 // more than 20 to trigger pagination
      }]
    })

    render(
      <MemoryRouter initialEntries={['/browse']}>
        <Routes>
          <Route path="/browse" element={<Browse />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Item')).toBeTruthy()
      expect(screen.getByText('Next')).toBeTruthy()
      expect(screen.getByText('Page 1 of 3')).toBeTruthy()
    })
    
    fireEvent.click(screen.getByText('Next'))
    
    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        'search_listings_advanced',
        expect.objectContaining({ offset_count: 20 })
      )
    })
  })
})
