import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  maxRating?: number
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  onChange?: (rating: number) => void
  className?: string
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const sizes = { sm: 'size-3', md: 'size-4', lg: 'size-5' }

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {Array.from({ length: maxRating }, (_, i) => {
        const filled = i < Math.floor(rating)
        const partial = !filled && i < rating
        return (
          <button
            key={i}
            type={interactive ? 'button' : undefined}
            onClick={() => interactive && onChange?.(i + 1)}
            className={cn(
              'relative',
              interactive && 'cursor-pointer hover:scale-110 transition-transform'
            )}
          >
            <Star
              className={cn(
                sizes[size],
                filled
                  ? 'fill-[var(--brand)] text-[var(--brand)]'
                  : partial
                  ? 'fill-[var(--brand)]/50 text-[var(--brand)]'
                  : 'fill-muted text-muted-foreground'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
