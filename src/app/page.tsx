import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div>
          <span className="text-2xl font-black text-indigo-400">Artha</span>
          <span className="ml-2 text-xs text-white/40 font-medium uppercase tracking-widest">Personal Finance OS</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="px-4 py-2 text-sm text-white/70 hover:text-white transition">Sign In</Link>
          <Link href="/signup" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold rounded-lg transition">
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-8">
          <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
          Zero commissions. Zero conflicts. Always.
        </div>

        <h1 className="text-5xl md:text-7xl font-black leading-tight max-w-4xl mb-6">
          Your financial concierge
          <br />
          <span className="text-indigo-400">for the AI era</span>
        </h1>

        <p className="text-lg md:text-xl text-white/60 max-w-2xl mb-10">
          Track all 9 Indian asset classes. Import from 7 brokers in seconds.
          Know your true XIRR. Plan every goal. Get institutional research.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Link href="/signup" className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 font-bold text-lg rounded-xl transition shadow-lg">
            Start Free — No Card Required
          </Link>
          <Link href="/dashboard" className="px-8 py-4 border border-white/20 hover:border-white/40 font-semibold text-lg rounded-xl transition">
            View Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl w-full">
          {[
            { num: '9', label: 'Asset classes' },
            { num: '7', label: 'Broker imports' },
            { num: '₹0', label: 'Commission ever' },
            { num: '5', label: 'Research report types' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-indigo-400">{s.num}</div>
              <div className="text-sm text-white/50 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20 w-full">
        <h2 className="text-3xl font-bold text-center mb-10">Everything in one place</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '📊', title: 'Complete Wealth View', desc: 'Stocks, MF, EPF, PPF, SSY, NPS, ULIP, PMS, FD — all in one dashboard. Your true net worth, live.' },
            { icon: '⚡', title: '7-Broker Import', desc: 'Upload Zerodha, Groww, Upstox, Angel One, ICICI, HDFC, or Kotak. Auto-detected, duplicates removed.' },
            { icon: '🎯', title: 'Goal Planning', desc: 'Tag investments to goals. See if your retirement corpus is on track. AI tells you exactly what to do.' },
            { icon: '🔬', title: 'Research Concierge', desc: 'Institutional stock research — Forensic, Valuation, Concall Analysis — from ₹499. Permanently yours.' },
            { icon: '📐', title: 'XIRR & TWRR', desc: 'Honest returns with one methodology across every asset class. No cherry-picking. No tricks.' },
            { icon: '🧾', title: 'Tax Cockpit', desc: 'LTCG/STCG with FIFO lot accounting. 80C tracker. Harvest opportunities before March.' },
          ].map(f => (
            <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-white/30 text-sm">
        Artha © 2026 · Conflict-free by design · Not investment advice
      </footer>
    </div>
  )
}
