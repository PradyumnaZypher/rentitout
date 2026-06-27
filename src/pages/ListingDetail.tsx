import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  MapPin, Shield, ChevronLeft, ChevronRight,
  MessageSquare, CheckCircle, Share2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { StarRating } from '@/components/shared/StarRating'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { ListingCard } from '@/components/listings/ListingCard'
import { supabase, type Listing, type Review } from '@/lib/supabase'
import {
  formatPrice, formatDate, getDaysBetween, getCategoryColor, getCategoryIcon,
  getConditionColor, timeAgo, cn
} from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'
import { Spinner } from '@/components/ui/spinner'

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [listing, setListing] = useState<Listing | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [similar, setSimilar] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [currentImageIdx, setCurrentImageIdx] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [message, setMessage] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    async function fetchListing() {
      if (!id) return
      const [{ data: listingData }, { data: reviewData }] = await Promise.all([
        supabase.from('listings').select('*, owner:profiles(*)').eq('id', id).maybeSingle(),
        supabase.from('reviews').select('*, author:profiles(name, avatar_url)').eq('listing_id', id).order('created_at', { ascending: false }),
      ])
      if (!listingData) { navigate('/browse'); return }
      setListing(listingData as Listing)
      setReviews(reviewData ?? [])
      const { data: similarData } = await supabase
        .from('listings').select('*, owner:profiles(*)')
        .eq('category', listingData.category).eq('is_active', true).neq('id', id).limit(4)
      setSimilar((similarData as Listing[]) ?? [])
      setLoading(false)
    }
    fetchListing()
  }, [id, navigate])

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const totalDays = startDate && endDate ? getDaysBetween(new Date(startDate), new Date(endDate)) : 0
  const totalPrice = listing ? totalDays * listing.price_per_day : 0

  const handleBooking = async () => {
    if (!user) { navigate('/login'); return }
    if (!listing || !startDate || !endDate) { toast.error('Please select dates'); return }
    if (user.id === listing.owner_id) { toast.error("You can't rent your own item"); return }
    setBookingLoading(true)
    const { error } = await supabase.from('bookings').insert({ listing_id: listing.id, renter_id: user.id, start_date: startDate, end_date: endDate, total_days: totalDays, total_price: totalPrice, message })
    if (error) toast.error('Failed to send request.')
    else { toast.success('Rental request sent!'); setRequestSent(true) }
    setBookingLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center pt-16"><Spinner className="size-8" /></div>
  if (!listing) return null
  const images = listing.images?.length > 0 ? listing.images : ['https://images.unsplash.com/photo-1558618047-3c8d69fa1679?w=800']

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">Home</Link><span>/</span>
          <Link to="/browse" className="hover:text-foreground">Browse</Link><span>/</span>
          <Link to={`/browse?category=${listing.category}`} className="hover:text-foreground">{listing.category}</Link><span>/</span>
          <span className="text-foreground truncate max-w-48">{listing.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <div className="bg-card rounded-2xl overflow-hidden border border-border mb-6">
              <div className="relative aspect-[4/3] bg-muted">
                <img src={images[currentImageIdx]} alt={listing.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1558618047-3c8d69fa1679?w=800' }} />
                {images.length > 1 && (<>
                  <button onClick={() => setCurrentImageIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow"><ChevronLeft className="size-5" /></button>
                  <button onClick={() => setCurrentImageIdx((i) => (i + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow"><ChevronRight className="size-5" /></button>
                </>)}
                <div className="absolute top-3 left-3"><span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full', getCategoryColor(listing.category))}>{getCategoryIcon(listing.category)} {listing.category}</span></div>
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 p-3 bg-muted/30">
                  {images.map((img, idx) => (
                    <button key={idx} onClick={() => setCurrentImageIdx(idx)} className={cn('size-16 rounded-lg overflow-hidden border-2 transition-all', idx === currentImageIdx ? 'border-[var(--brand)]' : 'border-transparent')}>
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="font-display font-bold text-2xl text-[var(--navy)] leading-tight">{listing.title}</h1>
                <button className="shrink-0 size-9 rounded-full border border-border hover:bg-muted flex items-center justify-center"><Share2 className="size-4" /></button>
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full', getConditionColor(listing.condition))}>{listing.condition} Condition</span>
                {reviews.length > 0 && (<div className="flex items-center gap-1"><StarRating rating={avgRating} size="sm" /><span className="text-sm font-medium">{avgRating.toFixed(1)}</span><span className="text-xs text-muted-foreground">({reviews.length})</span></div>)}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-5"><MapPin className="size-4 shrink-0" />{listing.area}, {listing.city}</div>
              <Separator className="mb-5" />
              <h3 className="font-semibold font-display mb-3">Description</h3>
              <p className="text-muted-foreground leading-relaxed text-sm whitespace-pre-line">{listing.description}</p>
              {listing.rules && (<><Separator className="my-5" /><h3 className="font-semibold font-display mb-3">Rental Rules</h3><div className="bg-[var(--brand-soft)] rounded-xl p-4"><p className="text-sm text-foreground/80 leading-relaxed">{listing.rules}</p></div></>)}
            </div>

            {listing.owner && (
              <div className="bg-card rounded-2xl border border-border p-6 mb-6">
                <h3 className="font-display font-semibold mb-4">About the Owner</h3>
                <div className="flex items-start gap-4">
                  <UserAvatar name={listing.owner.name} avatarUrl={listing.owner.avatar_url} size="lg" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{listing.owner.name}</h4>
                      {listing.owner.is_verified && <CheckCircle className="size-4 text-green-500" />}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{listing.owner.city}</p>
                    <p className="text-xs text-muted-foreground">Member since {formatDate(listing.owner.created_at)}</p>
                    {listing.owner.bio && <p className="text-sm mt-2 text-muted-foreground">{listing.owner.bio}</p>}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-semibold">Reviews</h3>
                {reviews.length > 0 && (<div className="flex items-center gap-2"><StarRating rating={avgRating} /><span className="font-semibold">{avgRating.toFixed(1)}</span><span className="text-sm text-muted-foreground">({reviews.length})</span></div>)}
              </div>
              {reviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No reviews yet.</div>
              ) : (
                <div className="space-y-5">
                  {reviews.map((review) => (
                    <div key={review.id} className="flex gap-3">
                      <UserAvatar name={(review as any).author?.name ?? 'U'} avatarUrl={(review as any).author?.avatar_url} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{(review as any).author?.name}</span>
                          <span className="text-xs text-muted-foreground">{timeAgo(review.created_at)}</span>
                        </div>
                        <StarRating rating={review.rating} size="sm" className="mb-1" />
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {similar.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-lg mb-4">Similar Items</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {similar.map((item) => <ListingCard key={item.id} listing={item} />)}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-4">
              <div className="bg-card rounded-2xl border border-border p-6 shadow-lg">
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-3xl font-bold price-display text-[var(--brand)]">{formatPrice(listing.price_per_day)}</span>
                  <span className="text-muted-foreground">/ day</span>
                </div>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">Start Date</label>
                    <input type="date" value={startDate} min={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setStartDate(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">End Date</label>
                    <input type="date" value={endDate} min={startDate || format(addDays(new Date(), 1), 'yyyy-MM-dd')} onChange={(e) => setEndDate(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">Message (optional)</label>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Introduce yourself..." rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none placeholder:text-muted-foreground" />
                </div>
                {totalDays > 0 && (
                  <div className="bg-muted/50 rounded-xl p-4 mb-4 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">{formatPrice(listing.price_per_day)} × {totalDays} days</span><span>{formatPrice(totalPrice)}</span></div>
                    {listing.deposit && (<div className="flex justify-between text-sm"><span className="text-muted-foreground">Security deposit</span><span>{formatPrice(listing.deposit)}</span></div>)}
                    <Separator />
                    <div className="flex justify-between font-semibold"><span>Total</span><span className="text-[var(--brand)] price-display">{formatPrice(totalPrice + (listing.deposit ?? 0))}</span></div>
                  </div>
                )}
                {requestSent ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="size-5 text-green-600 shrink-0" />
                    <div><p className="font-semibold text-green-800 text-sm">Request Sent!</p><p className="text-xs text-green-600">The owner will respond within 24 hours.</p></div>
                  </div>
                ) : user?.id === listing.owner_id ? (
                  <Button asChild className="w-full bg-[var(--navy)] text-white"><Link to={`/edit-listing/${listing.id}`}>Edit Your Listing</Link></Button>
                ) : (
                  <Button onClick={handleBooking} disabled={bookingLoading || !startDate || !endDate} className="w-full bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white h-11 text-base">
                    {bookingLoading ? <Spinner /> : 'Request to Rent'}
                  </Button>
                )}
                {user?.id !== listing.owner_id && (
                  <Button variant="outline" onClick={() => { if (!user) { navigate('/login'); return } navigate(`/messages?with=${listing.owner_id}&listing=${listing.id}`) }} className="w-full mt-3 gap-2">
                    <MessageSquare className="size-4" /> Message Owner
                  </Button>
                )}
              </div>
              <div className="bg-[var(--brand-soft)] border border-[var(--brand)]/20 rounded-2xl p-4 flex gap-3">
                <Shield className="size-5 text-[var(--brand)] shrink-0 mt-0.5" />
                <div><p className="text-sm font-semibold text-[var(--navy)]">Safety tip</p><p className="text-xs text-muted-foreground mt-1">Always meet in a public place. Inspect the item before signing.</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
