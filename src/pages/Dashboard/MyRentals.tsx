import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { supabase, type Booking } from '@/lib/supabase'
import { formatPrice, formatDate, cn } from '@/lib/utils'
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

export default function MyRentals() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (!user) return
    async function loadRentals() {
      if (!user) return
      try {
        const { data } = await supabase
          .from('bookings')
          .select('*, listing:listings(title,images,city,area,category,price_per_day,owner_id)')
          .eq('renter_id', user.id)
          .order('created_at', { ascending: false })
        setBookings((data ?? []) as unknown as Booking[])
      } catch (err) {
        console.error('Error loading rentals:', err)
      } finally {
        setLoading(false)
      }
    }
    loadRentals()
  }, [user])

  const cancelBooking = async (id: string) => {
    const { error } = await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('id', id)
    if (error) { toast.error('Failed to cancel'); return }
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'CANCELLED' } : b))
    toast.success('Booking cancelled')
  }

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)

  if (loading) return <div className="flex justify-center py-20"><Spinner className="size-8" /></div>

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-[var(--navy)]">My Rentals</h1>
        <p className="text-muted-foreground mt-1">Items you've rented from others</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              filter === s
                ? 'bg-[var(--navy)] text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
            )}
          >
            {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🛍️"
          title="No rentals yet"
          description="Browse available items and request your first rental."
          action={<Button asChild className="bg-[var(--brand)] text-white"><Link to="/browse">Browse Items</Link></Button>}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((booking: any) => (
            <div key={booking.id} className="bg-card rounded-2xl border border-border p-5">
              <div className="flex gap-4 items-start">
                <div className="size-20 rounded-xl overflow-hidden bg-muted shrink-0">
                  <img
                    src={booking.listing?.images?.[0] ?? 'https://images.unsplash.com/photo-1558618047-3c8d69fa1679?w=400'}
                    alt={booking.listing?.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1558618047-3c8d69fa1679?w=400' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Link to={`/listing/${booking.listing_id}`} className="font-semibold font-display hover:text-[var(--brand)] transition-colors">
                      {booking.listing?.title}
                    </Link>
                    <Badge className={cn('shrink-0 text-xs', STATUS_COLORS[booking.status])}>
                      {booking.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {formatDate(booking.start_date)} – {formatDate(booking.end_date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {booking.listing?.city}
                    </span>
                    <span className="price-display font-semibold text-[var(--brand)]">
                      {formatPrice(booking.total_price)}
                    </span>
                  </div>
                  {booking.status === 'PENDING' && (
                    <Button size="sm" variant="outline" onClick={() => cancelBooking(booking.id)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                      Cancel Request
                    </Button>
                  )}
                  {booking.status === 'COMPLETED' && (
                    <Button size="sm" variant="outline" className="gap-2" asChild>
                      <Link to={`/listing/${booking.listing_id}`}>
                        <Star className="size-3" /> Leave Review
                      </Link>
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
