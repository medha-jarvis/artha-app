'use client'
import { useState } from 'react'

const REPORT_TYPES = [
  {
    id: 'concall', name: 'Concall Analysis', price: 499, delivery: '12 hours',
    icon: '🎙️', desc: 'Latest earnings call: management statements, tone, guidance vs actual, red flags.',
    badge: 'Most Popular',
  },
  {
    id: 'walkTalk', name: 'Management Walk the Talk', price: 799, delivery: '24 hours',
    icon: '🤝', desc: '3-year promise vs delivery audit. What management guided vs what actually happened.',
    badge: null,
  },
  {
    id: 'forensic', name: 'Forensic Financial Analysis', price: 999, delivery: '24 hours',
    icon: '🔬', desc: 'Beneish M-Score, Altman Z-Score, Piotroski F-Score, receivables quality, cash conversion.',
    badge: null,
  },
  {
    id: 'valuation', name: 'Valuation Analysis', price: 999, delivery: '24 hours',
    icon: '📐', desc: 'Reverse DCF at current price, implied growth rate, bull/base/bear scenarios, peer comparison.',
    badge: null,
  },
  {
    id: 'comprehensive', name: 'Comprehensive Research Report', price: 1999, delivery: '48 hours',
    icon: '📋', desc: 'Full institutional-grade report: business model, financials, management, valuation, verdict + target.',
    badge: 'Institutional Grade',
  },
]

const SAMPLE_REPORTS = [
  { stock: 'RELIANCE', type: 'Concall Analysis', date: '2 Jun 2026', status: 'Ready' },
  { stock: 'KECL', type: 'Forensic Analysis', date: '28 May 2026', status: 'Ready' },
]

export default function ResearchPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [stock, setStock] = useState('')
  const [ordering, setOrdering] = useState(false)
  const [ordered, setOrdered] = useState(false)

  const selectedReport = REPORT_TYPES.find(r => r.id === selected)

  async function handleOrder() {
    setOrdering(true)
    await new Promise(r => setTimeout(r, 1000))
    setOrdered(true)
    setOrdering(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Research Concierge</h1>
        <p className="text-slate-400 text-sm mt-0.5">Institutional-grade stock research. On demand. Permanently yours.</p>
      </div>

      {ordered ? (
        <div className="text-center py-16 max-w-md mx-auto">
          <div className="text-6xl mb-4">🔬</div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Report Ordered!</h2>
          <p className="text-slate-500 text-sm">Your <strong>{selectedReport?.name}</strong> for <strong>{stock}</strong> is being prepared.
            Delivery in <strong>{selectedReport?.delivery}</strong>. It will be saved permanently to your Report Vault.</p>
          <button onClick={() => { setOrdered(false); setSelected(null); setStock('') }}
            className="mt-6 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition">
            Order Another Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Report types */}
          <div className="col-span-2">
            <h3 className="font-bold text-slate-900 mb-4">Choose Report Type</h3>
            <div className="space-y-3">
              {REPORT_TYPES.map(r => (
                <div key={r.id}
                  onClick={() => setSelected(selected === r.id ? null : r.id)}
                  className={`border rounded-xl p-4 cursor-pointer transition
                    ${selected === r.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{r.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900">{r.name}</h4>
                          {r.badge && (
                            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                              {r.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{r.desc}</p>
                        <div className="text-xs text-slate-400 mt-1">Delivery: {r.delivery}</div>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <div className="font-black text-slate-900 text-lg">₹{r.price.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-700">Research Bundle (any 3)</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Any 3 reports for one stock · 20% discount</p>
                  </div>
                  <div className="font-black text-slate-900 text-lg">₹2,499</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Order panel + vault */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-bold text-slate-900 mb-4">Place Order</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Stock Name / NSE Symbol</label>
                  <input type="text" value={stock} onChange={e => setStock(e.target.value.toUpperCase())}
                    placeholder="e.g., RELIANCE, KECL, TCS"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                {selected && (
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">Selected</div>
                    <div className="font-bold text-slate-900">{selectedReport?.name}</div>
                    <div className="text-indigo-600 font-black">₹{selectedReport?.price.toLocaleString()}</div>
                    <div className="text-xs text-slate-400">Delivery: {selectedReport?.delivery}</div>
                  </div>
                )}
                <button
                  onClick={handleOrder}
                  disabled={!selected || !stock || ordering}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-lg transition">
                  {ordering ? 'Processing…' : selected && stock ? `Order for ₹${selectedReport?.price.toLocaleString()}` : 'Select report & stock'}
                </button>
                <p className="text-xs text-slate-400 text-center">Paid via Razorpay · Permanently saved to vault</p>
              </div>
            </div>

            {/* Report Vault */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-bold text-slate-900 mb-3">📁 Report Vault</h3>
              {SAMPLE_REPORTS.length === 0 ? (
                <p className="text-sm text-slate-400">No reports yet. Order your first one.</p>
              ) : (
                <div className="space-y-2">
                  {SAMPLE_REPORTS.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{r.stock}</div>
                        <div className="text-xs text-slate-400">{r.type} · {r.date}</div>
                      </div>
                      <button className="text-xs text-indigo-600 font-medium hover:underline">Download</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-xs font-bold text-amber-800 mb-1">Elite subscribers</div>
              <div className="text-xs text-amber-700">Get 2 free reports/month + 20% off all additional reports. Upgrade to Elite.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
