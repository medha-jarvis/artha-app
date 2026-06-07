'use client'
import { useState, useCallback, useRef } from 'react'
import { parseBrokerCSV, ParseResult, ParsedTransaction } from '@/lib/broker-parser'
import { parseCASText, parseCAMScsv, MFTransaction } from '@/lib/cams-parser'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// ─── Tab definitions ────────────────────────────────────────────────
type Mode = 'stocks' | 'mf' | 'fd' | 'nps' | 'epf' | 'ppf' | 'bank' | 'manual'

const MODES: { id: Mode; icon: string; label: string; sub: string }[] = [
  { id: 'stocks', icon: '📈', label: 'Stocks', sub: 'Broker CSV' },
  { id: 'mf', icon: '🏦', label: 'Mutual Funds', sub: 'CAS PDF/CSV' },
  { id: 'fd', icon: '💰', label: 'Fixed Deposit', sub: 'Manual entry' },
  { id: 'nps', icon: '🎯', label: 'NPS', sub: 'Manual entry' },
  { id: 'epf', icon: '🏢', label: 'EPF/PF', sub: 'Manual entry' },
  { id: 'ppf', icon: '🏛️', label: 'PPF/SSY', sub: 'Manual entry' },
  { id: 'bank', icon: '🏧', label: 'Bank', sub: 'Manual entry' },
  { id: 'manual', icon: '✏️', label: 'Manual Txn', sub: 'Stock/MF' },
]

const BROKER_LABELS: Record<string, string> = {
  zerodha: 'Zerodha', groww: 'Groww', upstox: 'Upstox',
  angel: 'Angel One', icici: 'ICICI Direct', hdfc: 'HDFC Securities',
  kotak: 'Kotak Securities', unknown: 'Unknown Broker', cams: 'CAMS', kfintech: 'KFintech',
}

interface MFParseResult {
  registrar: string
  transactions: MFTransaction[]
  errors: string[]
  investor_name?: string
  pan?: string
}

interface HoldingPayload {
  asset_class: string
  name: string
  current_value: number
  total_invested: number
  account_number?: string
  metadata: Record<string, string | number>
}

// ─── PDF text extraction (client-side, with optional password) ───────
async function extractPDFText(file: File, password?: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  }
  const buffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    password: password || undefined,
  })
  const pdf = await loadingTask.promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n'
  }
  return text
}

// ─── Holding save helper ─────────────────────────────────────────────
async function saveHolding(payload: HoldingPayload): Promise<string | null> {
  const res = await fetch('/api/holdings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return data.error || null
}

// ─── Shared input component ──────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

// ─── FD Form ─────────────────────────────────────────────────────────
function FDForm() {
  const [form, setForm] = useState({ name: '', bank: '', amount: '', current_value: '', rate: '', start_date: '', maturity_date: '', account_number: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.bank || !form.amount) { setMsg({ ok: false, text: 'Bank and principal amount are required.' }); return }
    setSaving(true); setMsg(null)
    const name = form.name || `${form.bank} FD${form.rate ? ' @ ' + form.rate + '%' : ''}`
    const err = await saveHolding({
      asset_class: 'fd',
      name,
      current_value: Number(form.current_value || form.amount),
      total_invested: Number(form.amount),
      account_number: form.account_number || undefined,
      metadata: { bank: form.bank, interest_rate: form.rate, start_date: form.start_date, maturity_date: form.maturity_date },
    })
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Fixed deposit saved.' })
    if (!err) setForm({ name: '', bank: '', amount: '', current_value: '', rate: '', start_date: '', maturity_date: '', account_number: '' })
    setSaving(false)
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bank name" required><input value={form.bank} onChange={f('bank')} placeholder="e.g., HDFC Bank" className={inp} /></Field>
        <Field label="Interest rate (%)" ><input value={form.rate} onChange={f('rate')} type="number" step="0.01" placeholder="7.25" className={inp} /></Field>
      </div>
      <Field label="FD name / label"><input value={form.name} onChange={f('name')} placeholder="Auto-generated if blank" className={inp} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Principal amount (₹)" required><input value={form.amount} onChange={f('amount')} type="number" placeholder="100000" className={inp} /></Field>
        <Field label="Current value (₹)"><input value={form.current_value} onChange={f('current_value')} type="number" placeholder="Same as principal if unsure" className={inp} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date"><input value={form.start_date} onChange={f('start_date')} type="date" className={inp} /></Field>
        <Field label="Maturity date"><input value={form.maturity_date} onChange={f('maturity_date')} type="date" className={inp} /></Field>
      </div>
      <Field label="Account number (optional)"><input value={form.account_number} onChange={f('account_number')} placeholder="FD reference / account number" className={inp} /></Field>
      {msg && <p className={`text-sm p-3 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>}
      <button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition">
        {saving ? 'Saving…' : 'Save Fixed Deposit'}
      </button>
    </div>
  )
}

// ─── NPS Form ─────────────────────────────────────────────────────────
function NPSForm() {
  const [form, setForm] = useState({ pran: '', tier: 'tier1', fund_manager: '', current_value: '', total_invested: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.current_value) { setMsg({ ok: false, text: 'Current value is required.' }); return }
    setSaving(true); setMsg(null)
    const tierLabel = form.tier === 'tier1' ? 'Tier 1' : 'Tier 2'
    const name = `NPS ${tierLabel}${form.fund_manager ? ' — ' + form.fund_manager : ''}`
    const err = await saveHolding({
      asset_class: 'nps',
      name,
      current_value: Number(form.current_value),
      total_invested: Number(form.total_invested || form.current_value),
      account_number: form.pran || undefined,
      metadata: { tier: form.tier, fund_manager: form.fund_manager },
    })
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'NPS account saved.' })
    if (!err) setForm({ pran: '', tier: 'tier1', fund_manager: '', current_value: '', total_invested: '' })
    setSaving(false)
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="PRAN number"><input value={form.pran} onChange={f('pran')} placeholder="12-digit PRAN" className={inp} /></Field>
        <Field label="Tier">
          <select value={form.tier} onChange={f('tier')} className={inp}>
            <option value="tier1">Tier 1 (Retirement)</option>
            <option value="tier2">Tier 2 (Voluntary)</option>
          </select>
        </Field>
      </div>
      <Field label="Fund manager"><input value={form.fund_manager} onChange={f('fund_manager')} placeholder="e.g., SBI, HDFC, LIC, UTI, Kotak" className={inp} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Current corpus (₹)" required><input value={form.current_value} onChange={f('current_value')} type="number" placeholder="As per NSDL/CAMS" className={inp} /></Field>
        <Field label="Total contributed (₹)"><input value={form.total_invested} onChange={f('total_invested')} type="number" placeholder="Employee + employer" className={inp} /></Field>
      </div>
      {msg && <p className={`text-sm p-3 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>}
      <button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition">
        {saving ? 'Saving…' : 'Save NPS Account'}
      </button>
    </div>
  )
}

// ─── EPF Form ────────────────────────────────────────────────────────
function EPFForm() {
  const [form, setForm] = useState({ uan: '', employer: '', pf_number: '', employee_contrib: '', employer_contrib: '', current_value: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.current_value) { setMsg({ ok: false, text: 'Current EPF balance is required.' }); return }
    setSaving(true); setMsg(null)
    const name = `EPF${form.employer ? ' — ' + form.employer : ''}`
    const totalInvested = (Number(form.employee_contrib || 0) + Number(form.employer_contrib || 0)) || Number(form.current_value)
    const err = await saveHolding({
      asset_class: 'epf',
      name,
      current_value: Number(form.current_value),
      total_invested: totalInvested,
      account_number: form.uan || undefined,
      metadata: { uan: form.uan, employer: form.employer, pf_number: form.pf_number, employee_contrib: form.employee_contrib, employer_contrib: form.employer_contrib },
    })
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'EPF balance saved.' })
    if (!err) setForm({ uan: '', employer: '', pf_number: '', employee_contrib: '', employer_contrib: '', current_value: '' })
    setSaving(false)
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="UAN number"><input value={form.uan} onChange={f('uan')} placeholder="12-digit UAN" className={inp} /></Field>
        <Field label="PF account number"><input value={form.pf_number} onChange={f('pf_number')} placeholder="MH/BAN/12345/…" className={inp} /></Field>
      </div>
      <Field label="Employer name"><input value={form.employer} onChange={f('employer')} placeholder="e.g., KEC International Ltd" className={inp} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Employee contribution (₹)"><input value={form.employee_contrib} onChange={f('employee_contrib')} type="number" placeholder="Total till date" className={inp} /></Field>
        <Field label="Employer contribution (₹)"><input value={form.employer_contrib} onChange={f('employer_contrib')} type="number" placeholder="Total till date" className={inp} /></Field>
        <Field label="Current balance (₹)" required><input value={form.current_value} onChange={f('current_value')} type="number" placeholder="As per EPFO" className={inp} /></Field>
      </div>
      {msg && <p className={`text-sm p-3 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>}
      <button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition">
        {saving ? 'Saving…' : 'Save EPF Balance'}
      </button>
    </div>
  )
}

// ─── PPF / SSY Form ──────────────────────────────────────────────────
function PPFForm() {
  const [type, setType] = useState<'ppf' | 'ssy'>('ppf')
  const [form, setForm] = useState({ account_number: '', bank: '', opening_date: '', current_value: '', total_invested: '', beneficiary: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.current_value) { setMsg({ ok: false, text: 'Current balance is required.' }); return }
    setSaving(true); setMsg(null)
    const label = type === 'ppf' ? 'PPF' : 'SSY'
    const name = `${label}${form.bank ? ' — ' + form.bank : ''}${form.beneficiary ? ' (' + form.beneficiary + ')' : ''}`
    const err = await saveHolding({
      asset_class: type,
      name,
      current_value: Number(form.current_value),
      total_invested: Number(form.total_invested || form.current_value),
      account_number: form.account_number || undefined,
      metadata: { bank: form.bank, opening_date: form.opening_date, beneficiary: form.beneficiary },
    })
    setMsg(err ? { ok: false, text: err } : { ok: true, text: `${label} account saved.` })
    if (!err) setForm({ account_number: '', bank: '', opening_date: '', current_value: '', total_invested: '', beneficiary: '' })
    setSaving(false)
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex gap-2">
        {(['ppf', 'ssy'] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
            {t === 'ppf' ? '🏛️ PPF' : '👧 SSY'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account number"><input value={form.account_number} onChange={f('account_number')} placeholder="Account / passbook number" className={inp} /></Field>
        <Field label="Bank / Post office"><input value={form.bank} onChange={f('bank')} placeholder="e.g., SBI, Post Office" className={inp} /></Field>
      </div>
      {type === 'ssy' && <Field label="Beneficiary (girl's name)"><input value={form.beneficiary} onChange={f('beneficiary')} className={inp} /></Field>}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Opening date"><input value={form.opening_date} onChange={f('opening_date')} type="date" className={inp} /></Field>
        <Field label="Total deposited (₹)"><input value={form.total_invested} onChange={f('total_invested')} type="number" className={inp} /></Field>
        <Field label="Current balance (₹)" required><input value={form.current_value} onChange={f('current_value')} type="number" className={inp} /></Field>
      </div>
      {msg && <p className={`text-sm p-3 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>}
      <button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition">
        {saving ? 'Saving…' : `Save ${type === 'ppf' ? 'PPF' : 'SSY'} Account`}
      </button>
    </div>
  )
}

// ─── Bank Form ───────────────────────────────────────────────────────
function BankForm() {
  const [form, setForm] = useState({ bank: '', account_type: 'savings', last4: '', balance: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.bank || !form.balance) { setMsg({ ok: false, text: 'Bank name and balance are required.' }); return }
    setSaving(true); setMsg(null)
    const typeLabel = { savings: 'Savings', current: 'Current', fd: 'FD', rd: 'RD' }[form.account_type] || form.account_type
    const name = `${form.bank} ${typeLabel}${form.last4 ? ' …' + form.last4 : ''}`
    const err = await saveHolding({
      asset_class: 'bank',
      name,
      current_value: Number(form.balance),
      total_invested: Number(form.balance),
      metadata: { bank: form.bank, account_type: form.account_type, last4: form.last4 },
    })
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Bank account saved.' })
    if (!err) setForm({ bank: '', account_type: 'savings', last4: '', balance: '' })
    setSaving(false)
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bank name" required><input value={form.bank} onChange={f('bank')} placeholder="e.g., HDFC, SBI, ICICI" className={inp} /></Field>
        <Field label="Account type">
          <select value={form.account_type} onChange={f('account_type')} className={inp}>
            <option value="savings">Savings Account</option>
            <option value="current">Current Account</option>
            <option value="fd">FD / Term Deposit</option>
            <option value="rd">RD / Recurring Deposit</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account last 4 digits (optional)"><input value={form.last4} onChange={f('last4')} maxLength={4} placeholder="1234" className={inp} /></Field>
        <Field label="Current balance (₹)" required><input value={form.balance} onChange={f('balance')} type="number" className={inp} /></Field>
      </div>
      {msg && <p className={`text-sm p-3 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>}
      <button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition">
        {saving ? 'Saving…' : 'Save Bank Account'}
      </button>
    </div>
  )
}

// ─── Manual Transaction Form ─────────────────────────────────────────
function ManualTxnForm() {
  const [assetType, setAssetType] = useState<'stock' | 'mf'>('stock')
  const [form, setForm] = useState({
    symbol: '', exchange: 'NSE', trade_type: 'buy', trade_date: '', quantity: '', price: '', brokerage: '',
    scheme_name: '', folio: '', tx_type: 'purchase', nav: '', units: '', amount: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    setSaving(true); setMsg(null)
    try {
      if (assetType === 'stock') {
        if (!form.symbol || !form.trade_date || !form.quantity || !form.price) {
          setMsg({ ok: false, text: 'Symbol, date, quantity and price are required.' }); setSaving(false); return
        }
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactions: [{
              symbol: form.symbol.toUpperCase(),
              trade_date: form.trade_date,
              trade_type: form.trade_type,
              quantity: Number(form.quantity),
              price: Number(form.price),
              brokerage: Number(form.brokerage || 0),
              exchange: form.exchange,
            }],
            broker: 'manual',
            filename: 'manual-entry',
          }),
        })
        const data = await res.json()
        setMsg(data.error ? { ok: false, text: data.error } : { ok: true, text: 'Transaction saved.' })
      } else {
        if (!form.scheme_name || !form.trade_date || !form.units || !form.nav) {
          setMsg({ ok: false, text: 'Scheme, date, units and NAV are required.' }); setSaving(false); return
        }
        const res = await fetch('/api/mf-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactions: [{
              scheme_name: form.scheme_name,
              amfi_code: '',
              folio: form.folio,
              tx_date: form.trade_date,
              tx_type: form.tx_type,
              units: Number(form.units),
              nav: Number(form.nav),
              amount: Number(form.amount || Number(form.units) * Number(form.nav)),
            }],
            registrar: 'manual',
            filename: 'manual-entry',
          }),
        })
        const data = await res.json()
        setMsg(data.error ? { ok: false, text: data.error } : { ok: true, text: 'MF transaction saved.' })
      }
    } catch {
      setMsg({ ok: false, text: 'Save failed. Please try again.' })
    }
    setSaving(false)
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex gap-2">
        {(['stock', 'mf'] as const).map(t => (
          <button key={t} onClick={() => setAssetType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${assetType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
            {t === 'stock' ? '📈 Stock' : '🏦 Mutual Fund'}
          </button>
        ))}
      </div>

      {assetType === 'stock' ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Field label="Symbol" required><input value={form.symbol} onChange={f('symbol')} placeholder="RELIANCE" className={inp} /></Field></div>
            <Field label="Exchange">
              <select value={form.exchange} onChange={f('exchange')} className={inp}>
                <option>NSE</option><option>BSE</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trade type">
              <select value={form.trade_type} onChange={f('trade_type')} className={inp}>
                <option value="buy">Buy</option><option value="sell">Sell</option>
              </select>
            </Field>
            <Field label="Trade date" required><input value={form.trade_date} onChange={f('trade_date')} type="date" className={inp} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantity" required><input value={form.quantity} onChange={f('quantity')} type="number" className={inp} /></Field>
            <Field label="Price (₹)" required><input value={form.price} onChange={f('price')} type="number" step="0.01" className={inp} /></Field>
            <Field label="Brokerage (₹)"><input value={form.brokerage} onChange={f('brokerage')} type="number" step="0.01" placeholder="0" className={inp} /></Field>
          </div>
        </>
      ) : (
        <>
          <Field label="Scheme name" required><input value={form.scheme_name} onChange={f('scheme_name')} placeholder="e.g., Parag Parikh Flexi Cap Fund" className={inp} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Transaction type">
              <select value={form.tx_type} onChange={f('tx_type')} className={inp}>
                <option value="purchase">Purchase</option>
                <option value="sip">SIP</option>
                <option value="redemption">Redemption</option>
                <option value="switch_in">Switch In</option>
                <option value="switch_out">Switch Out</option>
              </select>
            </Field>
            <Field label="Date" required><input value={form.trade_date} onChange={f('trade_date')} type="date" className={inp} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Units" required><input value={form.units} onChange={f('units')} type="number" step="0.001" className={inp} /></Field>
            <Field label="NAV (₹)" required><input value={form.nav} onChange={f('nav')} type="number" step="0.0001" className={inp} /></Field>
            <Field label="Amount (₹)"><input value={form.amount} onChange={f('amount')} type="number" placeholder="Units × NAV" className={inp} /></Field>
          </div>
          <Field label="Folio number (optional)"><input value={form.folio} onChange={f('folio')} placeholder="12-digit folio" className={inp} /></Field>
        </>
      )}

      {msg && <p className={`text-sm p-3 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>}
      <button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition">
        {saving ? 'Saving…' : 'Save Transaction'}
      </button>
    </div>
  )
}

// ─── Stocks upload section ────────────────────────────────────────────
function StocksUpload() {
  const [dragging, setDragging] = useState(false)
  const [results, setResults] = useState<ParseResult[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ imported: number; duplicates: number } | null>(null)

  const process = (files: File[]) => {
    const readers = files.map(file => new Promise<ParseResult>(resolve => {
      const reader = new FileReader()
      reader.onload = e => resolve(parseBrokerCSV(e.target?.result as string))
      reader.readAsText(file)
    }))
    Promise.all(readers).then(setResults)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    process(Array.from(e.dataTransfer.files).filter(f => f.name.match(/\.(csv|xlsx|txt)$/i)))
  }

  const handleImport = async () => {
    setImporting(true)
    const allTxns = results.flatMap(r => r.transactions)
    const res = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactions: allTxns, broker: results[0]?.broker || 'unknown', filename: 'upload' }) })
    const data = await res.json()
    setDone({ imported: data.imported || 0, duplicates: data.duplicates || 0 })
    setImporting(false)
  }

  if (done) return (
    <div className="text-center py-12">
      <div className="text-5xl mb-3">✅</div>
      <h3 className="font-bold text-slate-800 mb-1">{done.imported} transactions imported</h3>
      <p className="text-slate-400 text-sm">{done.duplicates} duplicates skipped</p>
      <button onClick={() => { setDone(null); setResults([]) }} className="mt-4 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm">Import more</button>
    </div>
  )

  return (
    <div className="space-y-5">
      <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition cursor-pointer ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50'}`}>
        <div className="text-4xl mb-2">📁</div>
        <h3 className="font-bold text-slate-900 mb-1">Drop your broker CSV / XLSX here</h3>
        <p className="text-slate-400 text-sm mb-4">Zerodha, Groww, Upstox, Angel One, ICICI, HDFC, Kotak</p>
        <label className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg cursor-pointer hover:bg-indigo-500 transition">
          Browse Files
          <input type="file" className="hidden" multiple accept=".csv,.xlsx,.txt" onChange={e => process(Array.from(e.target.files || []))} />
        </label>
      </div>
      {results.length > 0 && (
        <>
          {results.map((r, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{BROKER_LABELS[r.broker] || r.broker}</span>
                <span className="text-sm text-slate-600"><strong>{r.transactions.length}</strong> transactions</span>
              </div>
              {r.transactions.slice(0, 5).map((t: ParsedTransaction, j) => (
                <div key={j} className="text-xs flex justify-between py-1 border-b border-slate-50 last:border-0">
                  <span className="font-semibold text-slate-800">{t.symbol}</span>
                  <span className={`font-bold ${t.trade_type === 'buy' ? 'text-emerald-600' : 'text-red-500'}`}>{t.trade_type.toUpperCase()}</span>
                  <span className="text-slate-500">{t.trade_date}</span>
                  <span className="text-slate-700">{formatCurrency(t.quantity * t.price, true)}</span>
                </div>
              ))}
              {r.transactions.length > 5 && <p className="text-xs text-slate-400 mt-1 text-center">+{r.transactions.length - 5} more</p>}
            </div>
          ))}
          <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl p-5">
            <div>
              <div className="font-bold">{results.reduce((s, r) => s + r.transactions.length, 0)} transactions ready</div>
              <div className="text-white/50 text-sm">Duplicates removed automatically</div>
            </div>
            <button onClick={handleImport} disabled={importing} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-semibold rounded-lg transition">
              {importing ? 'Importing…' : 'Confirm Import'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── MF upload with PDF password support ─────────────────────────────
function MFUpload() {
  const [dragging, setDragging] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [results, setResults] = useState<MFParseResult[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ imported: number; duplicates: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processText = (text: string, registrar?: string): MFParseResult => {
    const result = parseCASText(text)
    return { registrar: registrar || result.registrar, transactions: result.transactions, errors: result.errors, investor_name: result.investor_name, pan: result.pan }
  }

  const processFiles = useCallback((files: File[]) => {
    files.forEach(file => {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setPdfFile(file)
        setResults([])
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        const reader = new FileReader()
        reader.onload = e => {
          const text = e.target?.result as string
          const result = parseCAMScsv(text)
          setResults([{ registrar: result.registrar, transactions: result.transactions, errors: result.errors }])
        }
        reader.readAsText(file)
      } else {
        const reader = new FileReader()
        reader.onload = e => setResults([processText(e.target?.result as string)])
        reader.readAsText(file)
      }
    })
  }, [])

  const extractPDF = async () => {
    if (!pdfFile) return
    setExtracting(true); setPdfError('')
    try {
      const text = await extractPDFText(pdfFile, password || undefined)
      setResults([processText(text)])
      setPdfFile(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setPdfError(msg.includes('password') ? 'Incorrect password. Please check and try again.' : `PDF extraction failed: ${msg}`)
    }
    setExtracting(false)
  }

  const handleImport = async () => {
    setImporting(true)
    const allTxns = results.flatMap(r => r.transactions)
    const res = await fetch('/api/mf-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactions: allTxns, registrar: results[0]?.registrar || 'cams', filename: 'upload' }) })
    const data = await res.json()
    setDone({ imported: data.imported || 0, duplicates: data.duplicates || 0 })
    setImporting(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }

  if (done) return (
    <div className="text-center py-12">
      <div className="text-5xl mb-3">✅</div>
      <h3 className="font-bold text-slate-800 mb-1">{done.imported} MF transactions imported</h3>
      <p className="text-slate-400 text-sm">{done.duplicates} duplicates skipped</p>
      <button onClick={() => { setDone(null); setResults([]) }} className="mt-4 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm">Import more</button>
    </div>
  )

  return (
    <div className="space-y-5">
      {!pdfFile && results.length === 0 && (
        <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition cursor-pointer ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50'}`}>
          <div className="text-4xl mb-2">📄</div>
          <h3 className="font-bold text-slate-900 mb-1">Drop CAMS / KFintech statement here</h3>
          <p className="text-slate-400 text-sm mb-1">Supports PDF (with password), CSV, or TXT</p>
          <p className="text-slate-400 text-xs mb-4">Password-protected CAS PDFs are extracted in your browser — password never sent to server</p>
          <label className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg cursor-pointer hover:bg-indigo-500 transition">
            Browse Files
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.csv,.txt" onChange={e => processFiles(Array.from(e.target.files || []))} />
          </label>
        </div>
      )}

      {/* PDF password prompt */}
      {pdfFile && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔐</span>
            <div>
              <div className="font-bold text-amber-900">{pdfFile.name}</div>
              <div className="text-xs text-amber-700 mt-0.5">
                This PDF may be password protected. CAMS password is usually your email or PAN (lowercase).
                KFintech uses your date of birth (DDMMMYYYY e.g. 01jan1990).
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-amber-900 mb-1">PDF Password (leave blank if no password)</label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="e.g., abcde1234f or 01jan1990"
              className="w-full border border-amber-300 bg-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              onKeyDown={e => e.key === 'Enter' && extractPDF()}
            />
          </div>
          {pdfError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{pdfError}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setPdfFile(null); setPassword(''); setPdfError('') }}
              className="px-4 py-2 border border-amber-200 text-amber-800 font-semibold rounded-lg hover:bg-amber-100 transition text-sm">
              Cancel
            </button>
            <button onClick={extractPDF} disabled={extracting}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition text-sm">
              {extracting ? 'Extracting…' : 'Extract PDF'}
            </button>
          </div>
        </div>
      )}

      {/* MF results preview */}
      {results.length > 0 && (
        <>
          {results.map((r, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{BROKER_LABELS[r.registrar] || r.registrar}</span>
                {r.investor_name && <span className="text-sm text-slate-600">{r.investor_name}</span>}
                <span className="text-sm text-slate-600 ml-auto"><strong>{r.transactions.length}</strong> transactions</span>
              </div>
              {r.errors.length > 0 && <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded mb-2">{r.errors.join(' · ')}</div>}
              {r.transactions.slice(0, 5).map((t: MFTransaction, j) => (
                <div key={j} className="text-xs flex justify-between py-1 border-b border-slate-50 last:border-0">
                  <span className="font-semibold text-slate-800 max-w-[200px] truncate">{t.scheme_name}</span>
                  <span className={`font-bold ${t.tx_type === 'purchase' || t.tx_type === 'sip' ? 'text-emerald-600' : 'text-red-500'}`}>{t.tx_type.toUpperCase()}</span>
                  <span className="text-slate-500">{t.tx_date}</span>
                  <span className="text-slate-700">{formatCurrency(t.amount, true)}</span>
                </div>
              ))}
              {r.transactions.length > 5 && <p className="text-xs text-slate-400 mt-1 text-center">+{r.transactions.length - 5} more</p>}
            </div>
          ))}
          <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl p-5">
            <div>
              <div className="font-bold">{results.reduce((s, r) => s + r.transactions.length, 0)} MF transactions ready</div>
              <div className="text-white/50 text-sm">{new Set(results.flatMap(r => r.transactions.map(t => t.scheme_name))).size} schemes · duplicates removed</div>
            </div>
            <button onClick={handleImport} disabled={importing} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-semibold rounded-lg transition">
              {importing ? 'Importing…' : 'Confirm Import'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────
export default function ImportPage() {
  const [mode, setMode] = useState<Mode>('stocks')

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-black text-slate-900">Import & Add Assets</h1>
        <p className="text-slate-400 text-sm mt-0.5">Upload statements or manually enter any investment type.</p>
      </div>

      {/* Mode tabs — horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-6">
        <div className="flex gap-2 pb-1 min-w-max">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={[
                'flex flex-col items-center px-3 md:px-4 py-2 rounded-xl text-xs font-semibold transition border',
                mode === m.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700',
              ].join(' ')}
            >
              <span className="text-lg mb-0.5">{m.icon}</span>
              <span>{m.label}</span>
              <span className={`text-[10px] ${mode === m.id ? 'text-indigo-200' : 'text-slate-400'}`}>{m.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {mode === 'stocks' && <StocksUpload />}
      {mode === 'mf' && <MFUpload />}
      {mode === 'fd' && (
        <div>
          <div className="mb-4">
            <h2 className="font-bold text-slate-900">Add Fixed Deposit</h2>
            <p className="text-slate-400 text-sm">Bank FDs, NBFCs, corporate bonds held as FDs</p>
          </div>
          <FDForm />
        </div>
      )}
      {mode === 'nps' && (
        <div>
          <div className="mb-4">
            <h2 className="font-bold text-slate-900">Add NPS Account</h2>
            <p className="text-slate-400 text-sm">National Pension System — Tier 1 and Tier 2</p>
          </div>
          <NPSForm />
        </div>
      )}
      {mode === 'epf' && (
        <div>
          <div className="mb-4">
            <h2 className="font-bold text-slate-900">Add EPF Balance</h2>
            <p className="text-slate-400 text-sm">Employee Provident Fund — check balance at passbook.epfindia.gov.in</p>
          </div>
          <EPFForm />
        </div>
      )}
      {mode === 'ppf' && (
        <div>
          <div className="mb-4">
            <h2 className="font-bold text-slate-900">Add PPF / SSY Account</h2>
            <p className="text-slate-400 text-sm">Public Provident Fund and Sukanya Samriddhi Yojana</p>
          </div>
          <PPFForm />
        </div>
      )}
      {mode === 'bank' && (
        <div>
          <div className="mb-4">
            <h2 className="font-bold text-slate-900">Add Bank Account</h2>
            <p className="text-slate-400 text-sm">Savings accounts, current accounts, and bank deposits</p>
          </div>
          <BankForm />
        </div>
      )}
      {mode === 'manual' && (
        <div>
          <div className="mb-4">
            <h2 className="font-bold text-slate-900">Manual Transaction Entry</h2>
            <p className="text-slate-400 text-sm">Add individual stock or mutual fund transactions</p>
          </div>
          <ManualTxnForm />
        </div>
      )}
    </div>
  )
}
