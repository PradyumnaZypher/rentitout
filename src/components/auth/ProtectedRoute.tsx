import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { Spinner } from '@/components/ui/spinner'

// Reads directly from the Zustand store — does NOT call useAuth() —
// so no second Supabase listener is ever spawned. Auth is initialized
// once by AppRoutes (which calls useAuth with the module-level guard).
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

