'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/portfolio', label: 'Portfolio', icon: '📊' },
  { href: '/dashboard/import', label: 'Import', icon: '⬆️' },
  { href: '/dashboard/goals', label: 'Goals', icon: '🎯' },
  { href: '/dashboard/tax', label: 'Tax', icon: '🧾' },
  { href: '/dashboard/research', label: 'Research', icon: '🔬' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

const BOTTOM_NAV = NAV.slice(0, 5)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'w-64 bg-slate-900 text-white fixed h-full flex flex-col z-50 transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="text-xl font-black text-indigo-400">Artha</span>
            <div className="text-xs text-white/30 mt-0.5">Personal Finance OS</div>
          </div>
          <button
            className="md:hidden p-1 text-white/50 hover:text-white rounded"
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={[
                  'flex items-center gap-3 px-6 py-2.5 text-sm transition border-l-2',
                  active
                    ? 'text-white bg-white/10 border-indigo-400 font-semibold'
                    : 'text-white/65 hover:text-white hover:bg-white/5 border-transparent hover:border-indigo-400',
                ].join(' ')}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-6 py-4 border-t border-white/10">
          <Link href="/logout" className="text-xs text-white/30 hover:text-white/60 transition">
            Sign out
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:ml-64 flex-1 min-w-0 px-4 pt-0 pb-24 md:p-8 md:pb-8">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between py-3 mb-2 md:hidden sticky top-0 bg-slate-50 z-10 -mx-4 px-4 border-b border-slate-100">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 rounded-lg hover:bg-slate-200 transition"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-lg font-black text-indigo-600">Artha</span>
          <div className="w-10" />
        </div>
        {children}
      </main>

      {/* Bottom navigation — mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30">
        <div className="flex">
          {BOTTOM_NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition',
                  active ? 'text-indigo-600' : 'text-slate-400 active:text-slate-700',
                ].join(' ')}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
