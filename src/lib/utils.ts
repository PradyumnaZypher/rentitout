import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy')
}

export function getDaysBetween(start: Date, end: Date): number {
  return Math.max(1, differenceInDays(end, start))
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Tools: '🔧',
    Cameras: '📷',
    Sports: '⚽',
    Music: '🎸',
    Electronics: '💻',
    Outdoor: '⛺',
    Party: '🎉',
    Others: '📦',
  }
  return icons[category] ?? '📦'
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Tools: 'bg-orange-100 text-orange-700',
    Cameras: 'bg-purple-100 text-purple-700',
    Sports: 'bg-green-100 text-green-700',
    Music: 'bg-pink-100 text-pink-700',
    Electronics: 'bg-blue-100 text-blue-700',
    Outdoor: 'bg-emerald-100 text-emerald-700',
    Party: 'bg-yellow-100 text-yellow-700',
    Others: 'bg-gray-100 text-gray-700',
  }
  return colors[category] ?? 'bg-gray-100 text-gray-700'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getConditionColor(condition: string): string {
  const colors: Record<string, string> = {
    Excellent: 'bg-green-100 text-green-700',
    Good: 'bg-blue-100 text-blue-700',
    Fair: 'bg-yellow-100 text-yellow-700',
  }
  return colors[condition] ?? 'bg-gray-100 text-gray-700'
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function timeAgo(date: string): string {
  const now = new Date()
  const past = parseISO(date)
  const diffMs = now.getTime() - past.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date)
}

/**
 * Compresses an image file using HTML5 Canvas API
 * @param file The original image file
 * @param maxWidth Maximum width of the compressed image
 * @param quality Compression quality (0 to 1)
 * @returns A Promise resolving to the compressed File
 */
export function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return resolve(file) // Fallback if canvas fails
        }
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file)
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
              type: 'image/webp',
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          'image/webp',
          quality
        )
      }
      img.onerror = (error) => reject(error)
    }
    reader.onerror = (error) => reject(error)
  })
}
