import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminGuard } from '@/components/auth/AdminGuard'
import AdminDashboard from '@/pages/Admin/Dashboard'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn()
  }
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn()
}))

import { useAuth } from '@/hooks/useAuth'

describe('Phase 6 Admin Authorization Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated user from admin route', async () => {
    (useAuth as any).mockReturnValue({ user: null, loading: false })
    
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminGuard />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeTruthy()
    })
  })

  it('redirects authenticated non-admin from admin route', async () => {
    (useAuth as any).mockReturnValue({ user: { id: 'u1' }, loading: false });
    (supabase.rpc as any).mockResolvedValue({ data: false, error: null })
    
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminGuard />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeTruthy()
    })
  })

  it('allows authenticated admin to view dashboard', async () => {
    (useAuth as any).mockReturnValue({ user: { id: 'admin1' }, loading: false });
    (supabase.rpc as any).mockResolvedValue({ data: true, error: null });
    
    // Mock the dashboard stats queries
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockResolvedValue({ count: 10, error: null })
    })

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminGuard />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeTruthy()
    })
  })
})
