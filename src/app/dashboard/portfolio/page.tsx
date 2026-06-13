'use client'
import { useState, useEffect, useCallback } from 'react'
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
  tx_count: number
}

interface LivePrice { price: number; change: number; prev_close: number }
interface MfNav { units: number; nav: number; current_value: number }

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
  live_price?: number
  live_change?: number
  is_live?: boolean
  holding_id?: string
  symbol?: string
  tx_count?: number
}

interface EditForm {
  name: string
  current_value: string
  total_invested: string
  account_number: string
}

function assetMeta(code: string) {
  return ASSET_CLASSES.find(a => a.code === code) ?? { icon: '💼', name: code, color: '#94a3b8' }
}

function EditModal({ row, onSave, onClose }: {
  row: DisplayRow
  onSave: (form: EditForm) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<EditForm>({
    name: row.name,
    current_value: String(row.current_value),
    total_invested: String(row.total_invested),
    account_number: row.sub || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const field = (k: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try { await onSave(form) } catch (e) { setError(String(e)); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl md:rounded-2xl p-5 md:p-6 w-full md:max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-lg text-slate-900">Edit Holding</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input value={form.name} onChange={field('name')} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Value (₹)</label>
              <input value={form.current_value} onChange={field('current_value')} type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invested (₹)</label>
              <input value={form.total_invested} onChange={field('total_invested')} type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Account / Reference (optional)</label>
            <input value={form.account_number} onChange={field('account_number')} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 p-2 rounded">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-500 disabled:opacity-60 transition">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteModal({ row, onConfirm, onClose, deleting }: {
  row: DisplayRow
  onConfirm: () => Promise<void>
  onClose: () => void
  deleting: boolean
}) {
  const isStock = row.asset_class === 'stocks'
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl md:rounded-2xl p-5 md:p-6 w-full md:max-w-md shadow-xl">
        <div className="text-2xl mb-3">🗑️</div>
        <h2 className="font-black text-lg text-slate-900 mb-2">Delete {row.name}?</h2>
        <p className="text-sm text-slate-500 mb-4">
          {isStock
            ? `This will permanently delete all ${row.tx_count} transactions for ${row.symbol}. This cannot be undone.`
            : 'This holding will be removed from your portfolio. This cannot be undone.'}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={deleting} className="flex-1 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg hover:bg-red-500 disabled:opacity-60 transition">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PortfolioPage() {
  const [rows, setRows] = useState<DisplayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('value')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [liveCount, setLiveCount] = useState(0)
  const [editRow, setEditRow] = useState<DisplayRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<DisplayRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadPortfolio = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const supabase = createClient()

    const [{ data: holdings }, { data: stockTxs }] = await Promise.all([
      supabase.from('holdings').select('*').eq('is_active', true).order('asset_class'),
      supabase.from('stock_transactions').select('symbol,trade_type,quantity,price,trade_date,brokerage').order('trade_date'),
    ])

    const positions: Record<string, StockPosition> = {}
    for (const tx of (stockTxs || []) as StockTx[]) {
      if (!positions[tx.symbol]) positions[tx.symbol] = { symbol: tx.symbol, qty: 0, avg_price: 0, total_invested: 0, tx_count: 0 }
      const pos = positions[tx.symbol]
      if (tx.trade_type === 'buy') {
        const newCost = pos.total_invested + (tx.quantity * tx.price + (tx.brokerage || 0))
        const newQty = pos.qty + tx.quantity
        pos.avg_price = newQty > 0 ? newCost / newQty : 0
        pos.qty = newQty
        pos.total_invested = newCost
        pos.tx_count++
      } else {
        const sellFrac = pos.qty > 0 ? tx.quantity / pos.qty : 0
        pos.total_invested = pos.total_invested * (1 - sellFrac)
        pos.qty = Math.max(0, pos.qty - tx.quantity)
        pos.tx_count++
      }
    }
    const activePositions = Object.values(positions).filter(p => p.qty > 0)

    let livePrices: Record<string, LivePrice> = {}
    if (activePositions.length > 0) {
      try {
        const res = await fetch('/api/live-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: activePositions.map(p => p.symbol) }),
        })
        if (res.ok) livePrices = await res.json()
      } catch { /* fall back to cost basis */ }
    }

    let mfNavs: Record<string, MfNav> = {}
    const mfHoldings = (holdings || []).filter(h => h.asset_class === 'mf')
    if (mfHoldings.length > 0) {
      try {
        const res = await fetch('/api/mf-nav', { method: 'POST' })
        if (res.ok) mfNavs = await res.json()
      } catch { /* use stored value */ }
    }

    const displayRows: DisplayRow[] = []
    let liveTotal = 0

    for (const pos of activePositions) {
      const lp = livePrices[pos.symbol]
      const isLive = !!lp?.price
      const cv = isLive ? pos.qty * lp.price : pos.qty * pos.avg_price
      if (isLive) liveTotal++
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
        live_price: lp?.price,
        live_change: lp?.change,
        is_live: isLive,
        symbol: pos.symbol,
        tx_count: pos.tx_count,
      })
    }

    for (const h of (holdings || []) as Holding[]) {
      const meta = assetMeta(h.asset_class)
      const mfLive = h.asset_class === 'mf' ? mfNavs[h.id] : undefined
      const cv = mfLive ? mfLive.current_value : (h.current_value || 0)
      const invested = h.total_invested || 0
      const isLive = h.asset_class === 'mf' && !!mfLive
      if (isLive) liveTotal++
      displayRows.push({
        key: `holding-${h.id}`,
        name: h.name,
        sub: h.account_number || undefined,
        asset_class: h.asset_class,
        asset_icon: meta.icon,
        current_value: cv,
        total_invested: invested,
        gain: cv - invested,
        gain_pct: invested > 0 ? ((cv - invested) / invested) * 100 : 0,
        units: mfLive ? mfLive.units : (h.units || undefined),
        live_price: mfLive?.nav,
        is_live: isLive,
        holding_id: h.id,
      })
    }

    setRows(displayRows)
    setLiveCount(liveTotal)
    setLastUpdated(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { loadPortfolio() }, [loadPortfolio])

  const handleEdit = async (form: EditForm) => {
    if (!editRow?.holding_id) return
    const supabase = createClient()
    const { error } = await supabase.from('holdings').update({
      name: form.name.trim(),
      current_value: Number(form.current_value),
      total_invested: Number(form.total_invested),
      account_number: form.account_number || null,
    }).eq('id', editRow.holding_id)
    if (error) throw new Error(error.message)
    setEditRow(null)
    await loadPortfolio(true)
  }

  const handleDelete = async () => {
    if (!deleteRow) return
    setDeleting(true)
    const supabase = createClient()
    if (deleteRow.asset_class === 'stocks' && deleteRow.symbol) {
      await supabase.from('stock_transactions').delete().eq('symbol', deleteRow.symbol)
    } else if (deleteRow.holding_id) {
      await supabase.from('holdings').update({ is_active: false }).eq('id', deleteRow.holding_id)
    }
    setDeleteRow(null)
    setDeleting(false)
    await loadPortfolio(true)
  }

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
  const hasStocks = rows.some(r => r.asset_class === 'stocks')

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
        <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">Import broker statements, CAMS PDF, or add FD/NPS/EPF manually.</p>
        <Link href="/dashboard/import" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition inline-block">
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
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-slate-400 hidden sm:block">
              {liveCount > 0 && <span className="text-emerald-600 font-medium">● Live </span>}
              {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={() => loadPortfolio(true)} disabled={refreshing}
            className="p-2 border border-slate-200 text-slate-500 text-sm rounded-lg hover:bg-slate-50 transition disabled:opacity-50" title="Refresh">
            {refreshing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
          <Link href="/dashboard/import" className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition hidden sm:block">
            + Add more
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        <div className="col-span-2 lg:col-span-1 bg-slate-900 text-white rounded-xl p-4">
          <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Portfolio Value</div>
          <div className="text-2xl font-black">{formatCurrency(totalValue)}</div>
          {liveCount > 0 && <div className="text-xs text-emerald-400 mt-1">● {liveCount} live prices</div>}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Invested</div>
          <div className="text-xl font-black text-slate-900">{formatCurrency(totalInvested)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Gain / Loss</div>
          <div className={`text-xl font-black ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(totalGain, true)}</div>
          <div className={`text-xs mt-0.5 font-medium ${totalGain >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{formatPercent(gainPct)} absolute</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Positions</div>
          <div className="text-xl font-black text-slate-900">{rows.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">{presentAssetClasses.length} asset classes</div>
        </div>
      </div>

      {hasStocks && !rows.filter(r => r.asset_class === 'stocks').every(r => r.is_live) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800 mb-4">
          ⚠ Some stock prices unavailable — showing cost basis. Markets may be closed or symbols not found on NSE.
        </div>
      )}

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

        {/* Mobile cards */}
        <div className="block md:hidden space-y-3">
          {sorted.map(row => (
            <div key={row.key} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{row.asset_icon}</span>
                    <span className="font-semibold text-slate-900 text-sm truncate">{row.name}</span>
                    {row.is_live && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded flex-shrink-0">LIVE</span>}
                  </div>
                  {row.sub && <div className="text-xs text-slate-400 mt-0.5 ml-5 truncate">{row.sub}</div>}
                </div>
                <div className="text-right ml-2">
                  <div className="font-bold text-slate-900 text-sm">{formatCurrency(row.current_value, true)}</div>
                  <div className={`text-xs font-medium ${row.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {row.gain >= 0 ? '+' : ''}{formatCurrency(row.gain, true)} ({formatPercent(row.gain_pct)})
                  </div>
                </div>
              </div>
              {row.live_change !== undefined && row.asset_class === 'stocks' && (
                <div className={`text-xs font-medium ${row.live_change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  Today: {row.live_change >= 0 ? '+' : ''}{row.live_change.toFixed(2)}%
                  {row.live_price && ` · ₹${row.live_price.toFixed(2)}`}
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400">Invested: {formatCurrency(row.total_invested, true)}</span>
                <div className="flex gap-2">
                  {row.holding_id && (
                    <button onClick={() => setEditRow(row)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition">Edit</button>
                  )}
                  <button onClick={() => setDeleteRow(row)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
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
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.key} className="border-b border-slate-50 hover:bg-slate-50 transition group">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span>{row.asset_icon}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">{row.name}</span>
                          {row.is_live && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded leading-4">LIVE</span>}
                        </div>
                        {row.sub && <div className="text-xs text-slate-400">{row.sub}</div>}
                        {row.live_change !== undefined && row.asset_class === 'stocks' && (
                          <div className={`text-xs font-medium ${row.live_change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {row.live_change >= 0 ? '▲' : '▼'} {Math.abs(row.live_change).toFixed(2)}% today · ₹{row.live_price?.toFixed(2)}
                          </div>
                        )}
                        {row.live_price !== undefined && row.asset_class === 'mf' && (
                          <div className="text-xs text-slate-400">NAV ₹{row.live_price.toFixed(4)} · {row.units?.toFixed(3)} units</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{assetMeta(row.asset_class).name}</span>
                  </td>
                  <td className="py-2.5 text-right text-slate-600">{formatCurrency(row.total_invested, true)}</td>
                  <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(row.current_value, true)}</td>
                  <td className="py-2.5 text-right">
                    <div className={`font-semibold ${row.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {row.gain >= 0 ? '+' : ''}{formatCurrency(row.gain, true)}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className={`font-bold text-sm ${row.gain_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatPercent(row.gain_pct)}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                      {row.holding_id && (
                        <button onClick={() => setEditRow(row)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      <button onClick={() => setDeleteRow(row)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editRow && <EditModal row={editRow} onSave={handleEdit} onClose={() => setEditRow(null)} />}
      {deleteRow && <DeleteModal row={deleteRow} onConfirm={handleDelete} onClose={() => setDeleteRow(null)} deleting={deleting} />}
    </div>
  )
}
