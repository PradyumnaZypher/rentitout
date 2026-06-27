import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Package, ArrowLeft, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
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

        {sent ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="size-8 text-green-600" />
            </div>
            <h2 className="font-display font-bold text-xl text-[var(--navy)] mb-2">Check your email</h2>
            <p className="text-muted-foreground text-sm mb-6">
              We've sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link.
            </p>
            <Link to="/login" className="text-[var(--brand)] text-sm hover:underline flex items-center justify-center gap-1">
              <ArrowLeft className="size-3" /> Back to login
            </Link>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-8">
            <h1 className="font-display font-bold text-2xl text-[var(--navy)] mb-2">Forgot password?</h1>
            <p className="text-muted-foreground text-sm mb-6">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="mb-1.5">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-[var(--brand)] text-white h-11">
                {loading ? <Spinner /> : 'Send Reset Link'}
              </Button>
            </form>

            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mt-6">
              <ArrowLeft className="size-3" /> Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
