import { useState } from 'react'
import { supabase, type Booking } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { formatPrice } from '@/lib/utils'
import { Lock, CreditCard, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

interface PaymentCheckoutProps {
  booking: Booking
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function PaymentCheckout({ booking, open, onOpenChange, onSuccess }: PaymentCheckoutProps) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'summary' | 'processing' | 'success'>('summary')

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handlePayment = async () => {
    setLoading(true)
    setStep('processing')
    try {
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load. Are you offline?')
      }

      // 1. Call Edge Function to create order securely
      const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
        body: { booking_id: booking.id }
      })

      if (orderError) throw orderError
      if (!orderData || orderData.error) throw new Error(orderData?.error || 'Failed to create payment order')

      // 2. Open Razorpay Checkout Dialog
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Rentitout',
        description: `Payment for ${booking.listing?.title}`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          try {
            // 3. Call Edge Function to verify signature securely
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                payment_record_id: orderData.payment_record_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              }
            })

            if (verifyError || (verifyData && verifyData.error)) {
              throw new Error('Payment verification failed.')
            }

            setStep('success')
            toast.success('Payment verified successfully!')
            setTimeout(() => {
              onOpenChange(false)
              onSuccess()
            }, 2000)

          } catch (err: any) {
            console.error('Verification error:', err)
            toast.error(err.message || 'Payment verification failed')
            setStep('summary')
          }
        },
        prefill: {
          name: booking.renter?.name || '',
          contact: booking.renter?.phone || '',
        },
        theme: {
          color: '#3b82f6'
        },
        modal: {
          ondismiss: () => {
            toast.error('Payment cancelled')
            setStep('summary')
          }
        }
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', function (response: any){
        toast.error(response.error.description || 'Payment failed')
        setStep('summary')
      })
      rzp.open()

    } catch (err: any) {
      console.error('Payment flow error:', err)
      toast.error(err.message || 'Payment initialization failed')
      setStep('summary')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'summary' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="size-5 text-[var(--brand)]" />
                Secure Checkout
              </DialogTitle>
              <DialogDescription>
                Review your booking details and complete your payment securely.
              </DialogDescription>
            </DialogHeader>
            
            <div className="bg-slate-50 p-4 rounded-xl border space-y-4 my-2">
              <div>
                <p className="text-sm text-muted-foreground">Listing</p>
                <p className="font-medium text-slate-900">{booking.listing?.title}</p>
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium text-slate-900">{booking.total_days} days</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-bold text-xl text-[var(--brand)]">{formatPrice(booking.total_price)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600 bg-green-50 text-green-700 p-3 rounded-lg">
              <ShieldCheck className="size-4" />
              <span>Payments are protected by RentItOut Escrow.</span>
            </div>
            
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handlePayment} disabled={loading} className="gap-2 bg-[var(--brand)] text-white hover:bg-[var(--navy)]">
                {loading ? <Spinner className="size-4" /> : <CreditCard className="size-4" />}
                Pay {formatPrice(booking.total_price)}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'processing' && (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <Spinner className="size-10 text-[var(--brand)]" />
            <p className="font-medium text-slate-700">Processing your payment...</p>
            <p className="text-sm text-muted-foreground">Please do not close this window.</p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="size-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
              <ShieldCheck className="size-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Payment Successful!</h3>
            <p className="text-slate-600 max-w-[250px]">Your booking is now confirmed. The owner has been notified.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
