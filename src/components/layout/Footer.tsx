import { Link } from 'react-router-dom'
import { Package, Heart, Globe, BookOpen, Share2 } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-[var(--navy)] text-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="size-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
                <Package className="size-4 text-white" />
              </div>
              <span className="font-display font-bold text-lg text-white">RentItOut</span>
            </Link>
            <p className="text-sm text-white/60 leading-relaxed">
              Rent anything from anyone nearby. Save money. Earn money.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="#" className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <Globe className="size-4" />
              </a>
              <a href="#" className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <BookOpen className="size-4" />
              </a>
              <a href="#" className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <Share2 className="size-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-white text-sm mb-3 font-display">Explore</h4>
            <ul className="space-y-2 text-sm">
              {['Browse Items', 'How It Works', 'Categories', 'About Us'].map((item) => (
                <li key={item}>
                  <Link to="/browse" className="hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-3 font-display">Account</h4>
            <ul className="space-y-2 text-sm">
              {['Sign Up', 'Login', 'Dashboard', 'List an Item'].map((item) => (
                <li key={item}>
                  <Link to="/register" className="hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-3 font-display">Support</h4>
            <ul className="space-y-2 text-sm">
              {['Help Center', 'Safety Tips', 'Community Guidelines', 'Contact Us'].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <p>© 2024 RentItOut. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="size-3 fill-[var(--brand)] text-[var(--brand)]" /> for sharing economy
          </p>
        </div>
      </div>
    </footer>
  )
}
