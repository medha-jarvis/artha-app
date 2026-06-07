'use client'
import { formatCurrency } from '@/lib/utils'

const LTCG_LOTS = [
  { symbol: 'RELIANCE', qty: 50, buyDate: '2022-03-15', buyPrice: 2840, cmp: 3110, gain: 13500, holdingDays: 1545 },
  { symbol: 'HDFCBANK', qty: 100, buyDate: '2021-11-20', buyPrice: 1680, cmp: 1732, gain: 5200, holdingDays: 1660 },
  { symbol: 'INFY', qty: 80, buyDate: '2023-06-01', buyPrice: 1820, cmp: 1680, gain: -11200, holdingDays: 736 },
]

const HARVESTABLE = [
  { symbol: 'TCS', loss: -1800, action: 'Can harvest loss to offset LTCG gains' },
  { symbol: 'INFY', loss: -11200, action: 'Sell & buy-back after 30 days to book loss' },
]

const LTCG_TOTAL = LTCG_LOTS.filter(l => l.gain > 0).reduce((s, l) => s + l.gain, 0)
const LTCG_THRESHOLD = 125000
const TAXABLE_LTCG = Math.max(0, LTCG_TOTAL - LTCG_THRESHOLD)
const TAX_ESTIMATE = TAXABLE_LTCG * 0.125

export default function TaxPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Tax Cockpit</h1>
        <p className="text-slate-400 text-sm mt-0.5">FY 2026-27 · FIFO lot accounting · Updated daily</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`rounded-xl p-4 ${TAXABLE_LTCG > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">LTCG This Year</div>
          <div className="text-2xl font-black text-slate-900">{formatCurrency(LTCG_TOTAL, true)}</div>
          <div className="text-xs text-slate-400 mt-0.5">₹1.25L exempt</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Taxable LTCG</div>
          <div className={`text-2xl font-black ${TAXABLE_LTCG > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {formatCurrency(TAXABLE_LTCG, true)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">After ₹1.25L exemption</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tax Estimate</div>
          <div className={`text-2xl font-black ${TAX_ESTIMATE > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatCurrency(TAX_ESTIMATE, true)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">@12.5% LTCG rate</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Harvestable Loss</div>
          <div className="text-2xl font-black text-emerald-700">
            {formatCurrency(Math.abs(HARVESTABLE.reduce((s, h) => s + h.loss, 0)), true)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Can offset LTCG gains</div>
        </div>
      </div>

      {/* Tax Harvesting suggestions */}
      {HARVESTABLE.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
          <h3 className="font-bold text-emerald-900 mb-3">🌾 Tax Harvesting Opportunities</h3>
          <div className="space-y-2">
            {HARVESTABLE.map(h => (
              <div key={h.symbol} className="flex items-center justify-between bg-white rounded-lg p-3">
                <div>
                  <span className="font-bold text-slate-900">{h.symbol}</span>
                  <span className="text-sm text-red-600 ml-2">Loss: {formatCurrency(h.loss, true)}</span>
                </div>
                <div className="text-sm text-emerald-700">{h.action}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-emerald-700 mt-2">
            Harvesting these losses saves ~{formatCurrency(Math.abs(HARVESTABLE.reduce((s,h) => s + h.loss, 0)) * 0.125, true)} in tax.
            Consult your CA before acting.
          </p>
        </div>
      )}

      {/* LTCG Lots table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h3 className="font-bold text-slate-900 mb-4">LTCG Holdings (Held &gt;1 Year)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="text-left py-2 font-medium">Symbol</th>
              <th className="text-right py-2 font-medium">Qty</th>
              <th className="text-right py-2 font-medium">Buy Price</th>
              <th className="text-right py-2 font-medium">Buy Date</th>
              <th className="text-right py-2 font-medium">CMP</th>
              <th className="text-right py-2 font-medium">LTCG Gain</th>
              <th className="text-right py-2 font-medium">Days Held</th>
            </tr>
          </thead>
          <tbody>
            {LTCG_LOTS.map(l => (
              <tr key={l.symbol} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2.5 font-semibold text-slate-900">{l.symbol}</td>
                <td className="py-2.5 text-right text-slate-600">{l.qty}</td>
                <td className="py-2.5 text-right text-slate-600">{formatCurrency(l.buyPrice)}</td>
                <td className="py-2.5 text-right text-slate-500 text-xs">{l.buyDate}</td>
                <td className="py-2.5 text-right font-medium text-slate-700">{formatCurrency(l.cmp)}</td>
                <td className={`py-2.5 text-right font-bold ${l.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatCurrency(l.gain, true)}
                </td>
                <td className="py-2.5 text-right text-slate-500 text-xs">{l.holdingDays}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-400">
        Tax calculations are estimates based on FIFO lot accounting. Not tax advice. Consult a qualified CA before tax-related decisions.
      </div>
    </div>
  )
}
