import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Package, Mail, Lock, User, MapPin, CheckCircle } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  city: z.string().min(2, 'City is required'),
  password: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
  terms: z.boolean().refine((v) => v, 'You must accept the terms'),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

function PasswordStrength({ password }: { password: string }) {
  const strength = !password ? 0
    : password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) ? 4
    : password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
    : password.length >= 8 ? 2
    : 1

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', 'bg-destructive', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500']

  if (!password) return null

  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= strength ? colors[strength] : 'bg-muted')} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{labels[strength]}</p>
    </div>
  )
}

export default function Register() {
  const [showPw, setShowPw] = useState(false)
  const navigate = useNavigate()

  const { register, handleSubmit, watch, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      city: '',
      password: '',
      confirmPassword: '',
      terms: false,
    }
  })

  const password = watch('password', '')

  const onSubmit = async (data: FormData) => {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name, city: data.city },
      },
    })
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('An account with this email already exists')
      } else {
        toast.error(error.message)
      }
      return
    }
    toast.success('Account created! Welcome to RentItOut!')
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 hero-gradient flex-col justify-between p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <Link to="/" className="relative flex items-center gap-2">
          <div className="size-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
            <Package className="size-4 text-white" />
          </div>
          <span className="font-display font-bold text-xl text-white">RentItOut</span>
        </Link>

        <div className="relative space-y-5">
          <h2 className="font-display font-bold text-4xl text-white leading-tight">
            Join India's largest peer rental community
          </h2>
          {[
            'List items for free — earn passive income',
            'Access 2,400+ items at a fraction of the cost',
            'Trusted community of verified users',
          ].map((point) => (
            <div key={point} className="flex items-center gap-3">
              <CheckCircle className="size-5 text-[var(--brand)] shrink-0" />
              <span className="text-white/80 text-sm">{point}</span>
            </div>
          ))}
        </div>

        <div className="relative text-white/50 text-xs">
          By joining, you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="mb-8">
            <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="size-7 rounded-md bg-[var(--brand)] flex items-center justify-center">
                <Package className="size-4 text-white" />
              </div>
              <span className="font-display font-bold text-lg">RentItOut</span>
            </Link>
            <h1 className="font-display font-bold text-3xl text-[var(--navy)]">Create account</h1>
            <p className="text-muted-foreground mt-1">Join thousands of people sharing their gear</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name" className="mb-1.5">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="name" placeholder="Rahul Sharma" className="pl-10" {...register('name')} />
              </div>
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="email" className="mb-1.5">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@example.com" className="pl-10" {...register('email')} />
              </div>
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="city" className="mb-1.5">City</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="city" placeholder="Mumbai, Delhi, Bangalore..." className="pl-10" {...register('city')} />
              </div>
              {errors.city && <p className="text-xs text-destructive mt-1">{errors.city.message}</p>}
            </div>

            <div>
              <Label htmlFor="password" className="mb-1.5">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  {...register('password')}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="mb-1.5">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <div className="flex items-start gap-2">
              <Controller
                control={control}
                name="terms"
                render={({ field }) => (
                  <Checkbox
                    id="terms"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                )}
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                I agree to the{' '}
                <a href="#" className="text-[var(--brand)] hover:underline">Terms of Service</a>{' '}
                and{' '}
                <a href="#" className="text-[var(--brand)] hover:underline">Privacy Policy</a>
              </label>
            </div>
            {errors.terms && <p className="text-xs text-destructive">{errors.terms.message}</p>}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white text-base"
            >
              {isSubmitting ? <Spinner /> : 'Create Account'}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--brand)] font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
