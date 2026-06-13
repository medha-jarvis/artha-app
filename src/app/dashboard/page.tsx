'use client'
import { useState, useEffect } from 'react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { ASSET_CLASSES } from '@/lib/types'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'

interface DashData {
  netWorth: number
  totalInvested: number
  allocation: { name: string; value: number; color: string }[]
  hasData: boolean
  userName: string
}

interface Snapshot {
  snapshot_date: string
  net_worth: number
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({ label, value, sub, color = 'default' }: {
  label: string; value: string; sub?: string; color?: 'green' | 'red' | 'default'
}) {
  const subColor = color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-red-500' : 'text-slate-400'
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
      <div className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-black text-slate-900 break-all">{value}</div>
      {sub && <div className={`text-sm mt-0.5 font-medium ${subColor}`}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'

      const [{ data: holdings }, { data: stockTxs }, { data: snaps }] = await Promise.all([
        supabase.from('holdings').select('asset_class, current_value, total_invested').eq('is_active', true),
        supabase.from('stock_transactions').select('symbol,trade_type,quantity,price,brokerage').order('trade_date'),
        supabase.from('net_worth_snapshots')
          .select('snapshot_date,net_worth')
          .order('snapshot_date')
          .limit(90)
          .then(r => r),
      ])

      if (snaps && !snaps.error) setSnapshots(snaps as unknown as Snapshot[])

      if (!holdings || holdings.length === 0) {
        // Check if there are stock transactions (stocks don't create holdings records)
        if (!stockTxs || stockTxs.length === 0) {
          setData({ netWorth: 0, totalInvested: 0, allocation: [], hasData: false, userName })
          setLoading(false)
          return
        }
      }

      // Compute stock positions
      const positions: Record<string, { qty: number; avg_price: number; total_invested: number }> = {}
      for (const tx of (stockTxs || [])) {
        if (!positions[tx.symbol]) positions[tx.symbol] = { qty: 0, avg_price: 0, total_invested: 0 }
        const pos = positions[tx.symbol]
        if (tx.trade_type === 'buy') {
          const newCost = pos.total_invested + (tx.quantity * tx.price + (tx.brokerage || 0))
          const newQty = pos.qty + tx.quantity
          pos.avg_price = newQty > 0 ? newCost / newQty : 0
          pos.qty = newQty
          pos.total_invested = newCost
        } else {
          const frac = pos.qty > 0 ? tx.quantity / pos.qty : 0
          pos.total_invested = pos.total_invested * (1 - frac)
          pos.qty = Math.max(0, pos.qty - tx.quantity)
        }
      }
      const activePositions = Object.entries(positions).filter(([, p]) => p.qty > 0)

      // Fetch live prices for stocks
      let livePrices: Record<string, { price: number }> = {}
      if (activePositions.length > 0) {
        try {
          const res = await fetch('/api/live-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: activePositions.map(([sym]) => sym) }),
          })
          if (res.ok) livePrices = await res.json()
        } catch { /* fallback to cost basis */ }
      }

      // Stock totals
      let stockValue = 0
      let stockInvested = 0
      for (const [sym, pos] of activePositions) {
        const lp = livePrices[sym]
        stockValue += lp?.price ? pos.qty * lp.price : pos.qty * pos.avg_price
        stockInvested += pos.total_invested
      }

      // Holdings totals
      const holdingsValue = (holdings || []).reduce((s, h) => s + (h.current_value || 0), 0)
      const holdingsInvested = (holdings || []).reduce((s, h) => s + (h.total_invested || 0), 0)

      const netWorth = holdingsValue + stockValue
      const totalInvested = holdingsInvested + stockInvested

      // Allocation by asset class
      const byClass: Record<string, number> = {}
      ;(holdings || []).forEach(h => {
        byClass[h.asset_class] = (byClass[h.asset_class] || 0) + (h.current_value || 0)
      })
      if (stockValue > 0) byClass['stocks'] = (byClass['stocks'] || 0) + stockValue

      const allocation = ASSET_CLASSES
        .filter(ac => (byClass[ac.code] || 0) > 0)
        .map(ac => ({ name: ac.name, value: byClass[ac.code] || 0, color: ac.color }))

      const hasData = netWorth > 0 || totalInvested > 0
      setData({ netWorth, totalInvested, allocation, hasData, userName })
      setLoading(false)

      // Auto-save daily snapshot (fire and forget)
      if (hasData) {
        fetch('/api/net-worth-snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            net_worth: netWorth,
            invested: totalInvested,
            breakdown: byClass,
          }),
        }).catch(() => {})
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
  )

  const d = data!
  const gain = d.netWorth - d.totalInvested
  const gainPct = d.totalInvested > 0 ? (gain / d.totalInvested) * 100 : 0

  // Format snapshots for chart
  const chartData = snapshots.map(s => ({
    date: new Date(s.snapshot_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    value: Math.round(s.net_worth),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900">
            {greeting()}, {d.userName} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/dashboard/import"
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition">
          ⬆️ Import
        </Link>
      </div>

      {!d.hasData ? (
        <div>
          <div className="bg-slate-900 text-white rounded-xl p-5 md:p-6 mb-6">
            <div className="text-xs text-white/40 uppercase tracking-wide font-medium mb-1">Total Net Worth</div>
            <div className="text-3xl md:text-4xl font-black">₹0</div>
            <div className="text-sm mt-1 text-white/50">Add your investments to see your net worth</div>
          </div>
          <h2 className="font-bold text-slate-800 mb-4">Get started — add your investments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { href: '/dashboard/import', icon: '📈', title: 'Import broker statement', desc: 'Zerodha, Groww, Upstox, Angel, ICICI, HDFC, Kotak' },
              { href: '/dashboard/import', icon: '🏦', title: 'Import mutual funds (CAS)', desc: 'CAMS or KFintech statement — password-protected PDF supported' },
              { href: '/dashboard/import', icon: '💰', title: 'Add fixed deposits', desc: 'Manually enter FD details — bank, amount, maturity date, rate' },
              { href: '/dashboard/import', icon: '🏢', title: 'Add EPF / PF balance', desc: 'Enter your UAN and current EPF corpus' },
              { href: '/dashboard/import', icon: '🎯', title: 'Add NPS balance', desc: 'Tier 1 and Tier 2 NPS accounts' },
              { href: '/dashboard/import', icon: '🏛️', title: 'Add PPF / SSY', desc: 'Public Provident Fund and Sukanya Samriddhi Yojana' },
            ].map(a => (
              <Link key={a.icon} href={a.href}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition group">
                <div className="text-2xl mb-2">{a.icon}</div>
                <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition">{a.title}</div>
                <div className="text-xs text-slate-400 mt-1 leading-relaxed">{a.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
            <div className="col-span-2 lg:col-span-1 bg-slate-900 text-white rounded-xl p-4 md:p-5">
              <div className="text-xs text-white/40 uppercase tracking-wide font-medium mb-1">Total Net Worth</div>
              <div className="text-2xl md:text-3xl font-black">{formatCurrency(d.netWorth)}</div>
            </div>
            <StatCard label="Total Invested" value={formatCurrency(d.totalInvested)} />
            <StatCard label="Total Gain" value={formatCurrency(gain, true)} sub={formatPercent(gainPct) + ' absolute'} color={gain >= 0 ? 'green' : 'red'} />
            <StatCard label="Asset Classes" value={String(d.allocation.length)} sub="tracked" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-1 bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 mb-4">Allocation</h3>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={d.allocation} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={2}>
                    {d.allocation.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v), true)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {d.allocation.map(a => (
                  <div key={a.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.color }} />
                      <span className="text-slate-600">{a.name}</span>
                    </div>
                    <span className="font-semibold text-slate-700">{formatCurrency(a.value, true)}</span>
                  </div>
                ))}
              </div>
            </div>

            {chartData.length >= 2 ? (
              <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-900 mb-4">Net Worth Over Time</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                      interval={Math.floor(chartData.length / 5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                      tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} width={45} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} labelStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { href: '/dashboard/import', label: 'Import broker statement', icon: '⬆️' },
                    { href: '/dashboard/import', label: 'Add FD / NPS / EPF', icon: '🏢' },
                    { href: '/dashboard/goals', label: 'Set up a financial goal', icon: '🎯' },
                    { href: '/dashboard/tax', label: 'Check LTCG exposure', icon: '🧾' },
                    { href: '/dashboard/portfolio', label: 'View full portfolio', icon: '📊' },
                    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
                  ].map(a => (
                    <Link key={a.href + a.label} href={a.href}
                      className="flex items-center gap-2 text-sm text-slate-700 hover:text-indigo-600 py-2 px-3 hover:bg-indigo-50 rounded-lg transition">
                      <span>{a.icon}</span>{a.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
