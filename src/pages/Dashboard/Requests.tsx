import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { EmptyState } from '@/components/shared/EmptyState'
import { supabase } from '@/lib/supabase'
import { formatPrice, formatDate, timeAgo, cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

export default function Requests() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!user) return
    loadRequests()
  }, [user])

  async function loadRequests() {
    if (!user) return
    // Get my listing IDs first
    const { data: myListings } = await supabase.from('listings').select('id').eq('owner_id', user.id)
    if (!myListings?.length) { setLoading(false); return }

    const { data } = await supabase
      .from('bookings')
      .select('*, renter:profiles!renter_id(name,avatar_url,city), listing:listings(title,images,price_per_day)')
      .in('listing_id', myListings.map((l) => l.id))
      .order('created_at', { ascending: false })

    setBookings(data ?? [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
    if (error) { toast.error('Failed to update'); return }
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b))
    toast.success(`Request ${status.toLowerCase()}`)
  }

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)

  if (loading) return <div className="flex justify-center py-20"><Spinner className="size-8" /></div>

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-[var(--navy)]">Incoming Requests</h1>
        <p className="text-muted-foreground mt-1">Rental requests for your items</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'PENDING', 'ACCEPTED', 'COMPLETED', 'DECLINED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              filter === s ? 'bg-[var(--navy)] text-white' : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
            )}
          >
            {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            {s === 'PENDING' && bookings.filter((b) => b.status === 'PENDING').length > 0 && (
              <span className="ml-1.5 size-4 rounded-full bg-[var(--brand)] text-white text-xs inline-flex items-center justify-center">
                {bookings.filter((b) => b.status === 'PENDING').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🔔"
          title={filter === 'all' ? 'No requests yet' : `No ${filter.toLowerCase()} requests`}
          description="Once someone requests to rent your items, they'll appear here."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((booking) => (
            <div key={booking.id} className="bg-card rounded-2xl border border-border p-5">
              <div className="flex gap-4 items-start">
                <UserAvatar name={booking.renter?.name ?? 'U'} avatarUrl={booking.renter?.avatar_url} size="md" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <span className="font-semibold">{booking.renter?.name}</span>
                      <span className="text-muted-foreground text-sm ml-1">from {booking.renter?.city}</span>
                    </div>
                    <Badge className={cn('shrink-0 text-xs', STATUS_COLORS[booking.status])}>
                      {booking.status}
                    </Badge>
                  </div>

                  <p className="text-sm mb-2">
                    Wants to rent <Link to={`/listing/${booking.listing_id}`} className="font-semibold text-[var(--brand)] hover:underline">{booking.listing?.title}</Link>
                  </p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {formatDate(booking.start_date)} – {formatDate(booking.end_date)}
                    </span>
                    <span>{booking.total_days} days</span>
                    <span className="price-display font-semibold text-[var(--navy)]">{formatPrice(booking.total_price)}</span>
                    <span className="text-xs">{timeAgo(booking.created_at)}</span>
                  </div>

                  {booking.message && (
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground mb-3 italic">
                      "{booking.message}"
                    </div>
                  )}

                  {booking.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateStatus(booking.id, 'ACCEPTED')} className="bg-green-500 hover:bg-green-600 text-white gap-1.5">
                        <Check className="size-3.5" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(booking.id, 'DECLINED')} className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5">
                        <X className="size-3.5" /> Decline
                      </Button>
                    </div>
                  )}
                  {booking.status === 'ACCEPTED' && (
                    <Button size="sm" onClick={() => updateStatus(booking.id, 'COMPLETED')} className="bg-blue-500 hover:bg-blue-600 text-white">
                      Mark as Completed
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
