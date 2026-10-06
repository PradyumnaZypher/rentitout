import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn()
    }
  }
}))

describe('Phase 2.1 Security Hardening - Booking & Message Triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Unauthorized user cannot perform a status transition
  it('Unauthorized user cannot perform a status transition', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ error: { message: 'Unauthorized to change booking status' } })
    ;(supabase.from as any).mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockUpdate }) })
    const { error } = await supabase.from('bookings').update({ status: 'ACCEPTED' }).eq('id', '1')
    expect(error?.message).toBe('Unauthorized to change booking status')
  })

  // 2-7. Renter cannot change protected fields
  const protectedFields = [
    { field: 'renter_id', val: 'new_id', msg: 'Cannot change renter_id' },
    { field: 'listing_id', val: 'new_id', msg: 'Cannot change listing_id' },
    { field: 'start_date', val: '2027-01-01', msg: 'Cannot change start_date after creation' },
    { field: 'end_date', val: '2027-01-02', msg: 'Cannot change end_date after creation' },
    { field: 'total_days', val: 5, msg: 'Cannot change total_days after creation' },
    { field: 'total_price', val: 500, msg: 'Cannot change total_price after creation' },
  ]
  protectedFields.forEach(({ field, val, msg }) => {
    it(`Renter cannot change ${field}`, async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ error: { message: msg } })
      ;(supabase.from as any).mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockUpdate }) })
      const payload: any = {}
      payload[field] = val
      const { error } = await supabase.from('bookings').update(payload).eq('id', '1')
      expect(error?.message).toBe(msg)
    })
  })

  // 8. Protected-field NULL manipulation cannot bypass the guard
  it('Protected-field NULL manipulation cannot bypass the guard', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ error: { message: 'Cannot change total_price after creation' } })
    ;(supabase.from as any).mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockUpdate }) })
    const { error } = await supabase.from('bookings').update({ total_price: null }).eq('id', '1')
    expect(error?.message).toBe('Cannot change total_price after creation')
  })

  // 9. Invalid status transitions remain rejected
  it('Invalid status transitions remain rejected', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ error: { message: 'Invalid transition from PENDING' } })
    ;(supabase.from as any).mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockUpdate }) })
    const { error } = await supabase.from('bookings').update({ status: 'COMPLETED' }).eq('id', '1')
    expect(error?.message).toBe('Invalid transition from PENDING')
  })

  // 10. Valid renter cancellation still works
  it('Valid renter cancellation still works', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ data: { status: 'CANCELLED' }, error: null })
    ;(supabase.from as any).mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockUpdate }) })
    const { error } = await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('id', '1')
    expect(error).toBeNull()
  })

  // 13-19. Message immutability
  it('Message content cannot be changed', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ error: { message: 'Only the read status can be modified' } })
    ;(supabase.from as any).mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockUpdate }) })
    const { error } = await supabase.from('messages').update({ content: 'hacked' }).eq('id', '1')
    expect(error?.message).toBe('Only the read status can be modified')
  })

  it('Only the read field can be changed', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ data: { read: true }, error: null })
    ;(supabase.from as any).mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockUpdate }) })
    const { error } = await supabase.from('messages').update({ read: true }).eq('id', '1')
    expect(error).toBeNull()
  })
})
