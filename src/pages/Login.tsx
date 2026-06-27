import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Package, Mail, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function Login() {
  const [showPw, setShowPw] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted', email, password)
    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      })
      console.log('Supabase response:', data, error)
      if (error) {
        let msg = error.message
        if (msg === 'Invalid login credentials') {
          msg = 'Invalid email or password'
        } else if (msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('not confirmed')) {
          msg = 'Your email has not been verified yet. Please check your inbox and verify your email to log in.'
        }
        toast.error(msg)
        return
      }
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (err: any) {
      console.log('Exception:', err)
      toast.error(err?.message || 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 hero-gradient flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <Link to="/" className="relative flex items-center gap-2">
          <div className="size-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
            <Package className="size-4 text-white" />
          </div>
          <span className="font-display font-bold text-xl text-white">RentItOut</span>
        </Link>
        <div className="relative">
          <h2 className="font-display font-bold text-4xl text-white mb-4 leading-tight">Welcome back to the sharing economy</h2>
          <p className="text-white/70 text-lg">Access your listings, manage bookings, and connect with your community.</p>
        </div>
        <div className="relative flex items-center gap-4">
          {['500+ Items', '1,800+ Renters', '50+ Cities'].map((stat) => (
            <div key={stat} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
              <span className="text-white text-sm font-semibold">{stat}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="size-7 rounded-md bg-[var(--brand)] flex items-center justify-center">
                <Package className="size-4 text-white" />
              </div>
              <span className="font-display font-bold text-lg">RentItOut</span>
            </Link>
            <h1 className="font-display font-bold text-3xl text-[var(--navy)]">Sign in</h1>
            <p className="text-muted-foreground mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium">Password</label>
                <Link to="/forgot-password" className="text-xs text-[var(--brand)] hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input id="remember" type="checkbox" className="size-4 rounded border border-input" />
              <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">Remember me</label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-md bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? 'Loading...' : 'Sign In'}
            </button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-[var(--brand)] font-medium hover:underline">Create one free</Link>
          </p>

          <div className="mt-6 p-4 bg-muted rounded-xl">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Demo credentials:</p>
            <p className="text-xs text-muted-foreground font-mono">bolt-test-1782494547377@test.local / 8u0wunb2zsMIZhyFXH7eJcvZ</p>
          </div>
        </div>
      </div>
    </div>
  )
}
