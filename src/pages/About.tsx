import { Link } from 'react-router-dom'
import { Package, Users, Target, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function About() {
  return (
    <div className="min-h-screen bg-background pt-16">
      {/* Hero */}
      <div className="hero-gradient py-20 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="size-10 rounded-xl bg-[var(--brand)] flex items-center justify-center">
              <Package className="size-5 text-white" />
            </div>
            <span className="font-display font-bold text-2xl">RentItOut</span>
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl mb-4">
            Connecting people through shared experiences
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            We believe in a world where things are shared, not just owned. Where idle items find temporary homes,
            and where communities grow stronger through trust and generosity.
          </p>
        </div>
      </div>

      {/* Mission */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { icon: Target, title: 'Our Mission', desc: 'Make every physical asset accessible to everyone. Why buy when you can borrow?' },
            { icon: Users, title: 'Our Community', desc: 'A growing network of 1,800+ verified users across 50+ cities in India.' },
            { icon: Heart, title: 'Our Values', desc: 'Trust, sustainability, and community. We believe in sharing over hoarding.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center">
              <div className="size-12 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center mb-4">
                <Icon className="size-6 text-[var(--brand)]" />
              </div>
              <h3 className="font-display font-semibold text-lg text-[var(--navy)] mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-background text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="font-display font-bold text-3xl text-[var(--navy)] mb-4">Ready to join the sharing revolution?</h2>
          <p className="text-muted-foreground mb-8">Start renting or listing today — it's completely free.</p>
          <div className="flex gap-4 justify-center">
            <Button asChild className="bg-[var(--brand)] text-white">
              <Link to="/register">Create Account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/browse">Browse Items</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
