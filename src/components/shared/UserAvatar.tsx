import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  xs: 'size-6 text-xs',
  sm: 'size-8 text-sm',
  md: 'size-10 text-base',
  lg: 'size-12 text-lg',
  xl: 'size-16 text-xl',
}

export function UserAvatar({ name, avatarUrl, size = 'md', className }: AvatarProps) {
  const initials = getInitials(name || 'U')

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn('rounded-full object-cover', sizeClasses[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white font-display',
        'bg-gradient-to-br from-[var(--brand)] to-[oklch(0.45_0.18_20)]',
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  )
}
