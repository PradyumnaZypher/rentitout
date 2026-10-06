import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, type Listing, type Review } from '@/lib/supabase'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { StarRating } from '@/components/shared/StarRating'
import { ListingCard } from '@/components/listings/ListingCard'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { CheckCircle, MapPin, CalendarDays } from 'lucide-react'
import { formatDate, timeAgo } from '@/lib/utils'

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>()
  
  const [profile, setProfile] = useState<any>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      if (!id) return
      setLoading(true)
      try {
        // Fetch profile
        const { data: profileData, error: profileErr } = await supabase
          .from('public_profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle()

        if (profileErr) throw profileErr
        if (!profileData) {
          setError('Profile not found.')
          return
        }

        // Fetch stats using RPC
        const { data: statsData } = await supabase.rpc('get_user_rating_summary', { target_user_id: id })
        
        // Fetch active listings
        const { data: listingsData } = await supabase
          .from('listings')
          .select('*, owner:public_profiles!owner_id(*)')
          .eq('owner_id', id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        // Fetch recent reviews for this owner
        // We fetch reviews by joining listings!inner
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('*, author:public_profiles!author_id(name, avatar_url), listings!inner(owner_id)')
          .eq('listings.owner_id', id)
          .order('created_at', { ascending: false })
          .limit(10)

        setProfile(profileData)
        setStats(statsData?.[0] || { avg_rating: 0, review_count: 0 })
        setListings((listingsData as Listing[]) ?? [])
        setReviews((reviewsData as unknown as Review[]) ?? [])
      } catch (e: any) {
        console.error('Failed to load profile:', e)
        setError('Failed to load profile. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4">
        <EmptyState 
          icon="👤" 
          title="Profile Unavailable" 
          description={error || "The user you are looking for does not exist."} 
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Left Column: Profile Card */}
        <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
          <div className="bg-card rounded-2xl border border-border p-6 sticky top-24">
            <div className="flex flex-col items-center text-center mb-6">
              <UserAvatar name={profile.name} avatarUrl={profile.avatar_url} size="xl" className="mb-4" />
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-display font-bold text-xl">{profile.name}</h1>
                {profile.is_verified && <CheckCircle className="size-5 text-green-500" />}
              </div>
              <p className="text-muted-foreground flex items-center gap-1 text-sm mt-1">
                <MapPin className="size-4" /> {profile.city || 'Location hidden'}
              </p>
            </div>
            
            {stats && stats.review_count > 0 && (
              <div className="bg-muted rounded-xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <StarRating rating={Number(stats.avg_rating)} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground">{stats.review_count} Reviews</p>
                </div>
                <div className="text-2xl font-bold font-display">
                  {Number(stats.avg_rating).toFixed(1)}
                </div>
              </div>
            )}

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <CalendarDays className="size-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium">Member Since</p>
                  <p className="text-muted-foreground">{formatDate(profile.created_at)}</p>
                </div>
              </div>
            </div>

            {profile.bio && (
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {profile.bio}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Listings and Reviews */}
        <div className="flex-1 min-w-0">
          
          <h2 className="text-2xl font-display font-bold mb-6">Listings by {profile.name}</h2>
          {listings.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground mb-10">
              This owner has no active listings.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
              {listings.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}

          <h2 className="text-2xl font-display font-bold mb-6">Recent Reviews</h2>
          {reviews.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
              No reviews yet.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        name={review.author?.name || 'Unknown User'} 
                        avatarUrl={review.author?.avatar_url} 
                      />
                      <div>
                        <p className="font-medium text-sm">{review.author?.name || 'Unknown User'}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(review.created_at)}</p>
                      </div>
                    </div>
                    <StarRating rating={review.rating} size="sm" />
                  </div>
                  <p className="text-sm text-foreground/90">{review.comment}</p>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
