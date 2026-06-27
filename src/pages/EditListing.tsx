import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase, CATEGORIES, CONDITIONS } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

const schema = z.object({
  title: z.string().min(5),
  category: z.string().min(1),
  description: z.string().min(20).max(500),
  condition: z.string().min(1),
  rules: z.string().optional(),
  price_per_day: z.string(),
  min_days: z.string(),
  max_days: z.string(),
  deposit: z.string().optional(),
  city: z.string().min(2),
  area: z.string().min(2),
})
type FormData = z.infer<typeof schema>

export default function EditListing() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!id) return
    supabase.from('listings').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (!data || data.owner_id !== user?.id) {
        navigate('/dashboard/my-listings')
        return
      }
      reset({
        title: data.title,
        category: data.category,
        description: data.description,
        condition: data.condition,
        rules: data.rules ?? '',
        price_per_day: String(data.price_per_day),
        min_days: String(data.min_days),
        max_days: String(data.max_days),
        deposit: data.deposit ? String(data.deposit) : '',
        city: data.city,
        area: data.area,
      })
      setLoading(false)
    })
  }, [id, user, navigate, reset])

  const onSubmit = async (data: FormData) => {
    const { error } = await supabase.from('listings').update({
      title: data.title,
      category: data.category,
      description: data.description,
      condition: data.condition,
      rules: data.rules ?? null,
      price_per_day: parseFloat(data.price_per_day),
      min_days: parseInt(data.min_days),
      max_days: parseInt(data.max_days),
      deposit: data.deposit ? parseFloat(data.deposit) : null,
      city: data.city,
      area: data.area,
      updated_at: new Date().toISOString(),
    }).eq('id', id!)
    if (error) { toast.error('Failed to update listing'); return }
    toast.success('Listing updated!')
    navigate(`/listing/${id}`)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center pt-16"><Spinner className="size-8" /></div>

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="size-4" /> Back
        </button>
        <h1 className="font-display font-bold text-2xl text-[var(--navy)] mb-6">Edit Listing</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div>
            <Label htmlFor="title" className="mb-1.5">Item Name *</Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5">Category *</Label>
              <Controller name="category" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            <div>
              <Label className="mb-1.5">Condition *</Label>
              <Controller name="condition" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div>
            <Label htmlFor="description" className="mb-1.5">Description *</Label>
            <textarea id="description" rows={4} maxLength={500} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none" {...register('description')} />
          </div>
          <div>
            <Label htmlFor="rules" className="mb-1.5">Rules (optional)</Label>
            <textarea id="rules" rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none" {...register('rules')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="price_per_day" className="mb-1.5">Price/Day (₹) *</Label>
              <Input id="price_per_day" type="number" {...register('price_per_day')} />
            </div>
            <div>
              <Label htmlFor="min_days" className="mb-1.5">Min Days</Label>
              <Input id="min_days" type="number" {...register('min_days')} />
            </div>
            <div>
              <Label htmlFor="max_days" className="mb-1.5">Max Days</Label>
              <Input id="max_days" type="number" {...register('max_days')} />
            </div>
          </div>
          <div>
            <Label htmlFor="deposit" className="mb-1.5">Deposit (₹) — optional</Label>
            <Input id="deposit" type="number" {...register('deposit')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city" className="mb-1.5">City *</Label>
              <Input id="city" {...register('city')} />
            </div>
            <div>
              <Label htmlFor="area" className="mb-1.5">Area *</Label>
              <Input id="area" {...register('area')} />
            </div>
          </div>
          <div className="pt-2 flex gap-3">
            <Button type="submit" disabled={isSubmitting} className="bg-[var(--brand)] text-white gap-2">
              {isSubmitting ? <Spinner /> : <><Save className="size-4" /> Save Changes</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
