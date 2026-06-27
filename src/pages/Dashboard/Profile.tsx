import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, MapPin, Phone, FileText, Camera, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

const schema = z.object({
  name: z.string().min(2, 'Required'),
  city: z.string().min(2, 'Required'),
  phone: z.string().optional(),
  bio: z.string().max(300, 'Max 300 characters').optional(),
})
type FormData = z.infer<typeof schema>

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name,
        city: profile.city,
        phone: profile.phone ?? '',
        bio: profile.bio ?? '',
      })
    }
  }, [profile, reset])

  const bio = watch('bio', '')

  const onSubmit = async (data: FormData) => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ name: data.name, city: data.city, phone: data.phone, bio: data.bio })
      .eq('id', user.id)
    if (error) {
      toast.error('Failed to save changes')
    } else {
      await refreshProfile()
      toast.success('Profile updated!')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-[var(--navy)]">Profile Settings</h1>
        <p className="text-muted-foreground mt-1">Update your personal information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Avatar */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-2xl border border-border p-6 text-center">
            <div className="relative inline-block mb-4">
              <UserAvatar name={profile?.name ?? ''} avatarUrl={profile?.avatar_url} size="xl" />
              <button className="absolute bottom-0 right-0 size-8 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shadow">
                <Camera className="size-4" />
              </button>
            </div>
            <h3 className="font-semibold font-display">{profile?.name}</h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-sm text-muted-foreground mt-1">{profile?.city}</p>
            {profile?.is_verified && (
              <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                ✓ Verified
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="bg-card rounded-2xl border border-border p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="name" className="mb-1.5">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input id="name" placeholder="Your name" className="pl-10" {...register('name')} />
                </div>
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <Label htmlFor="city" className="mb-1.5">City</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input id="city" placeholder="Mumbai" className="pl-10" {...register('city')} />
                </div>
                {errors.city && <p className="text-xs text-destructive mt-1">{errors.city.message}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="phone" className="mb-1.5">Phone (optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="phone" placeholder="+91 9XXXXXXXXX" className="pl-10" {...register('phone')} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="bio">Bio (optional)</Label>
                <span className="text-xs text-muted-foreground">{(bio ?? '').length}/300</span>
              </div>
              <div className="relative">
                <FileText className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <textarea
                  id="bio"
                  rows={3}
                  maxLength={300}
                  placeholder="Tell others about yourself..."
                  className="w-full rounded-md border border-input bg-transparent pl-10 pr-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none placeholder:text-muted-foreground"
                  {...register('bio')}
                />
              </div>
              {errors.bio && <p className="text-xs text-destructive mt-1">{errors.bio.message}</p>}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white gap-2"
              >
                {saving ? <Spinner /> : <><Save className="size-4" /> Save Changes</>}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
