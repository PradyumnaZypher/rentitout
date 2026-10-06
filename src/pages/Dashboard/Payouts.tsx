import { useState, useEffect } from 'react'
import { Landmark, ArrowRight, CheckCircle2, Clock, AlertCircle, Info } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'

type RouteStatus = 'NOT_STARTED' | 'CREATED' | 'PENDING' | 'UNDER_REVIEW' | 'NEEDS_CLARIFICATION' | 'ACTIVE' | 'VERIFIED' | 'REJECTED' | 'FAILED'

interface PayoutProfile {
  provider_account_id: string | null
  kyc_status: RouteStatus
}

export default function Payouts() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [profile, setProfile] = useState<PayoutProfile | null>(null)
  const [platformFee, setPlatformFee] = useState<number | null>(null)
  const [transfers, setTransfers] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      if (!user) return
      try {
        const [profileRes, feeRes, transfersRes] = await Promise.all([
          supabase
            .from('payout_profiles')
            .select('provider_account_id, kyc_status')
            .eq('owner_id', user.id)
            .single(),
          supabase
            .from('platform_settings')
            .select('platform_fee_bps')
            .eq('id', 1)
            .single(),
          supabase
            .from('route_transfers')
            .select(`
              *,
              bookings (
                id,
                total_price,
                start_date,
                end_date
              ),
              financial_reconciliation!route_transfer_id (
                reconciliation_status
              )
            `)
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false })
        ])

        if (profileRes.data) setProfile(profileRes.data)
        if (feeRes.data) setPlatformFee(feeRes.data.platform_fee_bps)
        if (transfersRes.data) setTransfers(transfersRes.data)
      } catch (err) {
        console.error('Error loading payout data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user])

  const handleOnboard = async () => {
    if (!user) return
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-route-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({})
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to initiate onboarding')
      }

      const data = await res.json()
      
      // Update local state
      setProfile({
        provider_account_id: data.provider_account_id,
        kyc_status: data.status
      })
      
      toast.success(data.message || 'Onboarding initiated')
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate onboarding')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-8 text-primary" />
      </div>
    )
  }

  const kycStatus = profile?.kyc_status || 'NOT_STARTED'

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Payout Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage how you receive your rental earnings.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Payout Account Card */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex items-center gap-3 mb-2">
              <Landmark className="size-5 text-[var(--brand)]" />
              <h2 className="text-xl font-semibold">Bank Account</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Connect your bank account to receive payouts directly.
            </p>
          </div>

          <div className="p-6 bg-muted/30">
            {kycStatus === 'NOT_STARTED' && (
              <div className="text-center py-6">
                <AlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">Not Connected</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  You need to connect a payout account before you can receive earnings.
                </p>
                <Button onClick={handleOnboard} disabled={actionLoading} className="w-full">
                  {actionLoading ? <Spinner className="size-4 mr-2" /> : null}
                  Set Up Payout Account
                  <ArrowRight className="size-4 ml-2" />
                </Button>
              </div>
            )}

            {(kycStatus === 'PENDING' || kycStatus === 'CREATED') && (
              <div className="text-center py-6">
                <Clock className="size-12 text-amber-500 mx-auto mb-4" />
                <h3 className="font-medium mb-2">Setup Incomplete</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Your payout account setup is incomplete.
                </p>
                <Button onClick={handleOnboard} disabled={actionLoading} className="w-full bg-amber-500 hover:bg-amber-600">
                  {actionLoading ? <Spinner className="size-4 mr-2" /> : null}
                  Continue Setup
                  <ArrowRight className="size-4 ml-2" />
                </Button>
              </div>
            )}

            {kycStatus === 'UNDER_REVIEW' && (
              <div className="text-center py-6">
                <Clock className="size-12 text-blue-500 mx-auto mb-4" />
                <h3 className="font-medium mb-2">Under Review</h3>
                <p className="text-sm text-muted-foreground">
                  Your KYC documents are being verified by our payment provider. This usually takes 1-2 business days.
                </p>
              </div>
            )}

            {kycStatus === 'NEEDS_CLARIFICATION' && (
              <div className="text-center py-6">
                <AlertCircle className="size-12 text-orange-500 mx-auto mb-4" />
                <h3 className="font-medium mb-2">Action Required</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Additional information is required to verify your account.
                </p>
                <Button onClick={handleOnboard} disabled={actionLoading} className="w-full bg-orange-500 hover:bg-orange-600">
                  {actionLoading ? <Spinner className="size-4 mr-2" /> : null}
                  Provide Information
                </Button>
              </div>
            )}

            {(kycStatus === 'ACTIVE' || kycStatus === 'VERIFIED') && (
              <div className="text-center py-6">
                <CheckCircle2 className="size-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-medium mb-2">Payout Account Active</h3>
                <p className="text-sm text-muted-foreground">
                  Your account is fully verified and ready to receive payouts.
                </p>
              </div>
            )}
            
            {kycStatus === 'FAILED' || kycStatus === 'REJECTED' && (
              <div className="text-center py-6">
                <AlertCircle className="size-12 text-destructive mx-auto mb-4" />
                <h3 className="font-medium mb-2">Verification Failed</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  We could not verify your payout account details.
                </p>
                <Button onClick={handleOnboard} disabled={actionLoading} variant="destructive" className="w-full">
                  {actionLoading ? <Spinner className="size-4 mr-2" /> : null}
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Platform Fee Card */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden h-fit">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Platform Fee</h2>
          </div>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-muted-foreground">Standard Commission</span>
              <span className="text-2xl font-bold font-display">
                {platformFee !== null ? `${(platformFee / 100).toFixed(1)}%` : '--'}
              </span>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <Info className="size-5 shrink-0 text-blue-500 mt-0.5" />
              <p>
                The platform fee is automatically calculated and deducted when a booking is marked as completed. You will receive the remaining amount in your payout account.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer History Card */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Transfer History</h2>
        </div>
        <div className="p-0">
          {transfers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No transfers yet. Transfers will appear here once bookings are completed.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="border-b">
                    <th className="px-6 py-4 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-6 py-4 text-left font-medium text-muted-foreground">Amount</th>
                    <th className="px-6 py-4 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-6 py-4 text-left font-medium text-muted-foreground">Settlement</th>
                    <th className="px-6 py-4 text-left font-medium text-muted-foreground">Reconciliation</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transfers.map((t) => (
                    <tr key={t.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {formatPrice(t.owner_amount / 100)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          t.status === 'PROCESSED' ? 'bg-green-100 text-green-700' :
                          t.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          t.settlement_status === 'SETTLED' ? 'bg-green-100 text-green-700' :
                          t.settlement_status === 'ON_HOLD' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {t.settlement_status === 'ON_HOLD' ? 'ON HOLD' : t.settlement_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          t.financial_reconciliation?.[0]?.reconciliation_status === 'MATCHED' ? 'bg-green-100 text-green-700' :
                          t.financial_reconciliation?.[0]?.reconciliation_status === 'DISCREPANCY' ? 'bg-amber-100 text-amber-700' :
                          t.financial_reconciliation?.[0]?.reconciliation_status === 'FAILED' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {t.financial_reconciliation?.[0]?.reconciliation_status || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
