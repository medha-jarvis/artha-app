'use client'
import { useState } from 'react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { ASSET_CLASSES } from '@/lib/types'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const HOLDINGS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', qty: 50, avgPrice: 2840, cmp: 3110, asset: 'stocks', xirr: 18.2, change1d: 1.8 },
  { symbol: 'KECL', name: 'KEC International', qty: 200, avgPrice: 680, cmp: 820, asset: 'stocks', xirr: 22.4, change1d: 3.2 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', qty: 30, avgPrice: 3600, cmp: 3540, asset: 'stocks', xirr: -2.1, change1d: -0.9 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', qty: 100, avgPrice: 1680, cmp: 1732, asset: 'stocks', xirr: 4.2, change1d: 0.4 },
  { symbol: 'INFY', name: 'Infosys', qty: 80, avgPrice: 1820, cmp: 1680, asset: 'stocks', xirr: -9.8, change1d: -1.2 },
  { symbol: 'PARAG PARIKH FLEXI CAP', name: 'Parag Parikh Flexi Cap Fund', qty: 3200, avgPrice: 52.4, cmp: 74.8, asset: 'mf', xirr: 19.1, change1d: 0.3 },
  { symbol: 'MIRAE EMERGING BLUECHIP', name: 'Mirae Asset Emerging Bluechip', qty: 1800, avgPrice: 78.2, cmp: 96.4, asset: 'mf', xirr: 14.6, change1d: 0.2 },
]

const PERF_HISTORY = [
  { d: '1M ago', portfolio: 100, nifty: 100 },
  { d: '3W ago', portfolio: 102.1, nifty: 101.4 },
  { d: '2W ago', portfolio: 101.4, nifty: 100.8 },
  { d: '1W ago', portfolio: 104.8, nifty: 102.1 },
  { d: 'Today', portfolio: 106.2, nifty: 103.4 },
]

export default function PortfolioPage() {
  const [filter, setFilter] = useState<string>('all')
  const [sort, setSort] = useState<string>('value')

  const filtered = HOLDINGS.filter(h => filter === 'all' || h.asset === filter)
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'value') return (b.qty * b.cmp) - (a.qty * a.cmp)
    if (sort === 'xirr') return b.xirr - a.xirr
    if (sort === 'change') return b.change1d - a.change1d
    return 0
  })

  const totalValue = HOLDINGS.reduce((s, h) => s + h.qty * h.cmp, 0)
  const totalInvested = HOLDINGS.reduce((s, h) => s + h.qty * h.avgPrice, 0)
  const totalGain = totalValue - totalInvested

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Portfolio</h1>
        <p className="text-slate-400 text-sm mt-0.5">All holdings · Updated today at market close</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 text-white rounded-xl p-4">
          <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Portfolio Value</div>
          <div className="text-2xl font-black">{formatCurrency(totalValue, true)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Invested</div>
          <div className="text-2xl font-black text-slate-900">{formatCurrency(totalInvested, true)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Gain</div>
          <div className={`text-2xl font-black ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatCurrency(totalGain, true)}
          </div>
          <div className="text-xs text-slate-400">{formatPercent((totalGain / totalInvested) * 100)} absolute</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">XIRR</div>
          <div className="text-2xl font-black text-emerald-600">16.4%</div>
          <div className="text-xs text-slate-400">vs Nifty500: 14.1%</div>
        </div>
      </div>

      {/* Normalised chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Performance vs Benchmark (Normalised)</h3>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 inline-block"></span>Portfolio</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-400 inline-block"></span>Nifty500</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={PERF_HISTORY}>
            <defs>
              <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="d" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v.toFixed(0)}`} domain={[98, 110]} />
            <Tooltip formatter={(v) => `${Number(v).toFixed(1)} (base 100)`} />
            <Area type="monotone" dataKey="portfolio" stroke="#4f46e5" strokeWidth={2}
              fill="url(#pGrad)" name="Portfolio" />
            <Area type="monotone" dataKey="nifty" stroke="#94a3b8" strokeWidth={1.5}
              fill="none" name="Nifty500" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Holdings table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Holdings</h3>
          <div className="flex gap-2">
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600">
              <option value="all">All Assets</option>
              {ASSET_CLASSES.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600">
              <option value="value">Sort: Value</option>
              <option value="xirr">Sort: XIRR</option>
              <option value="change">Sort: 1D Change</option>
            </select>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="text-left py-2 font-medium">Holding</th>
              <th className="text-right py-2 font-medium">Qty</th>
              <th className="text-right py-2 font-medium">Avg Price</th>
              <th className="text-right py-2 font-medium">CMP</th>
              <th className="text-right py-2 font-medium">Current Value</th>
              <th className="text-right py-2 font-medium">Gain</th>
              <th className="text-right py-2 font-medium">XIRR</th>
              <th className="text-right py-2 font-medium">1D</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(h => {
              const value = h.qty * h.cmp
              const invested = h.qty * h.avgPrice
              const gain = value - invested
              const gainPct = (gain / invested) * 100
              return (
                <tr key={h.symbol} className="border-b border-slate-50 hover:bg-slate-50 transition">
                  <td className="py-2.5">
                    <div className="font-semibold text-slate-900">{h.symbol}</div>
                    <div className="text-xs text-slate-400">{h.name}</div>
                  </td>
                  <td className="py-2.5 text-right text-slate-600">{h.qty.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 text-right text-slate-600">{formatCurrency(h.avgPrice)}</td>
                  <td className="py-2.5 text-right text-slate-700 font-medium">{formatCurrency(h.cmp)}</td>
                  <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(value, true)}</td>
                  <td className="py-2.5 text-right">
                    <div className={`font-semibold ${gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatCurrency(gain, true)}
                    </div>
                    <div className={`text-xs ${gainPct >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {formatPercent(gainPct)}
                    </div>
                  </td>
                  <td className={`py-2.5 text-right font-bold ${h.xirr >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {h.xirr.toFixed(1)}%
                  </td>
                  <td className={`py-2.5 text-right font-semibold ${h.change1d >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatPercent(h.change1d)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
