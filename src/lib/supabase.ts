import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
  id: string
  name: string
  avatar_url: string | null
  phone: string | null
  city: string
  bio: string | null
  is_verified: boolean
  created_at: string
}

export type Listing = {
  id: string
  title: string
  description: string
  category: string
  condition: string
  price_per_day: number
  min_days: number
  max_days: number
  deposit: number | null
  rules: string | null
  city: string
  area: string
  images: string[]
  is_active: boolean
  owner_id: string
  view_count: number
  created_at: string
  updated_at: string
  owner?: Profile
  reviews?: Review[]
  avg_rating?: number
  review_count?: number
}

export type Booking = {
  id: string
  start_date: string
  end_date: string
  total_days: number
  total_price: number
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED'
  message: string | null
  renter_id: string
  listing_id: string
  created_at: string
  updated_at: string
  renter?: Profile
  listing?: Listing
}

export type Review = {
  id: string
  rating: number
  comment: string
  author_id: string
  listing_id: string
  booking_id: string
  created_at: string
  author?: Profile
}

export type Message = {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  conversation_id: string
  listing_id: string | null
  read: boolean
  created_at: string
  sender?: Profile
  receiver?: Profile
  listing?: Pick<Listing, 'id' | 'title' | 'images'>
}

export const CATEGORIES = [
  'Tools',
  'Cameras',
  'Sports',
  'Music',
  'Electronics',
  'Outdoor',
  'Party',
  'Others',
] as const

export const CONDITIONS = ['Excellent', 'Good', 'Fair'] as const

export function getConversationId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_')
}
