import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Package, ShoppingBag, Bell, TrendingUp, PlusCircle, ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useAuth } from '@/hooks/useAuth'
import { supabase, type Booking } from '@/lib/supabase'
import { formatPrice, timeAgo, cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

export default function DashboardOverview() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ listings: 0, activeRentals: 0, pendingRequests: 0, totalEarned: 0 })
  const [recentActivity, setRecentActivity] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      if (!user) return
      try {
        const { data: myListings } = await supabase.from('listings').select('id').eq('owner_id', user.id)
        const listingIds = myListings?.map((l) => l.id) ?? []

        const promises: PromiseLike<any>[] = [
          supabase.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
          supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('renter_id', user.id).eq('status', 'ACCEPTED'),
        ]

        if (listingIds.length > 0) {
          promises.push(
            supabase.from('bookings')
              .select('*, renter:profiles!renter_id(name,avatar_url), listing:listings(title,price_per_day)')
              .in('listing_id', listingIds)
              .order('created_at', { ascending: false })
              .limit(5)
          )
          promises.push(
            supabase.from('bookings')
              .select('total_price')
              .eq('status', 'COMPLETED')
              .in('listing_id', listingIds)
          )
        } else {
          promises.push(Promise.resolve({ data: [] }))
          promises.push(Promise.resolve({ data: [] }))
        }

        const [
          listingsCountResult,
          activeRentalsResult,
          incomingBookingsResult,
          completedBookingsResult,
        ] = await Promise.all(promises)

        const listingsCount = listingsCountResult.count ?? 0
        const activeRentals = activeRentalsResult.count ?? 0
        const incomingBookings = incomingBookingsResult.data ?? []
        const completedBookings = completedBookingsResult.data ?? []

        const pendingRequests = incomingBookings.filter((b: any) => b.status === 'PENDING').length
        const totalEarned = completedBookings.reduce((s: number, b: any) => s + (b.total_price ?? 0), 0)

        setStats({
          listings: listingsCount,
          activeRentals: activeRentals,
          pendingRequests,
          totalEarned,
        })
        setRecentActivity(incomingBookings as unknown as Booking[])
      } catch (err) {
        console.error('Error loading dashboard overview:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) return <div className="flex justify-center py-20"><Spinner className="size-8" /></div>

  const STAT_CARDS = [
    { label: 'Active Listings', value: stats.listings, icon: Package, color: 'bg-blue-50 text-blue-600', link: '/dashboard/my-listings' },
    { label: 'Active Rentals', value: stats.activeRentals, icon: ShoppingBag, color: 'bg-green-50 text-green-600', link: '/dashboard/my-rentals' },
    { label: 'Pending Requests', value: stats.pendingRequests, icon: Bell, color: 'bg-yellow-50 text-yellow-600', link: '/dashboard/requests' },
    { label: 'Total Earned', value: formatPrice(stats.totalEarned), icon: TrendingUp, color: 'bg-[var(--brand-soft)] text-[var(--brand)]', link: '/dashboard/requests' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-[var(--navy)]">
          Welcome back, {profile?.name?.split(' ')[0]}!
        </h1>
        <p className="text-muted-foreground mt-1">Here's what's happening with your rentals.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="block">
            <div className="bg-card rounded-2xl border border-border p-5 hover:border-[var(--brand)]/30 hover:shadow-sm transition-all">
              <div className={cn('size-10 rounded-xl flex items-center justify-center mb-3', color)}>
                <Icon className="size-5" />
              </div>
              <div className="text-2xl font-bold font-display text-[var(--navy)] price-display">{value}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link to="/list-item">
          <Button className="w-full bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white gap-2 h-11">
            <PlusCircle className="size-4" /> List New Item
          </Button>
        </Link>
        <Link to="/browse">
          <Button variant="outline" className="w-full gap-2 h-11">
            <ShoppingBag className="size-4" /> Browse Items
          </Button>
        </Link>
        <Link to="/dashboard/requests">
          <Button variant="outline" className="w-full gap-2 h-11">
            <Bell className="size-4" /> View Requests
            {stats.pendingRequests > 0 && (
              <span className="ml-1 size-5 rounded-full bg-[var(--brand)] text-white text-xs flex items-center justify-center">
                {stats.pendingRequests}
              </span>
            )}
          </Button>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-2xl border border-border">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display font-semibold">Recent Activity</h2>
          <Link to="/dashboard/requests" className="text-sm text-[var(--brand)] hover:underline flex items-center gap-1">
            View all <ArrowRight className="size-3" />
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No activity yet. <Link to="/list-item" className="text-[var(--brand)] hover:underline">List your first item</Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentActivity.map((booking: any) => (
              <div key={booking.id} className="p-4 flex items-center gap-4">
                <UserAvatar name={booking.renter?.name ?? 'U'} avatarUrl={booking.renter?.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    <span className="text-[var(--navy)]">{booking.renter?.name}</span>
                    {' '}wants to rent{' '}
                    <span className="font-semibold">{booking.listing?.title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="size-3" /> {timeAgo(booking.created_at)}
                    <span className="ml-2 price-display">{formatPrice(booking.total_price)}</span>
                  </p>
                </div>
                <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full shrink-0', STATUS_COLORS[booking.status])}>
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
