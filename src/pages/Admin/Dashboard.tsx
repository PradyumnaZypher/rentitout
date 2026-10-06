import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, LayoutList, MessageSquare, AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    listings: 0,
    reviews: 0,
    auditLogs: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const [users, listings, reviews, audits] = await Promise.all([
        supabase.from('public_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('listings').select('*', { count: 'exact', head: true }),
        supabase.from('reviews').select('*', { count: 'exact', head: true }),
        supabase.from('admin_audit_log').select('*', { count: 'exact', head: true })
      ])
      
      setStats({
        users: users.count ?? 0,
        listings: listings.count ?? 0,
        reviews: reviews.count ?? 0,
        auditLogs: audits.count ?? 0
      })
      setLoading(false)
    }
    loadStats()
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner className="size-8" /></div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-bold text-[var(--navy)] mb-8">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
            <Users className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold text-[var(--navy)]">{stats.users}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-xl text-green-600">
            <LayoutList className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Listings</p>
            <p className="text-2xl font-bold text-[var(--navy)]">{stats.listings}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
            <MessageSquare className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Reviews</p>
            <p className="text-2xl font-bold text-[var(--navy)]">{stats.reviews}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-xl text-orange-600">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Audit Events</p>
            <p className="text-2xl font-bold text-[var(--navy)]">{stats.auditLogs}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-12 bg-white rounded-2xl border p-8 text-center text-muted-foreground">
        <p>Use the administrative RPCs via API to manage users, listings, and reviews.</p>
        <p className="mt-2 text-sm">Full table views are omitted in this foundation build to focus on security architecture.</p>
      </div>
    </div>
  )
}
