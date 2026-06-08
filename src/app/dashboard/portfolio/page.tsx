'use client'
import { useState, useEffect } from 'react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { ASSET_CLASSES } from '@/lib/types'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Holding {
  id: string
  asset_class: string
  name: string
  current_value: number
  total_invested: number
  account_number?: string
  metadata?: Record<string, unknown>
  units?: number
  current_nav?: number
}

interface StockTx {
  symbol: string
  trade_type: 'buy' | 'sell'
  quantity: number
  price: number
  trade_date: string
  brokerage: number
}

interface StockPosition {
  symbol: string
  qty: number
  avg_price: number
  total_invested: number
}

interface DisplayRow {
  key: string
  name: string
  sub?: string
  asset_class: string
  asset_icon: string
  current_value: number
  total_invested: number
  gain: number
  gain_pct: number
  qty?: number
  avg_price?: number
  units?: number
}

function assetMeta(code: string) {
  return ASSET_CLASSES.find(a => a.code === code) ?? { icon: '💼', name: code, color: '#94a3b8' }
}

export default function PortfolioPage() {
  const [rows, setRows] = useState<DisplayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('value')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [{ data: holdings }, { data: stockTxs }] = await Promise.all([
        supabase.from('holdings').select('*').eq('is_active', true).order('asset_class'),
        supabase.from('stock_transactions').select('symbol,trade_type,quantity,price,trade_date,brokerage').order('trade_date'),
      ])

      const displayRows: DisplayRow[] = []

      // ── Stock positions (computed from transactions) ──
      const positions: Record<string, StockPosition> = {}
      for (const tx of (stockTxs || []) as StockTx[]) {
        if (!positions[tx.symbol]) {
          positions[tx.symbol] = { symbol: tx.symbol, qty: 0, avg_price: 0, total_invested: 0 }
        }
        const pos = positions[tx.symbol]
        if (tx.trade_type === 'buy') {
          const newCost = pos.total_invested + (tx.quantity * tx.price + (tx.brokerage || 0))
          const newQty = pos.qty + tx.quantity
          pos.avg_price = newQty > 0 ? newCost / newQty : 0
          pos.qty = newQty
          pos.total_invested = newCost
        } else {
          const sellFrac = pos.qty > 0 ? tx.quantity / pos.qty : 0
          pos.total_invested = pos.total_invested * (1 - sellFrac)
          pos.qty = Math.max(0, pos.qty - tx.quantity)
        }
      }
      for (const pos of Object.values(positions)) {
        if (pos.qty <= 0) continue
        const cv = pos.qty * pos.avg_price
        displayRows.push({
          key: `stock-${pos.symbol}`,
          name: pos.symbol,
          sub: `${pos.qty.toLocaleString('en-IN')} shares @ avg ₹${pos.avg_price.toFixed(2)}`,
          asset_class: 'stocks',
          asset_icon: '📈',
          current_value: cv,
          total_invested: pos.total_invested,
          gain: cv - pos.total_invested,
          gain_pct: pos.total_invested > 0 ? ((cv - pos.total_invested) / pos.total_invested) * 100 : 0,
          qty: pos.qty,
          avg_price: pos.avg_price,
        })
      }

      // ── Holdings (MF, FD, NPS, EPF, PPF, Bank) ──
      for (const h of (holdings || []) as Holding[]) {
        const meta = assetMeta(h.asset_class)
        const gain = (h.current_value || 0) - (h.total_invested || 0)
        displayRows.push({
          key: `holding-${h.id}`,
          name: h.name,
          sub: h.account_number || undefined,
          asset_class: h.asset_class,
          asset_icon: meta.icon,
          current_value: h.current_value || 0,
          total_invested: h.total_invested || 0,
          gain,
          gain_pct: (h.total_invested || 0) > 0 ? (gain / h.total_invested) * 100 : 0,
          units: h.units || undefined,
        })
      }

      setRows(displayRows)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = rows.filter(r => filter === 'all' || r.asset_class === filter)
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'value') return b.current_value - a.current_value
    if (sort === 'gain') return b.gain - a.gain
    if (sort === 'name') return a.name.localeCompare(b.name)
    return 0
  })

  const totalValue = rows.reduce((s, r) => s + r.current_value, 0)
  const totalInvested = rows.reduce((s, r) => s + r.total_invested, 0)
  const totalGain = totalValue - totalInvested
  const gainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0

  const presentAssetClasses = [...new Set(rows.map(r => r.asset_class))]

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading portfolio…</div>
  )

  if (rows.length === 0) return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-slate-900">Portfolio</h1>
        <p className="text-slate-400 text-sm mt-0.5">All your holdings in one place</p>
      </div>
      <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">No holdings yet</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
          Import broker statements, CAMS PDF, or add FD/NPS/EPF manually.
        </p>
        <Link href="/dashboard/import"
          className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition inline-block">
          Add investments →
        </Link>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900">Portfolio</h1>
          <p className="text-slate-400 text-sm mt-0.5">{rows.length} positions · {presentAssetClasses.length} asset classes</p>
        </div>
        <Link href="/dashboard/import"
          className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition hidden sm:block">
          + Add more
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        <div className="col-span-2 lg:col-span-1 bg-slate-900 text-white rounded-xl p-4">
          <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Portfolio Value</div>
          <div className="text-2xl font-black">{formatCurrency(totalValue)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Invested</div>
          <div className="text-xl font-black text-slate-900">{formatCurrency(totalInvested)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Gain / Loss</div>
          <div className={`text-xl font-black ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatCurrency(totalGain, true)}
          </div>
          <div className={`text-xs mt-0.5 font-medium ${totalGain >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {formatPercent(gainPct)} absolute
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Positions</div>
          <div className="text-xl font-black text-slate-900">{rows.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">{presentAssetClasses.length} asset classes</div>
        </div>
      </div>

      {/* Note for stock positions */}
      {rows.some(r => r.asset_class === 'stocks') && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800 mb-4">
          ⚠ Stock values shown at average cost basis — live market prices not yet connected.
          <Link href="/dashboard/import" className="ml-1 underline font-semibold">Connect Zerodha API →</Link>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <button onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${filter === 'all' ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
              All ({rows.length})
            </button>
            {presentAssetClasses.map(ac => {
              const meta = assetMeta(ac)
              const count = rows.filter(r => r.asset_class === ac).length
              return (
                <button key={ac} onClick={() => setFilter(ac)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${filter === ac ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                  {meta.icon} {meta.name} ({count})
                </button>
              )
            })}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 flex-shrink-0">
            <option value="value">Sort: Value</option>
            <option value="gain">Sort: Gain</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>

        {/* Mobile card view */}
        <div className="block md:hidden space-y-3">
          {sorted.map(row => (
            <div key={row.key} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{row.asset_icon}</span>
                    <span className="font-semibold text-slate-900 text-sm">{row.name}</span>
                  </div>
                  {row.sub && <div className="text-xs text-slate-400 mt-0.5 ml-5">{row.sub}</div>}
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 text-sm">{formatCurrency(row.current_value, true)}</div>
                  <div className={`text-xs font-medium ${row.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {row.gain >= 0 ? '+' : ''}{formatCurrency(row.gain, true)} ({formatPercent(row.gain_pct)})
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Invested: {formatCurrency(row.total_invested, true)}</span>
                <span className={`font-medium text-xs ${row.gain >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {formatPercent(row.gain_pct)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-100">
                <th className="text-left py-2 font-medium">Holding</th>
                <th className="text-left py-2 font-medium">Type</th>
                <th className="text-right py-2 font-medium">Invested</th>
                <th className="text-right py-2 font-medium">Current Value</th>
                <th className="text-right py-2 font-medium">Gain / Loss</th>
                <th className="text-right py-2 font-medium">Return</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.key} className="border-b border-slate-50 hover:bg-slate-50 transition">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span>{row.asset_icon}</span>
                      <div>
                        <div className="font-semibold text-slate-900">{row.name}</div>
                        {row.sub && <div className="text-xs text-slate-400">{row.sub}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {assetMeta(row.asset_class).name}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-slate-600">{formatCurrency(row.total_invested, true)}</td>
                  <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(row.current_value, true)}</td>
                  <td className="py-2.5 text-right">
                    <div className={`font-semibold ${row.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {row.gain >= 0 ? '+' : ''}{formatCurrency(row.gain, true)}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className={`font-bold text-sm ${row.gain_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatPercent(row.gain_pct)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
