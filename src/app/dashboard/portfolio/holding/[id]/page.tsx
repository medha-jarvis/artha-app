'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { ASSET_CLASSES } from '@/lib/types'

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

function assetMeta(code: string) {
  return ASSET_CLASSES.find(a => a.code === code) ?? { icon: '💼', name: code, color: '#94a3b8' }
}

function MetaRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-2 border-b border-slate-50">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{String(value)}</span>
    </div>
  )
}

export default function HoldingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [holding, setHolding] = useState<Holding | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data, error: err } = await supabase.from('holdings').select('*').eq('id', id).single()
      if (err || !data) { setError('Holding not found'); setLoading(false); return }
      setHolding(data as Holding)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>

  if (error || !holding) return (
    <div>
      <Link href="/dashboard/portfolio" className="text-sm text-indigo-600 hover:underline mb-4 inline-flex items-center gap-1">← Portfolio</Link>
      <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center mt-4">
        <div className="text-red-500 font-semibold">{error || 'Not found'}</div>
      </div>
    </div>
  )

  const meta = assetMeta(holding.asset_class)
  const gain = (holding.current_value || 0) - (holding.total_invested || 0)
  const gainPct = holding.total_invested > 0 ? (gain / holding.total_invested) * 100 : 0

  // Extract readable metadata fields
  const mdKeys: { label: string; key: string }[] = [
    { label: 'Interest Rate', key: 'interest_rate' },
    { label: 'Maturity Date', key: 'maturity_date' },
    { label: 'Bank / Institution', key: 'bank' },
    { label: 'Scheme Name', key: 'scheme_name' },
    { label: 'ISIN', key: 'isin' },
    { label: 'Folionumber', key: 'folio_number' },
    { label: 'PRAN', key: 'pran' },
    { label: 'UAN', key: 'uan' },
    { label: 'Employer', key: 'employer' },
    { label: 'Nominee', key: 'nominee' },
    { label: 'Notes', key: 'notes' },
  ]

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/portfolio" className="text-sm text-slate-400 hover:text-indigo-600 transition mb-5 inline-flex items-center gap-1">
        ← Back to Portfolio
      </Link>

      {/* Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 md:p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">{meta.icon}</span>
          <div>
            <div className="font-black text-xl">{holding.name}</div>
            <div className="text-white/50 text-sm">{meta.name}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
          <div>
            <div className="text-xs text-white/40 mb-0.5">Invested</div>
            <div className="font-bold text-white">{formatCurrency(holding.total_invested, true)}</div>
          </div>
          <div>
            <div className="text-xs text-white/40 mb-0.5">Current Value</div>
            <div className="font-bold text-white">{formatCurrency(holding.current_value, true)}</div>
          </div>
          <div>
            <div className="text-xs text-white/40 mb-0.5">Gain / Loss</div>
            <div className={`font-bold ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {gain >= 0 ? '+' : ''}{formatCurrency(gain, true)}
            </div>
            <div className={`text-xs ${gain >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
              {formatPercent(gainPct)}
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Details</div>
        {holding.account_number && <MetaRow label="Account / Reference" value={holding.account_number} />}
        {holding.units && holding.units > 0 && <MetaRow label="Units" value={holding.units.toFixed(3)} />}
        {holding.current_nav && <MetaRow label="NAV" value={`₹${holding.current_nav.toFixed(4)}`} />}
        {holding.metadata && mdKeys.map(({ label, key }) => (
          <MetaRow key={key} label={label} value={holding.metadata?.[key] as string | number | null} />
        ))}
        {!holding.account_number && !holding.units && (!holding.metadata || Object.keys(holding.metadata).length === 0) && (
          <div className="text-sm text-slate-400 py-4 text-center">No additional details stored</div>
        )}
      </div>

      {/* Visual gain bar */}
      {holding.total_invested > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Growth</div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${gain >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                style={{ width: `${Math.min(100, Math.abs(gainPct) + 50)}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatPercent(gainPct)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Invested: {formatCurrency(holding.total_invested)}</span>
            <span>Now: {formatCurrency(holding.current_value)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
