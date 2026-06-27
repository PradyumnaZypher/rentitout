import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ArrowRight, Camera, Wrench, Bike, Projector, Star, Shield, Clock, MapPin, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ListingCard } from '@/components/listings/ListingCard'
import { supabase, type Listing, CATEGORIES } from '@/lib/supabase'
import { getCategoryIcon, cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

const HERO_ITEMS = [
  { icon: Camera, label: 'Camera', color: 'text-purple-300', delay: 'float-slow', pos: 'top-1/4 right-[8%]', size: 'size-16' },
  { icon: Wrench, label: 'Drill', color: 'text-orange-300', delay: 'float-medium', pos: 'top-[55%] left-[6%]', size: 'size-12' },
  { icon: Bike, label: 'Bicycle', color: 'text-green-300', delay: 'float-fast', pos: 'bottom-[20%] right-[15%]', size: 'size-14' },
  { icon: Projector, label: 'Projector', color: 'text-blue-300', delay: 'float-slow', pos: 'top-[15%] left-[12%]', size: 'size-10' },
]

const STATS = [
  { value: '2,400+', label: 'Items Listed' },
  { value: '1,800+', label: 'Happy Renters' },
  { value: '50+', label: 'Cities' },
]

const HOW_IT_WORKS = [
  { step: '01', icon: Search, title: 'Search', desc: 'Find what you need nearby. Browse by category, location, or price.' },
  { step: '02', icon: Clock, title: 'Book', desc: 'Send a rental request for the dates you need. Owner gets notified instantly.' },
  { step: '03', icon: MapPin, title: 'Meet & Rent', desc: 'Collect the item, use it, and return it when done. Simple as that.' },
]

export default function Home() {
  const [search, setSearch] = useState('')
  const [featured, setFeatured] = useState<Listing[]>([])
  const [loadingListings, setLoadingListings] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchFeatured() {
      const { data } = await supabase
        .from('listings')
        .select('*, owner:profiles(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(8)
      setFeatured((data as Listing[]) ?? [])
      setLoadingListings(false)
    }
    fetchFeatured()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(`/browse?q=${encodeURIComponent(search)}`)
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen hero-gradient flex items-center overflow-hidden">
        {HERO_ITEMS.map(({ icon: Icon, label, color, delay, pos, size }) => (
          <div key={label} className={cn('absolute opacity-20 pointer-events-none', pos, delay)}>
            <Icon className={cn(size, color)} strokeWidth={1.5} />
          </div>
        ))}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <div className="animate-fade-in-up inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
            <Star className="size-3.5 fill-[var(--brand)] text-[var(--brand)]" />
            <span className="text-sm text-white/90 font-medium">India's #1 Peer-to-Peer Rental Platform</span>
          </div>

          <h1 className="animate-fade-in-up-delay-1 font-display font-bold text-4xl sm:text-5xl lg:text-7xl text-white mb-6 leading-tight">
            Rent anything.
            <br />
            <span className="text-[var(--brand)]">From anyone.</span>
            <br />
            Near you.
          </h1>

          <p className="animate-fade-in-up-delay-2 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Borrow a drill for a weekend. Rent your camera while it sits idle.
            <br className="hidden sm:block" />
            Save money. Earn money.
          </p>

          <div className="animate-fade-in-up-delay-2 flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link to="/browse">
              <Button size="lg" className="bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white px-8 h-12 text-base gap-2">
                Browse Items <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/list-item">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:text-white px-8 h-12 text-base gap-2 bg-transparent">
                List Your Gear
              </Button>
            </Link>
          </div>

          <form onSubmit={handleSearch} className="animate-fade-in-up-delay-3 max-w-2xl mx-auto flex gap-2 bg-white rounded-2xl p-2 shadow-2xl">
            <div className="flex-1 flex items-center gap-3 px-3">
              <Search className="size-5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for a camera, drill, tent..."
                className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
              />
            </div>
            <Button type="submit" className="bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white rounded-xl px-5">
              Search
            </Button>
          </form>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" className="w-full">
            <path d="M0 80L1440 80L1440 20C1200 70 960 80 720 60C480 40 240 10 0 40V80Z" fill="oklch(0.982 0.002 240)" />
          </svg>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="bg-white border-y border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-display font-bold text-3xl text-[var(--navy)] price-display">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-[var(--brand)] uppercase tracking-wider">Simple Process</span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[var(--navy)] mt-2">How It Works</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Renting is as easy as 1, 2, 3. No complicated setup needed.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, idx) => (
              <div key={title} className="relative">
                {idx < 2 && <div className="hidden md:block absolute top-10 -right-4 text-muted-foreground/30 text-2xl z-10">→</div>}
                <div className="bg-card rounded-2xl p-8 border border-border hover:border-[var(--brand)]/30 hover:shadow-md transition-all text-center">
                  <div className="relative inline-block mb-6">
                    <div className="size-16 rounded-2xl bg-[var(--brand-soft)] flex items-center justify-center">
                      <Icon className="size-7 text-[var(--brand)]" />
                    </div>
                    <span className="absolute -top-2 -right-2 size-6 rounded-full bg-[var(--brand)] text-white text-xs font-bold font-display flex items-center justify-center">
                      {step.slice(-1)}
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-xl text-[var(--navy)] mb-3">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Pills */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display font-bold text-2xl text-[var(--navy)]">Browse by Category</h2>
            <Link to="/browse" className="text-sm text-[var(--brand)] hover:underline flex items-center gap-1">
              View all <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((cat) => (
              <Link key={cat} to={`/browse?category=${cat}`} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-border bg-white hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] transition-all text-sm font-medium text-foreground shadow-sm">
                <span>{getCategoryIcon(cat)}</span>
                <span>{cat}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <span className="text-sm font-semibold text-[var(--brand)] uppercase tracking-wider">Just Added</span>
              <h2 className="font-display font-bold text-3xl text-[var(--navy)] mt-1">Featured Listings</h2>
            </div>
            <Link to="/browse">
              <Button variant="outline" className="gap-2">Browse All <ArrowRight className="size-4" /></Button>
            </Link>
          </div>
          {loadingListings ? (
            <div className="flex justify-center py-20"><Spinner className="size-8" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featured.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-[var(--navy)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { icon: Shield, title: 'Secure Payments', desc: 'End-to-end protected transactions. Your money is safe until the item is received.' },
              { icon: Star, title: 'Verified Reviews', desc: 'Real reviews from real renters. Make informed decisions every time.' },
              { icon: MapPin, title: 'Local Community', desc: 'Connect with trusted neighbours in your area. Rent from people nearby.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center">
                <div className="size-12 rounded-xl bg-[var(--brand)]/20 flex items-center justify-center mb-4">
                  <Icon className="size-6 text-[var(--brand)]" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-[var(--navy)] mb-4">Have something others might need?</h2>
          <p className="text-muted-foreground text-lg mb-8">Turn your idle items into income. List anything from a camera to a tent.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/list-item">
              <Button size="lg" className="bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white px-8 h-12 text-base gap-2">
                Start Listing <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/browse">
              <Button size="lg" variant="outline" className="px-8 h-12 text-base">Browse Items</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
