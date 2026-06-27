import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Heart, Star, Dot } from 'lucide-react'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { type Listing } from '@/lib/supabase'
import { formatPrice, getCategoryColor, getCategoryIcon, cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store'
import { toast } from 'sonner'

interface ListingCardProps {
  listing: Listing
  wishlisted?: boolean
  onWishlistToggle?: (id: string, isWishlisted: boolean) => void
}

export function ListingCard({ listing, wishlisted = false, onWishlistToggle }: ListingCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(wishlisted)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [imgError, setImgError] = useState(false)
  const { user } = useAuthStore()

  const primaryImage = !imgError && listing.images?.[0]
    ? listing.images[0]
    : 'https://images.unsplash.com/photo-1558618047-3c8d69fa1679?w=800'

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      toast.error('Sign in to save items to wishlist')
      return
    }
    setWishlistLoading(true)
    try {
      if (isWishlisted) {
        await supabase.from('wishlists').delete().match({ user_id: user.id, listing_id: listing.id })
      } else {
        await supabase.from('wishlists').insert({ user_id: user.id, listing_id: listing.id })
      }
      setIsWishlisted(!isWishlisted)
      onWishlistToggle?.(listing.id, !isWishlisted)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setWishlistLoading(false)
    }
  }

  const avgRating = listing.avg_rating ?? 0
  const reviewCount = listing.review_count ?? 0

  return (
    <Link to={`/listing/${listing.id}`} className="block group">
      <div className="bg-card rounded-2xl overflow-hidden border border-border listing-card-hover shadow-sm">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={primaryImage}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
            loading="lazy"
          />

          {/* Category badge */}
          <div className="absolute top-3 left-3">
            <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full', getCategoryColor(listing.category))}>
              {getCategoryIcon(listing.category)} {listing.category}
            </span>
          </div>

          {/* Wishlist button */}
          <button
            onClick={handleWishlist}
            disabled={wishlistLoading}
            className="absolute top-3 right-3 size-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-all shadow-sm"
          >
            <Heart
              className={cn(
                'size-4 transition-colors',
                isWishlisted ? 'fill-[var(--brand)] text-[var(--brand)]' : 'text-foreground/60'
              )}
            />
          </button>

          {/* Available indicator */}
          <div className="absolute bottom-3 left-3">
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/90 text-white">
              <Dot className="size-3 -mx-1" /> Available
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold font-display text-foreground line-clamp-1 mb-1 group-hover:text-[var(--brand)] transition-colors">
            {listing.title}
          </h3>

          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{listing.area}, {listing.city}</span>
          </div>

          {/* Rating */}
          {reviewCount > 0 && (
            <div className="flex items-center gap-1 mb-3">
              <Star className="size-3 fill-[var(--brand)] text-[var(--brand)]" />
              <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({reviewCount})</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-bold price-display text-[var(--brand)]">
                {formatPrice(listing.price_per_day)}
              </span>
              <span className="text-sm text-muted-foreground font-normal"> / day</span>
            </div>

            {listing.owner && (
              <div className="flex items-center gap-2">
                <UserAvatar
                  name={listing.owner.name}
                  avatarUrl={listing.owner.avatar_url}
                  size="xs"
                />
                <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-20">
                  {listing.owner.name.split(' ')[0]}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
