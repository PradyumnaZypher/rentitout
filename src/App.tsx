import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'

import Home from '@/pages/Home'
import Browse from '@/pages/Browse'
import ListingDetail from '@/pages/ListingDetail'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import About from '@/pages/About'
import ListItem from '@/pages/ListItem'
import EditListing from '@/pages/EditListing'
import Messages from '@/pages/Messages'
import Verified from '@/pages/Verified'
import { Spinner } from '@/components/ui/spinner'

import DashboardLayout from '@/pages/Dashboard/index'
import DashboardOverview from '@/pages/Dashboard/Overview'
import MyListings from '@/pages/Dashboard/MyListings'
import MyRentals from '@/pages/Dashboard/MyRentals'
import Requests from '@/pages/Dashboard/Requests'
import Profile from '@/pages/Dashboard/Profile'

function AppRoutes() {
  // useAuth() is called here to initialize the store once for the entire app.
  // ProtectedRoute reads from the same store — no race conditions.
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes with navbar + footer */}
      <Route path="/" element={<><Navbar /><Home /><Footer /></>} />
      <Route path="/browse" element={<><Navbar /><Browse /><Footer /></>} />
      <Route path="/listing/:id" element={<><Navbar /><ListingDetail /><Footer /></>} />
      <Route path="/about" element={<><Navbar /><About /><Footer /></>} />

      {/* Auth routes (no navbar/footer) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verified" element={<Verified />} />

      {/* Protected routes with navbar + footer */}
      <Route
        path="/list-item"
        element={
          <ProtectedRoute>
            <Navbar />
            <ListItem />
            <Footer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/edit-listing/:id"
        element={
          <ProtectedRoute>
            <Navbar />
            <EditListing />
            <Footer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <Navbar />
            <Messages />
            <Footer />
          </ProtectedRoute>
        }
      />

      {/* Dashboard (has its own layout) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardOverview />} />
        <Route path="my-listings" element={<MyListings />} />
        <Route path="my-rentals" element={<MyRentals />} />
        <Route path="requests" element={<Requests />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* 404 */}
      <Route
        path="*"
        element={
          <>
            <Navbar />
            <div className="min-h-screen flex items-center justify-center pt-16">
              <div className="text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h1 className="font-display font-bold text-2xl text-[var(--navy)] mb-2">Page not found</h1>
                <p className="text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
                <a href="/" className="text-[var(--brand)] hover:underline">Go home</a>
              </div>
            </div>
            <Footer />
          </>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <ScrollToTop />
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  )
}

export default App
