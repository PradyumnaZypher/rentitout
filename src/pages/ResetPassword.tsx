import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Package, Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if we have a valid hash in the URL or an active recovery session
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        // If there is no session, we might be here before Supabase has processed the URL fragment.
        // Wait a bit, and if still no session and no access token in URL, redirect.
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        if (!hashParams.has('access_token')) {
            // Let the auth listener handle it if we just landed
            setTimeout(async () => {
                const { data: { session: delayedSession } } = await supabase.auth.getSession()
                if (!delayedSession) {
                    toast.error('Invalid or expired password reset link.')
                    navigate('/login')
                }
            }, 1000)
        }
      }
    }
    checkSession()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      toast.error(error.message)
    } else {
      setSuccess(true)
      toast.success('Password updated successfully.')
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-10">
          <div className="size-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
            <Package className="size-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg">RentItOut</span>
        </Link>

        {success ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="size-8 text-green-600" />
            </div>
            <h2 className="font-display font-bold text-xl text-[var(--navy)] mb-2">Password Reset!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Your password has been successfully updated.
            </p>
            <Link to="/login" className="text-[var(--brand)] text-sm hover:underline flex items-center justify-center gap-1">
              <ArrowLeft className="size-3" /> Go to login
            </Link>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-8">
            <h1 className="font-display font-bold text-2xl text-[var(--navy)] mb-2">Reset Password</h1>
            <p className="text-muted-foreground text-sm mb-6">Enter your new password below.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password" className="mb-1.5">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="mb-1.5">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-[var(--brand)] text-white h-11">
                {loading ? <Spinner /> : 'Update Password'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
