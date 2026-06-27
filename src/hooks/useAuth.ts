import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store'

// A module-level flag so that only ONE component instance ever runs the
// Supabase session init — all other useAuth() calls simply read the store.
let initialized = false

export function useAuth() {
  const store = useAuthStore()
  const didInit = useRef(false)

  useEffect(() => {
    // If another instance has already started initialization, skip
    if (initialized) return
    initialized = true
    didInit.current = true

    const { setUser, setProfile, setSession, setLoading } = store

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            setProfile(data)
            setLoading(false)
          })
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            setProfile(data)
            setLoading(false)
          })
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      // Only unsubscribe when the initializing component unmounts.
      // Reset the flag so it can re-init if the app fully remounts.
      if (didInit.current) {
        subscription.unsubscribe()
        initialized = false
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    user: store.user,
    profile: store.profile,
    session: store.session,
    loading: store.loading,
    signOut: store.signOut,
    refreshProfile: store.refreshProfile,
  }
}
