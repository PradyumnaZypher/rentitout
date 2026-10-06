import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/spinner'

export function AdminGuard() {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        setIsAdmin(false)
        setChecking(false)
        return
      }
      try {
        const { data, error } = await supabase.rpc('is_current_user_admin')
        if (error) throw error
        setIsAdmin(data)
      } catch (e) {
        console.error('Admin check failed:', e)
        setIsAdmin(false)
      } finally {
        setChecking(false)
      }
    }
    
    if (!authLoading) {
      checkAdmin()
    }
  }, [user, authLoading])

  if (authLoading || checking) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner className="size-8" /></div>
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
