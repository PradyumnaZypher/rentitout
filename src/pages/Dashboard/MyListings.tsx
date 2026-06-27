import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit, Trash2, Pause, Play, Eye, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { supabase, type Listing } from '@/lib/supabase'
import { formatPrice, getCategoryIcon, cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

export default function MyListings() {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function loadListings() {
    if (!user) return
    try {
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      setListings((data as Listing[]) ?? [])
    } catch (err) {
      console.error('Error loading listings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadListings() }, [user])

  const toggleStatus = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from('listings').update({ is_active: !isActive }).eq('id', id)
    if (error) { toast.error('Failed to update status'); return }
    setListings((prev) => prev.map((l) => l.id === id ? { ...l, is_active: !isActive } : l))
    toast.success(isActive ? 'Listing paused' : 'Listing activated')
  }

  const deleteListing = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('listings').delete().eq('id', deleteId)
    if (error) { toast.error('Failed to delete listing'); return }
    setListings((prev) => prev.filter((l) => l.id !== deleteId))
    setDeleteId(null)
    toast.success('Listing deleted')
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="size-8" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--navy)]">My Listings</h1>
          <p className="text-muted-foreground mt-1">{listings.length} item{listings.length !== 1 ? 's' : ''} listed</p>
        </div>
        <Button asChild className="bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white gap-2">
          <Link to="/list-item"><Plus className="size-4" /> Add New</Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No listings yet"
          description="Start earning by listing items you own. It's free and takes less than 5 minutes."
          action={
            <Button asChild className="bg-[var(--brand)] text-white gap-2">
              <Link to="/list-item"><Plus className="size-4" /> List Your First Item</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => (
            <div key={listing.id} className="bg-card rounded-2xl border border-border p-4 flex gap-4 items-start">
              {/* Image */}
              <div className="size-20 rounded-xl overflow-hidden bg-muted shrink-0">
                <img
                  src={listing.images?.[0] ?? 'https://images.unsplash.com/photo-1558618047-3c8d69fa1679?w=400'}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1558618047-3c8d69fa1679?w=400' }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold font-display truncate">{listing.title}</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/listing/${listing.id}`} className="flex items-center gap-2">
                          <Eye className="size-4" /> View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/edit-listing/${listing.id}`} className="flex items-center gap-2">
                          <Edit className="size-4" /> Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStatus(listing.id, listing.is_active)} className="flex items-center gap-2">
                        {listing.is_active ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> Activate</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(listing.id)}
                        className="text-destructive flex items-center gap-2"
                      >
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{getCategoryIcon(listing.category)} {listing.category}</span>
                  <span className="text-[var(--brand)] font-semibold price-display">{formatPrice(listing.price_per_day)}/day</span>
                  <Badge variant={listing.is_active ? 'default' : 'secondary'} className={cn(listing.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                    {listing.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete listing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this listing and all associated bookings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteListing} variant="destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
