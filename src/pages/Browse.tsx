import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, Grid3X3, LayoutList, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ListingCard } from '@/components/listings/ListingCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { supabase, type Listing, CATEGORIES, CONDITIONS } from '@/lib/supabase'
import { getCategoryIcon, cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { useDebounce } from '@/hooks/useDebounce'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'distance', label: 'Nearest to Me' },
]

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get('category') ? searchParams.get('category')!.split(',') : []
  )
  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    searchParams.get('condition') ? searchParams.get('condition')!.split(',') : []
  )
  const [priceRange, setPriceRange] = useState<[number, number]>([
    Number(searchParams.get('minPrice')) || 0,
    Number(searchParams.get('maxPrice')) || 5000
  ])
  const [city, setCity] = useState(searchParams.get('city') ?? '')
  const [sortBy, setSortBy] = useState(searchParams.get('sort') ?? 'newest')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const pageSize = 20
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)

  const debouncedSearch = useDebounce(search, 400)
  const debouncedCity = useDebounce(city, 400)
  const debouncedPrice = useDebounce(priceRange, 400)

  // Sync to URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (selectedCategories.length) params.set('category', selectedCategories.join(','))
    if (selectedConditions.length) params.set('condition', selectedConditions.join(','))
    if (debouncedPrice[0] > 0) params.set('minPrice', debouncedPrice[0].toString())
    if (debouncedPrice[1] < 5000) params.set('maxPrice', debouncedPrice[1].toString())
    if (debouncedCity) params.set('city', debouncedCity)
    if (sortBy !== 'newest') params.set('sort', sortBy)
    if (page > 1) params.set('page', page.toString())
    
    setSearchParams(params, { replace: true })
  }, [debouncedSearch, selectedCategories, selectedConditions, debouncedPrice, debouncedCity, sortBy, page, setSearchParams])


  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude)
          setUserLng(pos.coords.longitude)
        },
        (err) => console.warn('Geolocation blocked or failed:', err),
        { timeout: 5000 }
      )
    }
  }, [])

  const fetchListings = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: err } = await supabase.rpc('search_listings_advanced', {
        search_query: debouncedSearch || null,
        user_lat: userLat,
        user_lng: userLng,
        categories: selectedCategories.length > 0 ? selectedCategories : null,
        conditions: selectedConditions.length > 0 ? selectedConditions : null,
        min_price: debouncedPrice[0],
        max_price: debouncedPrice[1],
        city_filter: debouncedCity || null,
        sort_by: sortBy,
        limit_count: pageSize,
        offset_count: (page - 1) * pageSize
      })

      if (err) throw err

      const mappedListings = (data || []).map((row: any) => ({
        ...row,
        owner: { name: row.owner_name, avatar_url: row.owner_avatar }
      })) as Listing[]

      setListings(mappedListings)
      setTotal(data?.[0]?.total_count ?? 0)
    } catch (e: any) {
      console.error('Failed to fetch listings:', e)
      setError('We couldn\'t load the listings. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedCategories, selectedConditions, debouncedPrice, debouncedCity, sortBy, page, userLat, userLng])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const toggleCondition = (cond: string) => {
    setSelectedConditions((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond]
    )
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedCategories([])
    setSelectedConditions([])
    setPriceRange([0, 5000])
    setCity('')
    setSortBy('newest')
    setPage(1)
  }

  const hasFilters =
    selectedCategories.length > 0 ||
    selectedConditions.length > 0 ||
    priceRange[0] > 0 ||
    priceRange[1] < 5000 ||
    city !== ''

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h4 className="font-semibold text-sm font-display mb-3">Category</h4>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={selectedCategories.includes(cat)}
                onCheckedChange={() => toggleCategory(cat)}
              />
              <span className="text-sm">{getCategoryIcon(cat)} {cat}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h4 className="font-semibold text-sm font-display mb-3">Price per Day</h4>
        <Slider
          min={0}
          max={5000}
          step={50}
          value={priceRange}
          onValueChange={(val) => setPriceRange(val as [number, number])}
          className="mb-2"
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>₹{priceRange[0]}</span>
          <span>₹{priceRange[1]}</span>
        </div>
      </div>

      {/* Condition */}
      <div>
        <h4 className="font-semibold text-sm font-display mb-3">Condition</h4>
        <div className="space-y-2">
          {CONDITIONS.map((cond) => (
            <label key={cond} className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={selectedConditions.includes(cond)}
                onCheckedChange={() => toggleCondition(cond)}
              />
              <span className="text-sm">{cond}</span>
            </label>
          ))}
        </div>
      </div>

      {/* City */}
      <div>
        <h4 className="font-semibold text-sm font-display mb-3">City</h4>
        <Input
          placeholder="e.g. Mumbai, Delhi..."
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="text-sm"
        />
      </div>

      {hasFilters && (
        <Button variant="outline" size="sm" onClick={clearFilters} className="w-full gap-2">
          <X className="size-4" /> Clear All Filters
        </Button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-background pt-16">
      {/* Header */}
      <div className="bg-white border-b border-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-display font-bold text-2xl text-[var(--navy)] mb-4">Browse Listings</h1>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="pl-10"
              />
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mobile filter trigger */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden gap-2">
                  <SlidersHorizontal className="size-4" />
                  Filters
                  {hasFilters && <Badge className="bg-[var(--brand)] text-white px-1.5 h-5 text-xs">{selectedCategories.length + selectedConditions.length}</Badge>}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FiltersContent />
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden sm:flex items-center border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={cn('p-2.5 transition-colors', view === 'grid' ? 'bg-[var(--navy)] text-white' : 'hover:bg-muted')}
              >
                <Grid3X3 className="size-4" />
              </button>
              <button
                onClick={() => setView('list')}
                className={cn('p-2.5 transition-colors', view === 'list' ? 'bg-[var(--navy)] text-white' : 'hover:bg-muted')}
              >
                <LayoutList className="size-4" />
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {(selectedCategories.length > 0 || selectedConditions.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedCategories.map((cat) => (
                <Badge key={cat} variant="secondary" className="gap-1 cursor-pointer hover:bg-muted-foreground/20" onClick={() => toggleCategory(cat)}>
                  {getCategoryIcon(cat)} {cat} <X className="size-3" />
                </Badge>
              ))}
              {selectedConditions.map((cond) => (
                <Badge key={cond} variant="secondary" className="gap-1 cursor-pointer hover:bg-muted-foreground/20" onClick={() => toggleCondition(cond)}>
                  {cond} <X className="size-3" />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar filters - desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="bg-card rounded-2xl border border-border p-5 sticky top-24">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-semibold">Filters</h3>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-[var(--brand)] hover:underline">
                    Clear all
                  </button>
                )}
              </div>
              <FiltersContent />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-5">
              {loading ? 'Loading...' : `Showing ${listings.length} of ${total} items`}
            </p>

            {error ? (
              <EmptyState
                icon="⚠️"
                title="Something went wrong"
                description={error}
                action={
                  <Button onClick={fetchListings} variant="outline">
                    Try Again
                  </Button>
                }
              />
            ) : loading ? (
              <div className="flex justify-center py-20">
                <Spinner className="size-8" />
              </div>
            ) : listings.length === 0 ? (
              <EmptyState
                icon="🔍"
                title={hasFilters || search ? 'No matching listings' : 'No listings available'}
                description={hasFilters || search ? 'Try adjusting your filters or search terms.' : 'Check back later for new items!'}
                action={
                  (hasFilters || search) ? (
                    <Button onClick={clearFilters} variant="outline" className="gap-2">
                      <X className="size-4" /> Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className={cn(
                  'grid gap-5 mb-8',
                  view === 'grid'
                    ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                    : 'grid-cols-1'
                )}>
                  {listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))}
                </div>

                {/* Pagination Controls */}
                {total > pageSize && (
                  <div className="flex items-center justify-center gap-2 mt-8 border-t border-border pt-8">
                    <Button 
                      variant="outline" 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground mx-4">
                      Page {page} of {Math.ceil(total / pageSize)}
                    </span>
                    <Button 
                      variant="outline" 
                      onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                      disabled={page >= Math.ceil(total / pageSize)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
