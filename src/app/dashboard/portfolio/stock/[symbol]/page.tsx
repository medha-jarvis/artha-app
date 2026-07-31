'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils'

interface StockDetail {
  symbol: string
  name: string
  price: number
  change: number
  change_abs: number
  prev_close: number
  open: number
  high: number
  low: number
  volume: number
  market_cap: number
  pe_trailing: number | null
  pe_forward: number | null
  pb: number | null
  eps_ttm: number | null
  eps_forward: number | null
  dividend_yield: number | null
  beta: number | null
  week_52_high: number | null
  week_52_low: number | null
  roe: number | null
  gross_margin: number | null
  operating_margin: number | null
  profit_margin: number | null
  debt_to_equity: number | null
  current_ratio: number | null
  free_cash_flow: number | null
}

interface Tx {
  trade_type: 'buy' | 'sell'
  quantity: number
  price: number
  trade_date: string
  brokerage: number
}

interface Position {
  qty: number
  avg_price: number
  total_invested: number
  realized_gain: number
}

function pct(val: number | null, label: string) {
  if (val === null) return null
  return { label, value: `${(val * 100).toFixed(1)}%` }
}

function num(val: number | null, label: string, prefix = '', suffix = '', decimals = 1) {
  if (val === null) return null
  return { label, value: `${prefix}${val.toFixed(decimals)}${suffix}` }
}

function RangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const range = high - low
  const pos = range > 0 ? Math.max(0, Math.min(100, ((current - low) / range) * 100)) : 50
  return (
    <div>
      <div className="relative h-2 bg-slate-100 rounded-full my-2">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-400 to-emerald-400 rounded-full" style={{ width: '100%' }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full shadow"
          style={{ left: `calc(${pos}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>52W Low: ₹{low.toLocaleString('en-IN')}</span>
        <span className="text-indigo-600 font-semibold">₹{current.toLocaleString('en-IN')}</span>
        <span>52W High: ₹{high.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}

function MetricCell({ label, value, highlight }: { label: string; value: string | null; highlight?: 'good' | 'warn' | 'bad' }) {
  if (!value) return null
  const color = highlight === 'good' ? 'text-emerald-600' : highlight === 'warn' ? 'text-amber-600' : highlight === 'bad' ? 'text-red-500' : 'text-slate-900'
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className={`font-bold text-sm ${color}`}>{value}</div>
    </div>
  )
}

function peSignal(pe: number | null): 'good' | 'warn' | 'bad' | undefined {
  if (!pe) return undefined
  if (pe < 15) return 'good'
  if (pe < 35) return 'warn'
  return 'bad'
}

function roeSignal(roe: number | null): 'good' | 'warn' | 'bad' | undefined {
  if (!roe) return undefined
  if (roe > 0.18) return 'good'
  if (roe > 0.10) return 'warn'
  return 'bad'
}

function deSignal(de: number | null): 'good' | 'warn' | 'bad' | undefined {
  if (!de) return undefined
  if (de < 0.5) return 'good'
  if (de < 1.5) return 'warn'
  return 'bad'
}

export default function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params)
  const [detail, setDetail] = useState<StockDetail | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])
  const [portfolioValue, setPortfolioValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const [detailRes, { data: allTxs }, { data: holdings }] = await Promise.all([
        fetch(`/api/stock-detail?symbol=${symbol}`),
        supabase.from('stock_transactions').select('*').eq('symbol', symbol).order('trade_date'),
        supabase.from('holdings').select('current_value,total_invested').eq('is_active', true),
      ])

      if (!detailRes.ok) { setError('Could not load market data'); setLoading(false); return }
      const detailData: StockDetail = await detailRes.json()
      setDetail(detailData)

      // Build position from transactions
      let qty = 0, avgPrice = 0, totalInvested = 0, realizedGain = 0
      const txList = (allTxs || []) as Tx[]
      for (const tx of txList) {
        if (tx.trade_type === 'buy') {
          const cost = tx.quantity * tx.price + (tx.brokerage || 0)
          const newQty = qty + tx.quantity
          avgPrice = newQty > 0 ? (totalInvested + cost) / newQty : 0
          qty = newQty
          totalInvested += cost
        } else {
          const sellValue = tx.quantity * tx.price - (tx.brokerage || 0)
          const costOfSold = qty > 0 ? (totalInvested / qty) * tx.quantity : 0
          realizedGain += sellValue - costOfSold
          const sellFrac = qty > 0 ? tx.quantity / qty : 0
          totalInvested = totalInvested * (1 - sellFrac)
          qty = Math.max(0, qty - tx.quantity)
        }
      }
      setPosition({ qty, avg_price: avgPrice, total_invested: totalInvested, realized_gain: realizedGain })
      setTxs(txList)

      // Portfolio total
      const holdingsTotal = (holdings || []).reduce((s: number, h: { current_value: number }) => s + (h.current_value || 0), 0)
      const stockValue = qty > 0 ? qty * detailData.price : 0
      setPortfolioValue(holdingsTotal + stockValue)

      setLoading(false)
    }
    load().catch(e => { setError(String(e)); setLoading(false) })
  }, [symbol])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
  )

  if (error || !detail) return (
    <div>
      <Link href="/dashboard/portfolio" className="text-sm text-indigo-600 hover:underline mb-4 inline-flex items-center gap-1">
        ← Portfolio
      </Link>
      <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center mt-4">
        <div className="text-red-500 font-semibold mb-1">Could not load {symbol}</div>
        <div className="text-xs text-red-400">{error || 'Market data unavailable'}</div>
      </div>
    </div>
  )

  const pos = position
  const currentValue = pos && pos.qty > 0 ? pos.qty * detail.price : 0
  const unrealizedGain = currentValue - (pos?.total_invested ?? 0)
  const unrealizedGainPct = pos && pos.total_invested > 0 ? (unrealizedGain / pos.total_invested) * 100 : 0
  const weight = portfolioValue > 0 ? (currentValue / portfolioValue) * 100 : 0
  const isUp = detail.change >= 0

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/portfolio" className="text-sm text-slate-400 hover:text-indigo-600 transition mb-5 inline-flex items-center gap-1">
        ← Back to Portfolio
      </Link>

      {/* Hero */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 md:p-6 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-black text-2xl">{detail.symbol}</span>
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">NSE</span>
            </div>
            <div className="text-white/60 text-sm">{typeof detail.name === 'string' ? detail.name : detail.symbol}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black">₹{detail.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className={`text-sm font-semibold mt-0.5 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isUp ? '▲' : '▼'} {Math.abs(detail.change_abs).toFixed(2)} ({Math.abs(detail.change).toFixed(2)}%) today
            </div>
          </div>
        </div>

        {/* Intraday stats */}
        <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          {[
            { label: 'Open', value: `₹${detail.open.toFixed(2)}` },
            { label: "Day's High", value: `₹${detail.high.toFixed(2)}` },
            { label: "Day's Low", value: `₹${detail.low.toFixed(2)}` },
            { label: 'Volume', value: detail.volume >= 1e6 ? `${(detail.volume / 1e6).toFixed(2)}M` : detail.volume >= 1e3 ? `${(detail.volume / 1e3).toFixed(0)}K` : String(detail.volume) },
          ].map(s => (
            <div key={s.label}>
              <div className="text-xs text-white/40">{s.label}</div>
              <div className="text-sm font-semibold text-white/90 mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Your Position */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Your Position</div>
          {pos && pos.qty > 0 ? (
            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Shares held</span>
                <span className="text-sm font-bold text-slate-900">{pos.qty.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Avg cost</span>
                <span className="text-sm font-bold text-slate-900">₹{pos.avg_price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Total invested</span>
                <span className="text-sm font-bold text-slate-900">{formatCurrency(pos.total_invested, true)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Current value</span>
                <span className="text-sm font-bold text-slate-900">{formatCurrency(currentValue, true)}</span>
              </div>
              <div className="border-t border-slate-100 pt-2.5 mt-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Unrealized P&L</span>
                  <div className="text-right">
                    <div className={`text-sm font-black ${unrealizedGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {unrealizedGain >= 0 ? '+' : ''}{formatCurrency(unrealizedGain, true)}
                    </div>
                    <div className={`text-xs ${unrealizedGain >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {formatPercent(unrealizedGainPct)} absolute
                    </div>
                  </div>
                </div>
              </div>
              {pos.realized_gain !== 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Realized P&L</span>
                  <span className={`text-sm font-semibold ${pos.realized_gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {pos.realized_gain >= 0 ? '+' : ''}{formatCurrency(pos.realized_gain, true)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Portfolio weight</span>
                <span className="text-sm font-bold text-slate-900">{weight.toFixed(1)}%</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 py-4 text-center">No open position</div>
          )}
        </div>

        {/* Valuation */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Valuation</div>
          <div className="grid grid-cols-2 gap-2">
            {detail.market_cap > 0 && (
              <MetricCell label="Market Cap" value={
                detail.market_cap >= 1e12 ? `₹${(detail.market_cap / 1e12).toFixed(2)}T` :
                detail.market_cap >= 1e9 ? `₹${(detail.market_cap / 1e9).toFixed(2)}B` :
                detail.market_cap >= 1e7 ? `₹${(detail.market_cap / 1e7).toFixed(2)}Cr` : `₹${detail.market_cap}`
              } />
            )}
            <MetricCell label="P/E (TTM)" value={detail.pe_trailing ? detail.pe_trailing.toFixed(1) + 'x' : null} highlight={peSignal(detail.pe_trailing)} />
            <MetricCell label="P/E (Fwd)" value={detail.pe_forward ? detail.pe_forward.toFixed(1) + 'x' : null} highlight={peSignal(detail.pe_forward)} />
            <MetricCell label="P/B" value={detail.pb ? detail.pb.toFixed(2) + 'x' : null} />
            <MetricCell label="EPS (TTM)" value={detail.eps_ttm ? `₹${detail.eps_ttm.toFixed(2)}` : null} />
            <MetricCell label="EPS (Fwd)" value={detail.eps_forward ? `₹${detail.eps_forward.toFixed(2)}` : null} />
            <MetricCell label="Div Yield" value={detail.dividend_yield ? `${(detail.dividend_yield * 100).toFixed(2)}%` : null} />
            <MetricCell label="Beta" value={detail.beta ? detail.beta.toFixed(2) : null} />
          </div>
        </div>
      </div>

      {/* 52W Range */}
      {detail.week_52_low && detail.week_52_high && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">52-Week Range</div>
          <RangeBar low={detail.week_52_low} high={detail.week_52_high} current={detail.price} />
        </div>
      )}

      {/* Quality Metrics */}
      {(detail.roe || detail.operating_margin || detail.profit_margin || detail.debt_to_equity) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Quality Metrics</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <MetricCell label="ROE" value={detail.roe ? `${(detail.roe * 100).toFixed(1)}%` : null} highlight={roeSignal(detail.roe)} />
            <MetricCell label="Gross Margin" value={detail.gross_margin ? `${(detail.gross_margin * 100).toFixed(1)}%` : null} />
            <MetricCell label="Op Margin" value={detail.operating_margin ? `${(detail.operating_margin * 100).toFixed(1)}%` : null} />
            <MetricCell label="Net Margin" value={detail.profit_margin ? `${(detail.profit_margin * 100).toFixed(1)}%` : null} />
            <MetricCell label="D/E Ratio" value={detail.debt_to_equity ? detail.debt_to_equity.toFixed(2) + 'x' : null} highlight={deSignal(detail.debt_to_equity)} />
            <MetricCell label="Current Ratio" value={detail.current_ratio ? detail.current_ratio.toFixed(2) + 'x' : null} />
            <MetricCell label="Free Cash Flow"
              value={detail.free_cash_flow
                ? detail.free_cash_flow >= 1e7
                  ? `₹${(detail.free_cash_flow / 1e7).toFixed(1)}Cr`
                  : `₹${(detail.free_cash_flow / 1e5).toFixed(1)}L`
                : null}
            />
          </div>
        </div>
      )}

      {/* Transaction History */}
      {txs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Transaction History ({txs.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Type</th>
                  <th className="text-right py-2 font-medium">Qty</th>
                  <th className="text-right py-2 font-medium">Price</th>
                  <th className="text-right py-2 font-medium">Value</th>
                  <th className="text-right py-2 font-medium">Brokerage</th>
                </tr>
              </thead>
              <tbody>
                {[...txs].reverse().map((tx, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2 text-slate-500">{formatDate(tx.trade_date)}</td>
                    <td className="py-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tx.trade_type === 'buy' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {tx.trade_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium">{tx.quantity.toLocaleString('en-IN')}</td>
                    <td className="py-2 text-right text-slate-700">₹{tx.price.toFixed(2)}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">
                      {formatCurrency(tx.quantity * tx.price, true)}
                    </td>
                    <td className="py-2 text-right text-slate-400 text-xs">
                      {tx.brokerage > 0 ? `₹${tx.brokerage.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
