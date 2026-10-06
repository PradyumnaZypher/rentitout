import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ResetPassword from '../ResetPassword'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      updateUser: vi.fn()
    }
  }
}))

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(supabase.auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: '1' } } }, error: null })
  })

  it('renders the reset password form', async () => {
    render(<MemoryRouter><ResetPassword /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('Reset Password')).toBeTruthy()
    })
  })

  it('rejects passwords that are too short', async () => {
    render(<MemoryRouter><ResetPassword /></MemoryRouter>)
    const pwInputs = screen.getAllByPlaceholderText('••••••••', { exact: false })
    
    fireEvent.change(pwInputs[0], { target: { value: 'short' } })
    fireEvent.change(pwInputs[1], { target: { value: 'short' } })
    
    const submit = screen.getByRole('button', { name: /update password/i })
    fireEvent.click(submit)
    
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords', async () => {
    render(<MemoryRouter><ResetPassword /></MemoryRouter>)
    const pwInputs = screen.getAllByPlaceholderText('••••••••', { exact: false })
    fireEvent.change(pwInputs[0], { target: { value: 'password123' } })
    fireEvent.change(pwInputs[1], { target: { value: 'password321' } })
    
    const submit = screen.getByRole('button', { name: /update password/i })
    fireEvent.click(submit)
    
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('calls updateUser on valid submission', async () => {
    ;(supabase.auth.updateUser as any).mockResolvedValue({ error: null })
    render(<MemoryRouter><ResetPassword /></MemoryRouter>)
    const pwInputs = screen.getAllByPlaceholderText('••••••••', { exact: false })
    fireEvent.change(pwInputs[0], { target: { value: 'password123' } })
    fireEvent.change(pwInputs[1], { target: { value: 'password123' } })
    
    const submit = screen.getByRole('button', { name: /update password/i })
    fireEvent.click(submit)
    
    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'password123' })
    })
  })
})
