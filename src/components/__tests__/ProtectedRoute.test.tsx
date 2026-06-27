import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '../auth/ProtectedRoute'

// Mock the zustand store
vi.mock('@/store', () => ({
  useAuthStore: vi.fn(),
}))

import { useAuthStore } from '@/store'

describe('ProtectedRoute', () => {
  it('redirects to /login when user is not authenticated', () => {
    // Mock user as null with all store functions
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ 
      user: null,
      setSession: vi.fn(),
      setUser: vi.fn(),
      setProfile: vi.fn(),
      setLoading: vi.fn()
    })

    const { container } = render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(container.textContent).toBe('Login Page')
  })

  it('renders children when user is authenticated', () => {
    // Mock user as logged in with all store functions
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ 
      user: { id: '123' },
      setSession: vi.fn(),
      setUser: vi.fn(),
      setProfile: vi.fn(),
      setLoading: vi.fn()
    })

    const { container } = render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(container.textContent).toBe('Protected Content')
  })
})
