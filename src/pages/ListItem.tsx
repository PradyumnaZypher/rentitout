import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Check, ChevronLeft, ChevronRight, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase, CATEGORIES, CONDITIONS } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { cn, compressImage } from '@/lib/utils'

const STEPS = ['Item Details', 'Pricing & Availability', 'Photos & Location']

const step1Schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  category: z.string().min(1, 'Select a category'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(500, 'Max 500 characters'),
  condition: z.string().min(1, 'Select condition'),
  rules: z.string().optional(),
})

const step2Schema = z.object({
  price_per_day: z.string().min(1, 'Price is required'),
  min_days: z.string(),
  max_days: z.string(),
  deposit: z.string().optional(),
})

const step3Schema = z.object({
  city: z.string().min(2, 'City is required'),
  area: z.string().min(2, 'Area is required'),
})

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema)
type FormData = z.infer<typeof fullSchema>

export default function ListItem() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, control, trigger, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: { min_days: '1', max_days: '30' },
  })

  const description = watch('description', '')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages = acceptedFiles.slice(0, 5 - images.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setImages((prev) => [...prev, ...newImages].slice(0, 5))
  }, [images])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 5,
    maxSize: 5 * 1024 * 1024,
  })

  const removeImage = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const nextStep = async () => {
    const stepFields: Array<keyof FormData>[] = [
      ['title', 'category', 'description', 'condition'],
      ['price_per_day', 'min_days', 'max_days'],
      ['city', 'area'],
    ]
    const valid = await trigger(stepFields[step])
    if (valid) setStep((s) => s + 1)
  }

  const onSubmit = async (data: FormData) => {
    if (!user) return
    setSubmitting(true)

    // 1. Geocode Location (Zero-Cost via OpenStreetMap Nominatim)
    let lat: number | null = null
    let lng: number | null = null
    try {
      const q = encodeURIComponent(`${data.area}, ${data.city}`)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`)
      const geoData = await res.json()
      if (geoData && geoData.length > 0) {
        lat = parseFloat(geoData[0].lat)
        lng = parseFloat(geoData[0].lon)
      }
    } catch (err) {
      console.warn('Geocoding failed:', err)
    }

    let imageUrls: string[] = []
    if (images.length > 0) {
      for (const img of images) {
        try {
          const compressedFile = await compressImage(img.file)
          // Always webp due to our compression function
          const path = `listings/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`
          const { data: uploadData, error } = await supabase.storage
            .from('listing-images')
            .upload(path, compressedFile, { cacheControl: '3600', upsert: false })
          if (!error && uploadData) {
            const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(path)
            imageUrls.push(publicUrl)
          }
        } catch (e) {
          console.error('Image processing failed:', e)
        }
      }
    }
    if (imageUrls.length === 0) {
      imageUrls = ['https://images.unsplash.com/photo-1558618047-3c8d69fa1679?w=800']
    }

    const { data: listing, error } = await supabase.from('listings').insert({
      title: data.title,
      description: data.description,
      category: data.category,
      condition: data.condition,
      price_per_day: parseFloat(data.price_per_day),
      min_days: parseInt(data.min_days),
      max_days: parseInt(data.max_days),
      deposit: data.deposit ? parseFloat(data.deposit) : null,
      rules: data.rules ?? null,
      city: data.city,
      area: data.area,
      images: imageUrls,
      owner_id: user.id,
      lat,
      lng,
    }).select().maybeSingle()

    setSubmitting(false)
    if (error) { toast.error('Failed to create listing. Please try again.'); return }
    toast.success('Listing created successfully!')
    navigate(listing ? `/listing/${listing.id}` : '/dashboard/my-listings')
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            {STEPS.map((s, idx) => (
              <div key={s} className={cn('flex-1 flex flex-col items-center gap-2 relative')}>
                {idx < STEPS.length - 1 && (
                  <div className={cn('absolute top-4 left-1/2 w-full h-0.5 z-0', idx < step ? 'bg-[var(--brand)]' : 'bg-border')} />
                )}
                <div className={cn(
                  'size-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all relative z-10',
                  idx < step ? 'bg-[var(--brand)] border-[var(--brand)] text-white'
                    : idx === step ? 'border-[var(--brand)] text-[var(--brand)] bg-white'
                    : 'border-border text-muted-foreground bg-white'
                )}>
                  {idx < step ? <Check className="size-4" /> : idx + 1}
                </div>
                <span className={cn('text-xs font-medium text-center hidden sm:block', idx === step ? 'text-[var(--brand)]' : 'text-muted-foreground')}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 sm:p-8">
          <h1 className="font-display font-bold text-2xl text-[var(--navy)] mb-6">{STEPS[step]}</h1>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 1 */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <Label htmlFor="title" className="mb-1.5">Item Name *</Label>
                  <Input id="title" placeholder="e.g. Canon EOS R5 Camera with 24-70mm lens" {...register('title')} />
                  {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5">Category *</Label>
                    <Controller name="category" control={control} render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    )} />
                    {errors.category && <p className="text-xs text-destructive mt-1">{errors.category.message}</p>}
                  </div>
                  <div>
                    <Label className="mb-1.5">Condition *</Label>
                    <Controller name="condition" control={control} render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                        <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    )} />
                    {errors.condition && <p className="text-xs text-destructive mt-1">{errors.condition.message}</p>}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="description">Description *</Label>
                    <span className="text-xs text-muted-foreground">{description.length}/500</span>
                  </div>
                  <textarea id="description" rows={4} maxLength={500} placeholder="Describe your item — its features, what's included, and who might need it..." className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none placeholder:text-muted-foreground" {...register('description')} />
                  {errors.description && <p className="text-xs text-destructive mt-1">{errors.description.message}</p>}
                </div>
                <div>
                  <Label htmlFor="rules" className="mb-1.5">Rental Rules (optional)</Label>
                  <textarea id="rules" rows={2} placeholder="e.g. No commercial use, return fully charged..." className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none placeholder:text-muted-foreground" {...register('rules')} />
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <Label htmlFor="price_per_day" className="mb-1.5">Price per Day (₹) *</Label>
                  <Input id="price_per_day" type="number" min="1" placeholder="500" className="font-mono" {...register('price_per_day')} />
                  {errors.price_per_day && <p className="text-xs text-destructive mt-1">{errors.price_per_day.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_days" className="mb-1.5">Minimum Days</Label>
                    <Input id="min_days" type="number" min="1" {...register('min_days')} />
                  </div>
                  <div>
                    <Label htmlFor="max_days" className="mb-1.5">Maximum Days</Label>
                    <Input id="max_days" type="number" min="1" {...register('max_days')} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="deposit" className="mb-1.5">Security Deposit (₹) — optional</Label>
                  <Input id="deposit" type="number" min="0" placeholder="1000" {...register('deposit')} />
                  <p className="text-xs text-muted-foreground mt-1">Collected as security, returned after safe return</p>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <Label className="mb-2 block">Photos ({images.length}/5)</Label>
                  <div {...getRootProps()} className={cn('border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all', isDragActive ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-border hover:border-[var(--brand)]/50 hover:bg-muted/30')}>
                    <input {...getInputProps()} />
                    <ImagePlus className={cn('size-8 mx-auto mb-2', isDragActive ? 'text-[var(--brand)]' : 'text-muted-foreground')} />
                    <p className="text-sm text-muted-foreground">{isDragActive ? 'Drop images here' : 'Drag & drop images, or click to browse'}</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB each. Max 5 images.</p>
                  </div>
                  {images.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative size-20 rounded-lg overflow-hidden border border-border">
                          <img src={img.preview} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 size-5 rounded-full bg-black/70 text-white flex items-center justify-center">
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city" className="mb-1.5">City *</Label>
                    <Input id="city" placeholder="Mumbai" {...register('city')} />
                    {errors.city && <p className="text-xs text-destructive mt-1">{errors.city.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="area" className="mb-1.5">Area / Neighbourhood *</Label>
                    <Input id="area" placeholder="Bandra, Koramangala..." {...register('area')} />
                    {errors.area && <p className="text-xs text-destructive mt-1">{errors.area.message}</p>}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <Button type="button" variant="outline" onClick={() => step > 0 ? setStep((s) => s - 1) : navigate(-1)} className="gap-2">
                <ChevronLeft className="size-4" /> {step === 0 ? 'Cancel' : 'Back'}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={nextStep} className="bg-[var(--brand)] text-white gap-2">
                  Next <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={submitting} className="bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white gap-2">
                  {submitting ? <><Spinner /> Creating...</> : <><Check className="size-4" /> Create Listing</>}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
