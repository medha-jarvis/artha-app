'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SymbolEntry { from: string; to: string }

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [taxBracket, setTaxBracket] = useState<20 | 30>(30)
  const [symbolMap, setSymbolMap] = useState<SymbolEntry[]>([])
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email || '')
      setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || '')

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tax_bracket')
        .eq('id', user.id)
        .single()
      if (profile) setTaxBracket(profile.tax_bracket || 30)

      const { data: settings } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .single()
      if (settings?.settings?.symbol_map) {
        setSymbolMap(
          Object.entries(settings.settings.symbol_map as Record<string, string>).map(([from, to]) => ({ from, to }))
        )
      }

      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    const symbolMapObj = Object.fromEntries(
      symbolMap.filter(e => e.from.trim() && e.to.trim()).map(e => [e.from.trim().toUpperCase(), e.to.trim()])
    )

    const [profileResult, settingsResult] = await Promise.all([
      supabase.from('user_profiles').upsert({ id: user.id, tax_bracket: taxBracket }, { onConflict: 'id' }),
      supabase.from('user_settings').upsert(
        { user_id: user.id, settings: { symbol_map: symbolMapObj }, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      ),
    ])

    if (profileResult.error || settingsResult.error) {
      setError(profileResult.error?.message || settingsResult.error?.message || 'Save failed')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  const addSymbol = () => {
    if (!newFrom.trim() || !newTo.trim()) return
    setSymbolMap(prev => [...prev, { from: newFrom.trim().toUpperCase(), to: newTo.trim() }])
    setNewFrom('')
    setNewTo('')
  }

  const removeSymbol = (i: number) => setSymbolMap(prev => prev.filter((_, idx) => idx !== i))

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading settings…</div>
  )

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-slate-900">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your account and portfolio preferences.</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-bold text-slate-900 mb-4">Profile</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">{email}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
              <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">{displayName}</div>
              <p className="text-xs text-slate-400 mt-1">Update in your Supabase auth profile to change.</p>
            </div>
          </div>
        </div>

        {/* Tax */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-bold text-slate-900 mb-1">Tax Settings</h2>
          <p className="text-xs text-slate-400 mb-4">Used for STCG / income tax estimates in Tax Cockpit.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Income Tax Bracket</label>
            <div className="flex gap-3">
              {([20, 30] as const).map(rate => (
                <button key={rate} onClick={() => setTaxBracket(rate)}
                  className={`flex-1 border-2 rounded-lg py-3 text-sm font-bold transition ${taxBracket === rate ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {rate}% slab
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Symbol Map */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-bold text-slate-900 mb-1">Stock Symbol Corrections</h2>
          <p className="text-xs text-slate-400 mb-4">
            Map broker symbols to Yahoo Finance symbols for live price lookups.
            E.g., <code className="bg-slate-100 px-1 rounded">KECIL</code> → <code className="bg-slate-100 px-1 rounded">KEC.NS</code>
          </p>

          {symbolMap.length > 0 && (
            <div className="mb-4 space-y-2">
              {symbolMap.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <code className="text-sm font-mono text-slate-700 flex-1">{entry.from}</code>
                  <span className="text-slate-400 text-xs">→</span>
                  <code className="text-sm font-mono text-indigo-600 flex-1">{entry.to}</code>
                  <button onClick={() => removeSymbol(i)} className="text-slate-300 hover:text-red-400 transition ml-2 text-lg leading-none">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input value={newFrom} onChange={e => setNewFrom(e.target.value.toUpperCase())}
              placeholder="Broker symbol (e.g. KECIL)"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={e => e.key === 'Enter' && addSymbol()} />
            <span className="self-center text-slate-400">→</span>
            <input value={newTo} onChange={e => setNewTo(e.target.value)}
              placeholder="Yahoo symbol (e.g. KEC.NS)"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={e => e.key === 'Enter' && addSymbol()} />
            <button onClick={addSymbol}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition">
              Add
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-500 disabled:opacity-60 transition text-sm">
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
