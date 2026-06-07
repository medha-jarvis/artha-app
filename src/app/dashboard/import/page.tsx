'use client'
import { useState, useCallback } from 'react'
import { parseBrokerCSV, ParseResult, ParsedTransaction } from '@/lib/broker-parser'
import { formatCurrency } from '@/lib/utils'

const BROKER_LABELS: Record<string, string> = {
  zerodha: 'Zerodha', groww: 'Groww', upstox: 'Upstox',
  angel: 'Angel One', icici: 'ICICI Direct', hdfc: 'HDFC Securities',
  kotak: 'Kotak Securities', unknown: 'Unknown Broker',
}

const SUPPORTED = [
  { name: 'Zerodha', note: 'P&L CSV from Console', steps: 'Console → Reports → P&L → Download CSV' },
  { name: 'Groww', note: 'Account statement CSV', steps: 'Account → Statements → Download' },
  { name: 'Upstox', note: 'Trade history CSV', steps: 'Reports → Trade History → Export' },
  { name: 'Angel One', note: 'Net position / trade book', steps: 'Reports → Trade Book → Download' },
  { name: 'ICICI Direct', note: 'Transaction history XLSX', steps: 'Portfolio → Statements → Download' },
  { name: 'HDFC Securities', note: 'Trade log CSV', steps: 'Reports → Trade Log → Export' },
  { name: 'Kotak Securities', note: 'Trade report CSV', steps: 'Reports → Transaction Report → Export' },
]

export default function ImportPage() {
  const [dragging, setDragging] = useState(false)
  const [results, setResults] = useState<ParseResult[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)

  const processFiles = useCallback((files: File[]) => {
    const readers = files.map(file => new Promise<ParseResult>(resolve => {
      const reader = new FileReader()
      reader.onload = e => {
        const text = e.target?.result as string
        resolve(parseBrokerCSV(text))
      }
      reader.readAsText(file)
    }))
    Promise.all(readers).then(setResults)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.txt')
    )
    processFiles(files)
  }, [processFiles])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    processFiles(files)
  }

  const totalTxns = results.reduce((s, r) => s + r.transactions.length, 0)
  const totalRows = results.reduce((s, r) => s + r.totalRows, 0)

  async function handleImport() {
    setImporting(true)
    await new Promise(r => setTimeout(r, 1200)) // Simulate API call
    setDone(true)
    setImporting(false)
  }

  if (done) return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-2xl font-black text-slate-900 mb-2">Import Complete</h2>
      <p className="text-slate-500">{totalTxns} transactions imported, {totalRows - totalTxns} duplicates skipped.</p>
      <a href="/dashboard/portfolio" className="mt-6 inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition">
        View Portfolio →
      </a>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Import Broker Statement</h1>
        <p className="text-slate-500 mt-1">Upload one or more files. System auto-detects the broker and removes duplicates.</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition cursor-pointer
          ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50'}`}
      >
        <div className="text-4xl mb-3">📁</div>
        <h3 className="font-bold text-slate-900 mb-1">Drop your CSV / XLSX files here</h3>
        <p className="text-slate-400 text-sm mb-4">Or click to browse</p>
        <label className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg cursor-pointer hover:bg-indigo-500 transition">
          Browse Files
          <input type="file" className="hidden" multiple accept=".csv,.xlsx,.txt" onChange={onFileChange} />
        </label>
        <p className="text-xs text-slate-400 mt-4">Multiple files supported · Duplicates removed automatically</p>
      </div>

      {/* Supported brokers */}
      {results.length === 0 && (
        <div className="mt-8">
          <h3 className="font-bold text-slate-900 mb-4">Supported Brokers</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {SUPPORTED.map(b => (
              <div key={b.name} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="font-bold text-slate-900 text-sm">{b.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{b.note}</div>
                <div className="text-xs text-indigo-600 mt-1">{b.steps}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parse results */}
      {results.length > 0 && (
        <div className="mt-6 space-y-4">
          {results.map((result, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full
                    ${result.broker === 'unknown' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {BROKER_LABELS[result.broker]}
                  </span>
                  <span className="text-sm text-slate-600">
                    <strong>{result.transactions.length}</strong> valid transactions
                    {result.totalRows - result.transactions.length > 0 &&
                      <span className="text-slate-400 ml-1">· {result.totalRows - result.transactions.length} skipped</span>}
                  </span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mb-3 text-xs text-orange-600 bg-orange-50 p-2 rounded-lg">
                  {result.errors.join(' · ')}
                </div>
              )}
              {result.transactions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100">
                        <th className="text-left py-1.5 font-medium">Symbol</th>
                        <th className="text-left py-1.5 font-medium">Date</th>
                        <th className="text-left py-1.5 font-medium">Type</th>
                        <th className="text-right py-1.5 font-medium">Qty</th>
                        <th className="text-right py-1.5 font-medium">Price</th>
                        <th className="text-right py-1.5 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.transactions.slice(0, 8).map((t: ParsedTransaction, j) => (
                        <tr key={j} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-1.5 font-semibold text-slate-800">{t.symbol}</td>
                          <td className="py-1.5 text-slate-500">{t.trade_date}</td>
                          <td className="py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold
                              ${t.trade_type === 'buy' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                              {t.trade_type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-1.5 text-right text-slate-700">{t.quantity}</td>
                          <td className="py-1.5 text-right text-slate-700">{formatCurrency(t.price)}</td>
                          <td className="py-1.5 text-right font-medium text-slate-800">
                            {formatCurrency(t.quantity * t.price, true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.transactions.length > 8 && (
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      +{result.transactions.length - 8} more transactions
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl p-5">
            <div>
              <div className="font-bold">{totalTxns} transactions ready to import</div>
              <div className="text-white/50 text-sm">Across {results.length} file(s) · Duplicates will be removed</div>
            </div>
            <button onClick={handleImport} disabled={importing || totalTxns === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-semibold rounded-lg transition">
              {importing ? 'Importing…' : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
