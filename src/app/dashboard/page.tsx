'use client'
import { useState } from 'react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { ASSET_CLASSES } from '@/lib/types'
import Link from 'next/link'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'

// Demo data — replace with real Supabase queries
const DEMO = {
  netWorth: 8432750,
  totalInvested: 6200000,
  dayGain: 42300,
  dayGainPct: 0.51,
  xirr: 16.4,
  allocation: [
    { name: 'Stocks', value: 3200000, color: '#4f46e5' },
    { name: 'Mutual Funds', value: 2100000, color: '#059669' },
    { name: 'EPF', value: 1400000, color: '#0891b2' },
    { name: 'PPF', value: 680000, color: '#7c3aed' },
    { name: 'FD', value: 800000, color: '#b45309' },
    { name: 'NPS', value: 252750, color: '#d97706' },
  ],
  movers: [
    { symbol: 'RELIANCE', change: 1.8, value: 284000 },
    { symbol: 'KECL', change: 3.2, value: 156000 },
    { symbol: 'TCS', change: -0.9, value: 412000 },
    { symbol: 'HDFCBANK', change: 0.4, value: 198000 },
    { symbol: 'INFY', change: -1.2, value: 231000 },
  ],
  sparkline: [
    { d: 'Jan', v: 6400000 }, { d: 'Feb', v: 6700000 }, { d: 'Mar', v: 6500000 },
    { d: 'Apr', v: 7100000 }, { d: 'May', v: 7600000 }, { d: 'Jun', v: 8432750 },
  ],
}

function StatCard({ label, value, sub, color = 'default' }: {
  label: string; value: string; sub?: string; color?: 'green' | 'red' | 'default'
}) {
  const subColor = color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-red-500' : 'text-slate-400'
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">{label}</div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      {sub && <div className={`text-sm mt-0.5 font-medium ${subColor}`}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const gain = DEMO.netWorth - DEMO.totalInvested
  const gainPct = (gain / DEMO.totalInvested) * 100

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Good morning, Vishal 👋</h1>
          <p className="text-slate-400 text-sm mt-0.5">Saturday, 7 June 2026 · Markets closed</p>
        </div>
        <Link href="/dashboard/import"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition">
          ⬆️ Import Statement
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="col-span-1 bg-slate-900 text-white rounded-xl p-5">
          <div className="text-xs text-white/40 uppercase tracking-wide font-medium mb-1">Total Net Worth</div>
          <div className="text-3xl font-black">{formatCurrency(DEMO.netWorth)}</div>
          <div className="text-sm mt-1 text-emerald-400 font-medium">
            {formatPercent(DEMO.dayGainPct)} today ({formatCurrency(DEMO.dayGain, true)})
          </div>
        </div>
        <StatCard label="Total Invested" value={formatCurrency(DEMO.totalInvested)} />
        <StatCard label="Total Gain" value={formatCurrency(gain, true)}
          sub={formatPercent(gainPct) + ' absolute'} color="green" />
        <StatCard label="Portfolio XIRR" value={`${DEMO.xirr}%`}
          sub="vs Nifty500: 14.1%" color="green" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Sparkline */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Net Worth — 6 Months</h3>
            <span className="text-xs text-slate-400">Demo data</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={DEMO.sparkline}>
              <defs>
                <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="d" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1e5).toFixed(0)}L`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Area type="monotone" dataKey="v" stroke="#4f46e5" strokeWidth={2}
                fill="url(#wGrad)" name="Net Worth" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation donut */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 mb-4">Allocation</h3>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={DEMO.allocation} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                dataKey="value" paddingAngle={2}>
                {DEMO.allocation.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(Number(v), true)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {DEMO.allocation.map(a => (
              <div key={a.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: a.color }}></span>
                  <span className="text-slate-600">{a.name}</span>
                </div>
                <span className="font-medium text-slate-700">{formatCurrency(a.value, true)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Movers + Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        {/* Top movers */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 mb-4">Today&apos;s Movers</h3>
          <div className="space-y-2">
            {DEMO.movers.map(m => (
              <div key={m.symbol} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <span className="font-semibold text-sm text-slate-900">{m.symbol}</span>
                  <span className="text-xs text-slate-400 ml-2">{formatCurrency(m.value, true)}</span>
                </div>
                <span className={`text-sm font-bold ${m.change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatPercent(m.change)}
                </span>
              </div>
            ))}
          </div>
          <Link href="/dashboard/portfolio" className="text-xs text-indigo-600 font-medium mt-3 block">
            View full portfolio →
          </Link>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { href: '/dashboard/import', label: 'Import broker statement', icon: '⬆️' },
              { href: '/dashboard/goals', label: 'Set up a goal', icon: '🎯' },
              { href: '/dashboard/tax', label: 'Check LTCG exposure', icon: '🧾' },
              { href: '/dashboard/research', label: 'Order research report', icon: '🔬' },
              { href: '/dashboard/portfolio?add=epf', label: 'Add EPF / PPF', icon: '🏢' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-2 text-sm text-slate-700 hover:text-indigo-600 py-1.5 hover:bg-slate-50 rounded px-1 transition">
                <span>{a.icon}</span>{a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
