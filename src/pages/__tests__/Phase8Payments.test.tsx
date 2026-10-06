import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentCheckout } from '@/components/payments/PaymentCheckout'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    }
  }
}))

const mockBooking: any = {
  id: 'b1',
  start_date: '2026-10-10',
  end_date: '2026-10-15',
  total_days: 5,
  total_price: 5000,
  status: 'ACCEPTED',
  payment_status: 'UNPAID',
  listing: {
    title: 'Luxury Villa',
  }
}

describe('Phase 8 Payments Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  })

  it('renders payment summary correctly', () => {
    render(
      <PaymentCheckout 
        booking={mockBooking} 
        open={true} 
        onOpenChange={vi.fn()} 
        onSuccess={vi.fn()} 
      />
    )
    
    expect(screen.getByText('Secure Checkout')).toBeTruthy()
    expect(screen.getByText('Luxury Villa')).toBeTruthy()
    expect(screen.getByText('5 days')).toBeTruthy()
    // It should render formatted price
    expect(screen.getAllByText(/₹\s*5,000/)[0]).toBeTruthy()
  })

  it('handles successful payment flow', async () => {
    const onSuccessMock = vi.fn();
    
    // Mock Razorpay SDK globally
    (window as any).Razorpay = class {
      options: any
      constructor(options: any) { this.options = options }
      on() {}
      open() {
        // Simulate immediate success callback
        this.options.handler({
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'sig_123'
        })
      }
    };

    (supabase.functions.invoke as any)
      .mockResolvedValueOnce({ 
        data: { 
          order_id: 'order_123', 
          amount: 500000, 
          currency: 'INR', 
          key_id: 'rzp_test_123', 
          payment_record_id: 'rec_123' 
        }, 
        error: null 
      }) // initiate_payment_order
      .mockResolvedValueOnce({ data: { success: true }, error: null }) // verify_payment_success

    render(
      <PaymentCheckout 
        booking={mockBooking} 
        open={true} 
        onOpenChange={vi.fn()} 
        onSuccess={onSuccessMock} 
      />
    )

    // Click pay button
    fireEvent.click(screen.getByRole('button', { name: /Pay ₹\s*5,000/ }))
    
    // wait for success state
    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('handles payment failure gracefully', async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: null, error: new Error('Unauthorized') })

    render(
      <PaymentCheckout 
        booking={mockBooking} 
        open={true} 
        onOpenChange={vi.fn()} 
        onSuccess={vi.fn()} 
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Pay ₹\s*5,000/ }))
    
    await waitFor(() => {
      // It should revert back to summary on error
      expect(screen.getByText('Secure Checkout')).toBeTruthy()
    })
  })
})
