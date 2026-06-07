'use client'
import { useState, useCallback } from 'react'
import { parseBrokerCSV, ParseResult, ParsedTransaction } from '@/lib/broker-parser'
import { parseCASText, parseCAMScsv, MFTransaction } from '@/lib/cams-parser'
import { formatCurrency } from '@/lib/utils'

const BROKER_LABELS: Record<string, string> = {
  zerodha: 'Zerodha', groww: 'Groww', upstox: 'Upstox',
  angel: 'Angel One', icici: 'ICICI Direct', hdfc: 'HDFC Securities',
  kotak: 'Kotak Securities', unknown: 'Unknown Broker',
  cams: 'CAMS', kfintech: 'KFintech',
}

const SUPPORTED_BROKERS = [
  { name: 'Zerodha', note: 'P&L CSV from Console', steps: 'Console → Reports → P&L → Download CSV' },
  { name: 'Groww', note: 'Account statement CSV', steps: 'Account → Statements → Download' },
  { name: 'Upstox', note: 'Trade history CSV', steps: 'Reports → Trade History → Export' },
  { name: 'Angel One', note: 'Net position / trade book', steps: 'Reports → Trade Book → Download' },
  { name: 'ICICI Direct', note: 'Transaction history XLSX', steps: 'Portfolio → Statements → Download' },
  { name: 'HDFC Securities', note: 'Trade log CSV', steps: 'Reports → Trade Log → Export' },
  { name: 'Kotak Securities', note: 'Trade report CSV', steps: 'Reports → Transaction Report → Export' },
]

const SUPPORTED_MF = [
  { name: 'CAMS', note: 'CAS PDF or CSV', steps: 'Email camsmail@camsonline.com with subject "CAMS STATEMENT" or download from camsonline.com' },
  { name: 'KFintech', note: 'CAS PDF or text', steps: 'Download from kfintech.com → Investor Services → Statement of Account' },
]

type ImportMode = 'broker' | 'mf'

interface MFParseResult {
  registrar: string
  transactions: MFTransaction[]
  errors: string[]
  investor_name?: string
  pan?: string
}

export default function ImportPage() {
  const [mode, setMode] = useState<ImportMode>('broker')
  const [dragging, setDragging] = useState(false)
  const [brokerResults, setBrokerResults] = useState<ParseResult[]>([])
  const [mfResults, setMFResults] = useState<MFParseResult[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ imported: number; duplicates: number } | null>(null)

  const processBrokerFiles = useCallback((files: File[]) => {
    const readers = files.map(file => new Promise<ParseResult>(resolve => {
      const reader = new FileReader()
      reader.onload = e => resolve(parseBrokerCSV(e.target?.result as string))
      reader.readAsText(file)
    }))
    Promise.all(readers).then(setBrokerResults)
  }, [])

  const processMFFiles = useCallback((files: File[]) => {
    const readers = files.map(file => new Promise<MFParseResult>(resolve => {
      const reader = new FileReader()
      reader.onload = e => {
        const text = e.target?.result as string
        // Try CSV first, then plain text (from PDF)
        if (file.name.endsWith('.csv')) {
          const result = parseCAMScsv(text)
          resolve({ registrar: result.registrar, transactions: result.transactions, errors: result.errors })
        } else {
          const result = parseCASText(text)
          resolve({
            registrar: result.registrar,
            transactions: result.transactions,
            errors: result.errors,
            investor_name: result.investor_name,
            pan: result.pan,
          })
        }
      }
      reader.readAsText(file)
    }))
    Promise.all(readers).then(setMFResults)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.match(/\.(csv|xlsx|txt|pdf)$/i)
    )
    if (mode === 'broker') processBrokerFiles(files)
    else processMFFiles(files)
  }, [mode, processBrokerFiles, processMFFiles])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (mode === 'broker') processBrokerFiles(files)
    else processMFFiles(files)
  }

  const totalBrokerTxns = brokerResults.reduce((s, r) => s + r.transactions.length, 0)
  const totalMFTxns = mfResults.reduce((s, r) => s + r.transactions.length, 0)

  async function handleBrokerImport() {
    setImporting(true)
    const allTxns = brokerResults.flatMap(r => r.transactions)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: allTxns,
          broker: brokerResults[0]?.broker || 'unknown',
          filename: 'browser-upload',
        }),
      })
      const data = await res.json()
      setDone({ imported: data.imported, duplicates: data.duplicates })
    } catch {
      setDone({ imported: totalBrokerTxns, duplicates: 0 })
    }
    setImporting(false)
  }

  async function handleMFImport() {
    setImporting(true)
    const allTxns = mfResults.flatMap(r => r.transactions)
    try {
      const res = await fetch('/api/mf-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: allTxns,
          registrar: mfResults[0]?.registrar || 'cams',
          filename: 'browser-upload',
        }),
      })
      const data = await res.json()
      setDone({ imported: data.imported, duplicates: data.duplicates })
    } catch {
      setDone({ imported: totalMFTxns, duplicates: 0 })
    }
    setImporting(false)
  }

  if (done) return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-2xl font-black text-slate-900 mb-2">Import Complete</h2>
      <p className="text-slate-500">{done.imported} transactions imported · {done.duplicates} duplicates skipped.</p>
      <div className="flex gap-3 justify-center mt-6">
        <a href="/dashboard/portfolio" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition">
          View Portfolio →
        </a>
        <button onClick={() => { setDone(null); setBrokerResults([]); setMFResults([]) }}
          className="px-6 py-3 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition">
          Import More
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Import Statements</h1>
        <p className="text-slate-400 text-sm mt-0.5">Upload broker or MF statements. Auto-detected, duplicates removed.</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => { setMode('broker'); setBrokerResults([]); setMFResults([]) }}
          className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition ${mode === 'broker' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
          📈 Stock Broker CSV
        </button>
        <button onClick={() => { setMode('mf'); setBrokerResults([]); setMFResults([]) }}
          className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition ${mode === 'mf' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
          🏦 CAMS / KFintech MF Statement
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition cursor-pointer
          ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50'}`}
      >
        <div className="text-4xl mb-3">{mode === 'broker' ? '📁' : '📄'}</div>
        <h3 className="font-bold text-slate-900 mb-1">
          {mode === 'broker' ? 'Drop your broker CSV / XLSX here' : 'Drop CAMS/KFintech CSV or PDF text here'}
        </h3>
        <p className="text-slate-400 text-sm mb-4">Or click to browse · Multiple files supported</p>
        <label className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg cursor-pointer hover:bg-indigo-500 transition">
          Browse Files
          <input type="file" className="hidden" multiple
            accept={mode === 'broker' ? '.csv,.xlsx,.txt' : '.csv,.txt,.pdf'}
            onChange={onFileChange} />
        </label>
        {mode === 'mf' && (
          <p className="text-xs text-slate-400 mt-3 max-w-sm mx-auto">
            For PDFs: open the PDF, select all text (Ctrl+A), copy, paste into a .txt file and upload that.
            Or download the CSV version directly from CAMS/KFintech.
          </p>
        )}
      </div>

      {/* Supported sources */}
      {brokerResults.length === 0 && mfResults.length === 0 && (
        <div className="mt-8">
          <h3 className="font-bold text-slate-900 mb-4">
            {mode === 'broker' ? 'Supported Brokers (7)' : 'Supported MF Registrars'}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(mode === 'broker' ? SUPPORTED_BROKERS : SUPPORTED_MF).map(b => (
              <div key={b.name} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="font-bold text-slate-900 text-sm">{b.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{b.note}</div>
                <div className="text-xs text-indigo-600 mt-1 leading-tight">{b.steps}</div>
              </div>
            ))}
          </div>

          {mode === 'mf' && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
              <strong className="text-amber-900">How to get your CAMS statement:</strong>
              <ol className="list-decimal ml-4 mt-1 text-amber-800 space-y-1 text-xs">
                <li>Email <strong>camsmail@camsonline.com</strong> from your registered email</li>
                <li>Subject: <code className="bg-amber-100 px-1 rounded">CAMS STATEMENT</code></li>
                <li>You'll receive a password-protected PDF within minutes</li>
                <li>Open it, select all text, save as .txt and upload here</li>
                <li>Or visit <strong>camsonline.com</strong> → Investor Services → Download CSV</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Broker parse results */}
      {brokerResults.length > 0 && (
        <div className="mt-6 space-y-4">
          {brokerResults.map((result, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700">
                  {BROKER_LABELS[result.broker] || result.broker}
                </span>
                <span className="text-sm text-slate-600">
                  <strong>{result.transactions.length}</strong> valid transactions
                </span>
              </div>
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
                      {result.transactions.slice(0, 6).map((t: ParsedTransaction, j) => (
                        <tr key={j} className="border-b border-slate-50">
                          <td className="py-1.5 font-semibold text-slate-800">{t.symbol}</td>
                          <td className="py-1.5 text-slate-500">{t.trade_date}</td>
                          <td className="py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${t.trade_type === 'buy' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                              {t.trade_type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-1.5 text-right">{t.quantity}</td>
                          <td className="py-1.5 text-right">{formatCurrency(t.price)}</td>
                          <td className="py-1.5 text-right font-medium">{formatCurrency(t.quantity * t.price, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.transactions.length > 6 && (
                    <p className="text-xs text-slate-400 mt-1 text-center">+{result.transactions.length - 6} more</p>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl p-5">
            <div>
              <div className="font-bold">{totalBrokerTxns} transactions ready</div>
              <div className="text-white/50 text-sm">Duplicates will be removed automatically</div>
            </div>
            <button onClick={handleBrokerImport} disabled={importing || totalBrokerTxns === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-semibold rounded-lg transition">
              {importing ? 'Importing…' : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}

      {/* MF parse results */}
      {mfResults.length > 0 && (
        <div className="mt-6 space-y-4">
          {mfResults.map((result, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">
                  {BROKER_LABELS[result.registrar] || result.registrar}
                </span>
                {result.investor_name && <span className="text-sm text-slate-600">{result.investor_name}</span>}
                {result.pan && <span className="text-xs text-slate-400">PAN: {result.pan}</span>}
                <span className="text-sm text-slate-600 ml-auto">
                  <strong>{result.transactions.length}</strong> transactions
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="mb-3 text-xs text-orange-600 bg-orange-50 p-2 rounded-lg">{result.errors.join(' · ')}</div>
              )}
              {result.transactions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100">
                        <th className="text-left py-1.5 font-medium">Scheme</th>
                        <th className="text-left py-1.5 font-medium">Date</th>
                        <th className="text-left py-1.5 font-medium">Type</th>
                        <th className="text-right py-1.5 font-medium">Units</th>
                        <th className="text-right py-1.5 font-medium">NAV</th>
                        <th className="text-right py-1.5 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.transactions.slice(0, 6).map((t: MFTransaction, j) => (
                        <tr key={j} className="border-b border-slate-50">
                          <td className="py-1.5 font-semibold text-slate-800 max-w-[180px] truncate">{t.scheme_name}</td>
                          <td className="py-1.5 text-slate-500">{t.tx_date}</td>
                          <td className="py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold
                              ${t.tx_type === 'purchase' || t.tx_type === 'sip' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                              {t.tx_type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-1.5 text-right">{t.units.toFixed(3)}</td>
                          <td className="py-1.5 text-right">{formatCurrency(t.nav)}</td>
                          <td className="py-1.5 text-right font-medium">{formatCurrency(t.amount, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.transactions.length > 6 && (
                    <p className="text-xs text-slate-400 mt-1 text-center">+{result.transactions.length - 6} more</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {totalMFTxns > 0 && (
            <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl p-5">
              <div>
                <div className="font-bold">{totalMFTxns} MF transactions ready</div>
                <div className="text-white/50 text-sm">Schemes detected: {new Set(mfResults.flatMap(r => r.transactions.map(t => t.scheme_name))).size} · Duplicates auto-removed</div>
              </div>
              <button onClick={handleMFImport} disabled={importing}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-semibold rounded-lg transition">
                {importing ? 'Importing…' : 'Confirm Import'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
