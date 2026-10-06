import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn()
  }
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn()
}))

describe('Phase 7 Notifications Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: { id: 'user1' }, loading: false });
  })

  it('renders notification center with empty state', async () => {
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    })

    render(
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>
    )
    
    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    await waitFor(() => {
      expect(screen.getByText("You're all caught up!")).toBeTruthy()
    })
  })

  it('renders notifications and unread badge', async () => {
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ 
        data: [
          { id: '1', title: 'New Booking', message: 'User requested booking', is_read: false, created_at: new Date().toISOString() },
          { id: '2', title: 'Review Received', message: 'You got 5 stars', is_read: true, created_at: new Date().toISOString() }
        ], 
        error: null 
      })
    })

    render(
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('New Booking')).toBeTruthy()
      expect(screen.getByText('Review Received')).toBeTruthy()
      // Mark all as read button should appear because there is an unread notification
      expect(screen.getByText('Mark all as read')).toBeTruthy()
    })
  })

  it('marks notification as read on click', async () => {
    const updateMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ 
        data: [
          { id: '1', title: 'New Booking', message: 'User requested booking', is_read: false, created_at: new Date().toISOString() }
        ], 
        error: null 
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: updateMock
        })
      })
    })

    render(
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('New Booking')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('New Booking'))
    
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled()
    })
  })
})
