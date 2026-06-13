'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface StockTx {
  symbol: string
  trade_type: 'buy' | 'sell'
  quantity: number
  price: number
  trade_date: string
  brokerage: number
}

interface TaxLot {
  symbol: string
  qty: number
  buy_date: string
  buy_price: number
}

interface UnrealizedLot extends TaxLot {
  holding_days: number
  is_ltcg: boolean
  current_price: number
  gain: number
}

interface RealizedTx {
  symbol: string
  sell_date: string
  qty: number
  gain: number
  holding_days: number
  is_ltcg: boolean
}

function daysBetween(a: string, b: Date): number {
  return Math.floor((b.getTime() - new Date(a).getTime()) / 86400000)
}

function currentFY() {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return {
    start: new Date(year, 3, 1),
    label: `FY ${year}-${String(year + 1).slice(2)}`,
  }
}

function computeFIFO(txs: StockTx[], livePrices: Record<string, number>) {
  const sorted = [...txs].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
  const lotsBySymbol: Record<string, TaxLot[]> = {}
  const realized: RealizedTx[] = []
  const { start: fyStart } = currentFY()
  const today = new Date()

  for (const tx of sorted) {
    if (tx.trade_type === 'buy') {
      if (!lotsBySymbol[tx.symbol]) lotsBySymbol[tx.symbol] = []
      const costPerShare = (tx.quantity * tx.price + (tx.brokerage || 0)) / tx.quantity
      lotsBySymbol[tx.symbol].push({ symbol: tx.symbol, qty: tx.quantity, buy_date: tx.trade_date, buy_price: costPerShare })
    } else {
      let qtyLeft = tx.quantity
      const lots = lotsBySymbol[tx.symbol] || []
      const proceedsPerShare = (tx.quantity * tx.price - (tx.brokerage || 0)) / tx.quantity
      while (qtyLeft > 0 && lots.length > 0) {
        const lot = lots[0]
        const used = Math.min(lot.qty, qtyLeft)
        const gain = (proceedsPerShare - lot.buy_price) * used
        const days = daysBetween(lot.buy_date, new Date(tx.trade_date))
        if (new Date(tx.trade_date) >= fyStart) {
          realized.push({ symbol: tx.symbol, sell_date: tx.trade_date, qty: used, gain, holding_days: days, is_ltcg: days > 365 })
        }
        lot.qty -= used
        qtyLeft -= used
        if (lot.qty === 0) lots.shift()
      }
    }
  }

  const unrealized: UnrealizedLot[] = []
  for (const lots of Object.values(lotsBySymbol)) {
    for (const lot of lots) {
      if (lot.qty <= 0) continue
      const days = daysBetween(lot.buy_date, today)
      const livePrice = livePrices[lot.symbol] || lot.buy_price
      unrealized.push({ ...lot, holding_days: days, is_ltcg: days > 365, current_price: livePrice, gain: (livePrice - lot.buy_price) * lot.qty })
    }
  }

  return { unrealized, realized }
}

function LotTable({ lots }: { lots: UnrealizedLot[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-xs border-b border-slate-100">
            <th className="text-left py-2 font-medium">Symbol</th>
            <th className="text-right py-2 font-medium">Qty</th>
            <th className="text-right py-2 font-medium hidden md:table-cell">Buy Price</th>
            <th className="text-right py-2 font-medium hidden md:table-cell">Buy Date</th>
            <th className="text-right py-2 font-medium">CMP</th>
            <th className="text-right py-2 font-medium">Gain / Loss</th>
            <th className="text-right py-2 font-medium">Days</th>
          </tr>
        </thead>
        <tbody>
          {[...lots].sort((a, b) => b.gain - a.gain).map((lot, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-2.5 font-semibold text-slate-900">{lot.symbol}</td>
              <td className="py-2.5 text-right text-slate-600">{lot.qty % 1 === 0 ? lot.qty : lot.qty.toFixed(3)}</td>
              <td className="py-2.5 text-right text-slate-500 hidden md:table-cell">{formatCurrency(lot.buy_price)}</td>
              <td className="py-2.5 text-right text-slate-400 text-xs hidden md:table-cell">{lot.buy_date}</td>
              <td className="py-2.5 text-right font-medium text-slate-700">{formatCurrency(lot.current_price)}</td>
              <td className={`py-2.5 text-right font-bold ${lot.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {lot.gain >= 0 ? '+' : ''}{formatCurrency(lot.gain, true)}
              </td>
              <td className="py-2.5 text-right text-slate-400 text-xs">{lot.holding_days}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RealizedTable({ realized }: { realized: RealizedTx[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-xs border-b border-slate-100">
            <th className="text-left py-2 font-medium">Symbol</th>
            <th className="text-left py-2 font-medium">Type</th>
            <th className="text-right py-2 font-medium hidden md:table-cell">Sell Date</th>
            <th className="text-right py-2 font-medium">Qty</th>
            <th className="text-right py-2 font-medium">Gain / Loss</th>
            <th className="text-right py-2 font-medium hidden md:table-cell">Held</th>
          </tr>
        </thead>
        <tbody>
          {realized.map((r, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-2.5 font-semibold text-slate-900">{r.symbol}</td>
              <td className="py-2.5">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${r.is_ltcg ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {r.is_ltcg ? 'LTCG' : 'STCG'}
                </span>
              </td>
              <td className="py-2.5 text-right text-slate-400 text-xs hidden md:table-cell">{r.sell_date}</td>
              <td className="py-2.5 text-right text-slate-600">{r.qty % 1 === 0 ? r.qty : r.qty.toFixed(3)}</td>
              <td className={`py-2.5 text-right font-bold ${r.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {r.gain >= 0 ? '+' : ''}{formatCurrency(r.gain, true)}
              </td>
              <td className="py-2.5 text-right text-slate-400 text-xs hidden md:table-cell">{r.holding_days}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TaxPage() {
  const [loading, setLoading] = useState(true)
  const [unrealized, setUnrealized] = useState<UnrealizedLot[]>([])
  const [realized, setRealized] = useState<RealizedTx[]>([])
  const [activeTab, setActiveTab] = useState<'unrealized' | 'realized'>('unrealized')
  const fy = currentFY()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: txs } = await supabase
        .from('stock_transactions')
        .select('symbol,trade_type,quantity,price,trade_date,brokerage')
        .order('trade_date')
      if (!txs || txs.length === 0) { setLoading(false); return }

      const symbols = [...new Set(txs.map(t => t.symbol))]
      let livePrices: Record<string, number> = {}
      try {
        const res = await fetch('/api/live-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols }),
        })
        if (res.ok) {
          const data = await res.json()
          livePrices = Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, (v as { price: number }).price])
          )
        }
      } catch { /* use cost basis */ }

      const result = computeFIFO(txs as StockTx[], livePrices)
      setUnrealized(result.unrealized)
      setRealized(result.realized)
      setLoading(false)
    }
    load()
  }, [])

  const ltcgLots = unrealized.filter(l => l.is_ltcg)
  const stcgLots = unrealized.filter(l => !l.is_ltcg)
  const ltcgGain = ltcgLots.reduce((s, l) => s + Math.max(0, l.gain), 0)
  const stcgGain = stcgLots.reduce((s, l) => s + Math.max(0, l.gain), 0)
  const realizedLtcgGain = realized.filter(r => r.is_ltcg && r.gain > 0).reduce((s, r) => s + r.gain, 0)
  const realizedStcgGain = realized.filter(r => !r.is_ltcg && r.gain > 0).reduce((s, r) => s + r.gain, 0)
  const totalLtcg = realizedLtcgGain + ltcgGain
  const taxableLtcg = Math.max(0, totalLtcg - 125000)
  const taxEstimate = taxableLtcg * 0.125 + realizedStcgGain * 0.20 + stcgGain * 0.20
  const harvestable = unrealized.filter(l => l.gain < 0)
  const totalHarvestable = Math.abs(harvestable.reduce((s, l) => s + l.gain, 0))

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Computing FIFO lots…</div>
  )

  if (unrealized.length === 0 && realized.length === 0) return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Tax Cockpit</h1>
        <p className="text-slate-400 text-sm">{fy.label} · FIFO lot accounting</p>
      </div>
      <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
        <div className="text-5xl mb-4">🧾</div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">No stock transactions yet</h3>
        <p className="text-slate-400 text-sm">Import your broker statement to see LTCG analysis.</p>
      </div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Tax Cockpit</h1>
        <p className="text-slate-400 text-sm mt-0.5">{fy.label} · FIFO lot accounting · Live prices</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className={`rounded-xl p-4 ${totalLtcg > 125000 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total LTCG</div>
          <div className="text-xl md:text-2xl font-black text-slate-900">{formatCurrency(totalLtcg, true)}</div>
          <div className="text-xs text-slate-400 mt-0.5">Realized + unrealized gains</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Taxable LTCG</div>
          <div className={`text-xl md:text-2xl font-black ${taxableLtcg > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {formatCurrency(taxableLtcg, true)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">After ₹1.25L exemption</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tax Estimate</div>
          <div className={`text-xl md:text-2xl font-black ${taxEstimate > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatCurrency(taxEstimate, true)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">LTCG 12.5% + STCG 20%</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Harvestable Loss</div>
          <div className="text-xl md:text-2xl font-black text-emerald-700">{formatCurrency(totalHarvestable, true)}</div>
          <div className="text-xs text-slate-400 mt-0.5">{harvestable.length} lots with unrealized loss</div>
        </div>
      </div>

      {harvestable.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
          <h3 className="font-bold text-emerald-900 mb-3">🌾 Tax Harvesting Opportunities</h3>
          <div className="space-y-2">
            {harvestable.slice(0, 5).map((l, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3">
                <div>
                  <span className="font-bold text-slate-900">{l.symbol}</span>
                  <span className="text-xs text-slate-400 ml-2">{l.qty % 1 === 0 ? l.qty : l.qty.toFixed(3)} units · {l.buy_date} · {l.holding_days}d held</span>
                </div>
                <span className="text-red-600 font-semibold text-sm">{formatCurrency(l.gain, true)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-emerald-700 mt-3">
            Harvesting all losses saves ~{formatCurrency(totalHarvestable * 0.125, true)} in LTCG tax. Re-buy after 30 days to avoid wash-sale. Consult CA.
          </p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-slate-100">
          {([['unrealized', `Unrealized (${unrealized.length} lots)`], ['realized', `Realized (${fy.label})`]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 md:px-6 py-3 text-sm font-semibold transition ${activeTab === key ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'unrealized' ? (
            <div className="space-y-6">
              {ltcgLots.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="font-semibold text-slate-700 text-sm">LTCG Eligible — held &gt; 1 year</h4>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ltcgGain > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {ltcgGain >= 0 ? '+' : ''}{formatCurrency(ltcgGain, true)} unrealized
                    </span>
                  </div>
                  <LotTable lots={ltcgLots} />
                </div>
              )}
              {stcgLots.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="font-semibold text-slate-700 text-sm">STCG — held ≤ 1 year</h4>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${stcgGain > 0 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {stcgGain >= 0 ? '+' : ''}{formatCurrency(stcgGain, true)} unrealized
                    </span>
                  </div>
                  <LotTable lots={stcgLots} />
                </div>
              )}
              {unrealized.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">No open positions</div>
              )}
            </div>
          ) : (
            realized.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No realized gains/losses in {fy.label}</div>
            ) : (
              <RealizedTable realized={realized} />
            )
          )}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4 text-xs text-slate-400">
        FIFO lot accounting · LTCG @12.5% (Budget 2024) · STCG @20% · ₹1.25L annual LTCG exemption · Not tax advice — consult CA
      </div>
    </div>
  )
}
