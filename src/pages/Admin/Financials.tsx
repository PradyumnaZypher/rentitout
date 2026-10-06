import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { AlertCircle, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'

type ReconcileRow = {
  id: string
  booking_id: string
  payment_state: string
  transfer_state: string
  settlement_state: string
  reconciliation_status: string
  discrepancy_type: string | null
  discrepancy_message: string | null
  last_checked_at: string
}

export default function AdminFinancials() {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [rows, setRows] = useState<ReconcileRow[]>([])
  
  const [stats, setStats] = useState({
    matched: 0,
    pending: 0,
    discrepancy: 0,
    failed: 0,
    total: 0
  })

  async function loadData() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('financial_reconciliation')
        .select('*')
        .order('last_checked_at', { ascending: false })
        .limit(100)

      if (error) throw error

      setRows(data)

      const counts = { matched: 0, pending: 0, discrepancy: 0, failed: 0, total: data.length }
      data.forEach(r => {
        if (r.reconciliation_status === 'MATCHED') counts.matched++
        else if (r.reconciliation_status === 'PENDING') counts.pending++
        else if (r.reconciliation_status === 'DISCREPANCY') counts.discrepancy++
        else if (r.reconciliation_status === 'FAILED') counts.failed++
      })
      setStats(counts)

    } catch (err) {
      console.error(err)
      toast.error('Failed to load financial records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const runReconciliation = async () => {
    setRunning(true)
    try {
      const { data, error } = await supabase.rpc('reconcile_pending_financials', { p_limit: 50 })
      if (error) throw error
      toast.success(`Processed ${data.processed} records. ${data.discrepancies_found} discrepancies found.`)
      loadData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to run reconciliation')
    } finally {
      setRunning(false)
    }
  }

  const getStatusIcon = (status: string) => {
    if (status === 'MATCHED') return <CheckCircle2 className="size-4 text-green-500" />
    if (status === 'DISCREPANCY') return <AlertCircle className="size-4 text-amber-500" />
    if (status === 'FAILED') return <XCircle className="size-4 text-destructive" />
    return <RefreshCw className="size-4 text-blue-500" />
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--navy)]">Financial Control Plane</h1>
          <p className="text-muted-foreground mt-2">Monitor financial reconciliation and provider states.</p>
        </div>
        <Button onClick={runReconciliation} disabled={running}>
          {running ? <Spinner className="size-4 mr-2" /> : <RefreshCw className="size-4 mr-2" />}
          Run Reconciliation Batch
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card p-4 rounded-xl border">
          <p className="text-sm font-medium text-muted-foreground">Matched</p>
          <p className="text-2xl font-bold text-green-600">{stats.matched}</p>
        </div>
        <div className="bg-card p-4 rounded-xl border">
          <p className="text-sm font-medium text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
        </div>
        <div className="bg-card p-4 rounded-xl border">
          <p className="text-sm font-medium text-muted-foreground">Discrepancy</p>
          <p className="text-2xl font-bold text-amber-600">{stats.discrepancy}</p>
        </div>
        <div className="bg-card p-4 rounded-xl border">
          <p className="text-sm font-medium text-muted-foreground">Failed</p>
          <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Spinner className="size-8" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No financial reconciliation records found. Run a batch to generate them.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Booking</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment State</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Transfer State</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Settlement</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Discrepancy</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(r => (
                  <tr key={r.id} className={r.reconciliation_status === 'DISCREPANCY' ? 'bg-amber-50/50' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(r.reconciliation_status)}
                        <span className="font-medium">{r.reconciliation_status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.booking_id.substring(0, 8)}...</td>
                    <td className="px-4 py-3">{r.payment_state || 'N/A'}</td>
                    <td className="px-4 py-3">{r.transfer_state || 'N/A'}</td>
                    <td className="px-4 py-3">{r.settlement_state || 'N/A'}</td>
                    <td className="px-4 py-3">
                      {r.discrepancy_type ? (
                        <div className="max-w-[200px]">
                          <span className="font-medium text-amber-700">{r.discrepancy_type}</span>
                          <p className="text-xs text-muted-foreground truncate" title={r.discrepancy_message || ''}>
                            {r.discrepancy_message}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.last_checked_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
