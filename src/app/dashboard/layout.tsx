import Link from 'next/link'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/dashboard/portfolio', label: 'Portfolio', icon: '📊' },
  { href: '/dashboard/import', label: 'Import', icon: '⬆️' },
  { href: '/dashboard/goals', label: 'Goals', icon: '🎯' },
  { href: '/dashboard/tax', label: 'Tax', icon: '🧾' },
  { href: '/dashboard/research', label: 'Research', icon: '🔬' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white fixed h-full flex flex-col z-10">
        <div className="px-6 py-5 border-b border-white/10">
          <span className="text-xl font-black text-indigo-400">Artha</span>
          <div className="text-xs text-white/30 mt-0.5">Personal Finance OS</div>
        </div>
        <nav className="flex-1 py-4">
          {NAV.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-6 py-2.5 text-sm text-white/65 hover:text-white hover:bg-white/5 transition border-l-2 border-transparent hover:border-indigo-400">
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-white/10">
          <Link href="/logout" className="text-xs text-white/30 hover:text-white/60 transition">Sign out</Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 flex-1 p-8 max-w-[calc(100vw-256px)]">
        {children}
      </main>
    </div>
  )
}
