import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { LayoutDashboard, Package, ShoppingBag, Bell, MessageSquare, User, LogOut, PlusCircle, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/dashboard/my-listings', label: 'My Listings', icon: Package },
  { to: '/dashboard/my-rentals', label: 'My Rentals', icon: ShoppingBag },
  { to: '/dashboard/requests', label: 'Requests', icon: Bell },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/dashboard/profile', label: 'Profile Settings', icon: User },
]

export default function DashboardLayout() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!user) return
    async function loadPendingCount() {
      if (!user) return
      try {
        const { data: myListings } = await supabase.from('listings').select('id').eq('owner_id', user.id)
        const listingIds = myListings?.map((l) => l.id) ?? []
        if (listingIds.length === 0) {
          setPendingCount(0)
          return
        }
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PENDING')
          .in('listing_id', listingIds)
        setPendingCount(count ?? 0)
      } catch (err) {
        console.error('Error loading pending count:', err)
      }
    }
    loadPendingCount()
  }, [user])

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="size-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
          <Package className="size-4 text-white" />
        </div>
        <span className="font-display font-bold text-lg text-sidebar-foreground">RentItOut</span>
      </div>

      {/* User info */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <UserAvatar name={profile?.name ?? ''} avatarUrl={profile?.avatar_url} size="md" />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-sidebar-foreground truncate">{profile?.name}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{profile?.city}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(to, exact)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
            {label === 'Requests' && pendingCount > 0 && (
              <span className="ml-auto size-5 rounded-full bg-[var(--brand)] text-white text-xs flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <Button
          asChild
          className="w-full bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white gap-2"
          size="sm"
        >
          <Link to="/list-item"><PlusCircle className="size-4" /> List New Item</Link>
        </Button>
        <button
          onClick={() => { signOut(); navigate('/') }}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="size-4" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar flex-col h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-white sticky top-0 z-40">
          <button onClick={() => setMobileOpen(true)} className="p-1">
            <Menu className="size-5" />
          </button>
          <span className="font-display font-semibold text-sm">Dashboard</span>
        </div>

        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
