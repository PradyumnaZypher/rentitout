import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Verified() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/dashboard')
    }, 4000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <style>{`
        @keyframes scaleIn {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>

      <div className="w-full max-w-md bg-card rounded-2xl border border-border p-8 text-center shadow-lg relative overflow-hidden">
        {/* Decorative gradient blur background */}
        <div className="absolute -top-24 -left-24 size-48 rounded-full bg-green-500/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 size-48 rounded-full bg-[var(--brand)]/5 blur-3xl" />

        <div className="relative flex flex-col items-center">
          {/* Animated checkmark logo */}
          <div className="size-20 rounded-full bg-green-50 flex items-center justify-center mb-6 animate-pulse">
            <CheckCircle className="size-12 text-green-500 stroke-[1.5] animate-scale-in" />
          </div>

          <h1 className="font-display font-bold text-3xl text-[var(--navy)] mb-3">
            Email Verified!
          </h1>
          <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
            Your email has been confirmed successfully. Welcome to the RentItOut community!
          </p>

          <div className="w-full space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand)]"></span>
              </span>
              Redirecting to dashboard in a moment...
            </div>

            <Button 
              onClick={() => navigate('/dashboard')}
              className="w-full bg-[var(--brand)] hover:bg-[oklch(0.52_0.22_20)] text-white gap-2 h-11"
            >
              Go to Dashboard <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
