import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, Search, ChevronDown, LogOut, User, LayoutDashboard, PlusCircle, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const isHome = location.pathname === '/'

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled || !isHome
          ? 'bg-white/95 backdrop-blur-md border-b border-border shadow-sm'
          : 'bg-transparent'
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl">
          <div className="size-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
            <Package className="size-4 text-white" />
          </div>
          <span
            className={cn(
              'transition-colors duration-300',
              scrolled || !isHome ? 'text-[var(--navy)]' : 'text-white'
            )}
          >
            RentItOut
          </span>
        </Link>

        {/* Center links */}
        <div className="hidden md:flex items-center gap-1">
          {[
            { to: '/browse', label: 'Browse' },
            { to: '/#how-it-works', label: 'How It Works' },
            { to: '/about', label: 'About' },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200',
                scrolled || !isHome
                  ? 'text-foreground/70 hover:text-foreground hover:bg-muted'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'hidden md:flex gap-2',
                  scrolled || !isHome ? '' : 'text-white hover:bg-white/10 hover:text-white'
                )}
                onClick={() => navigate('/list-item')}
              >
                <PlusCircle className="size-4" />
                List Item
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full p-1 hover:bg-muted/50 transition-colors">
                    <UserAvatar name={profile?.name ?? ''} avatarUrl={profile?.avatar_url} size="sm" />
                    <ChevronDown className={cn('size-3 hidden md:block', scrolled || !isHome ? 'text-foreground' : 'text-white')} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2">
                    <p className="font-semibold text-sm truncate">{profile?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center gap-2">
                      <LayoutDashboard className="size-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/profile" className="flex items-center gap-2">
                      <User className="size-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/list-item" className="flex items-center gap-2">
                      <PlusCircle className="size-4" />
                      List New Item
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { signOut(); navigate('/') }}
                    className="text-destructive focus:text-destructive flex items-center gap-2"
                  >
                    <LogOut className="size-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'hidden md:flex',
                    scrolled || !isHome ? '' : 'text-white hover:bg-white/10 hover:text-white'
                  )}
                >
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white">
                  Get Started
                </Button>
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            className={cn(
              'md:hidden p-2 rounded-md',
              scrolled || !isHome ? 'text-foreground' : 'text-white'
            )}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-border">
          <div className="px-4 py-3 space-y-1">
            <Link to="/browse" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted">
              <Search className="size-4" /> Browse
            </Link>
            {user ? (
              <>
                <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted">
                  <LayoutDashboard className="size-4" /> Dashboard
                </Link>
                <Link to="/list-item" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted">
                  <PlusCircle className="size-4" /> List an Item
                </Link>
                <button
                  onClick={() => { signOut(); navigate('/') }}
                  className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="size-4" /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted">
                  Login
                </Link>
                <Link to="/register" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)]">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
