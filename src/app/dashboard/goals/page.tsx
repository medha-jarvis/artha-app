'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface Goal {
  id: string
  name: string
  icon: string
  target_corpus: number
  target_year: number
  inflation_rate: number
  expected_return: number
  monthly_sip: number | null
  corpus_saved: number | null
  created_at: string
}

const GOAL_ICONS = ['🎯', '🏖️', '🎓', '🏡', '🚗', '✈️', '💍', '👶', '🏋️', '💰', '🌍', '🎵', '🏥', '🎮', '📚']

const EMPTY_FORM = {
  name: '', icon: '🎯',
  target_corpus: '', target_year: String(new Date().getFullYear() + 10),
  inflation_rate: '6', expected_return: '12',
  monthly_sip: '', corpus_saved: '',
}

function calcRequiredSIP(corpus: number, rateAnnual: number, years: number): number {
  if (years <= 0) return corpus
  const r = rateAnnual / 100 / 12
  const n = years * 12
  if (r === 0) return corpus / n
  return corpus * r / (Math.pow(1 + r, n) - 1)
}

function calcProjectedCorpus(saved: number, sipMonthly: number, rateAnnual: number, years: number): number {
  if (years <= 0) return saved
  const r = rateAnnual / 100 / 12
  const n = years * 12
  const fvSaved = saved * Math.pow(1 + r, n)
  const fvSip = r === 0 ? sipMonthly * n : sipMonthly * (Math.pow(1 + r, n) - 1) / r
  return fvSaved + fvSip
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  )
}

function GoalCard({ goal, onDelete, onEdit }: { goal: Goal; onDelete: (id: string) => void; onEdit: (g: Goal) => void }) {
  const yearsLeft = goal.target_year - new Date().getFullYear()
  const reqSIP = calcRequiredSIP(goal.target_corpus, goal.expected_return, yearsLeft)
  const saved = goal.corpus_saved || 0
  const sip = goal.monthly_sip || 0
  const projected = calcProjectedCorpus(saved, sip, goal.expected_return, yearsLeft)
  const progressPct = goal.target_corpus > 0 ? (saved / goal.target_corpus) * 100 : 0
  const projectedPct = goal.target_corpus > 0 ? (projected / goal.target_corpus) * 100 : 0
  const onTrack = projected >= goal.target_corpus

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{goal.icon}</span>
          <div>
            <h3 className="font-black text-slate-900">{goal.name}</h3>
            <div className="text-xs text-slate-400 mt-0.5">
              Target: {goal.target_year} · {Math.max(0, yearsLeft)} years left
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(goal)} className="text-slate-300 hover:text-indigo-400 transition p-1 rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(goal.id)} className="text-slate-200 hover:text-red-400 transition text-xl leading-none px-1">×</button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Target corpus</span>
          <span className="font-bold text-slate-900">{formatCurrency(goal.target_corpus, true)}</span>
        </div>
        {saved > 0 && (
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Already saved</span>
              <span className="font-semibold text-indigo-600">{formatCurrency(saved, true)}</span>
            </div>
            <ProgressBar pct={progressPct} color="#4f46e5" />
            <div className="text-xs text-slate-400 mt-1">{progressPct.toFixed(1)}% of goal reached</div>
          </div>
        )}
        {sip > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Monthly SIP</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(sip, true)}/mo</span>
          </div>
        )}
      </div>

      {/* Projection box */}
      {yearsLeft > 0 && (
        <div className={`rounded-lg p-3 mt-3 ${onTrack ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-bold text-slate-600">Projected corpus in {yearsLeft}y</div>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${onTrack ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {onTrack ? '✓ On Track' : '⚠ Short'}
            </span>
          </div>
          <div className={`text-lg font-black ${onTrack ? 'text-emerald-700' : 'text-amber-700'}`}>
            {formatCurrency(projected, true)}
          </div>
          {!onTrack && sip > 0 && (
            <div className="text-xs text-amber-600 mt-0.5">
              Need {formatCurrency(reqSIP, true)}/mo · increase by {formatCurrency(reqSIP - sip, true)}/mo
            </div>
          )}
          {onTrack && sip > 0 && (
            <div className="text-xs text-emerald-600 mt-0.5">
              {formatCurrency(projected - goal.target_corpus, true)} surplus projected
            </div>
          )}
          {sip === 0 && (
            <div className="text-xs text-slate-500 mt-0.5">
              Need {formatCurrency(reqSIP, true)}/mo SIP to reach goal
            </div>
          )}
          {(saved > 0 || sip > 0) && (
            <ProgressBar pct={projectedPct} color={onTrack ? '#059669' : '#d97706'} />
          )}
        </div>
      )}
    </div>
  )
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const supabase = createClient()

  const loadGoals = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: false })
    if (!error && data) setGoals(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadGoals() }, [loadGoals])

  const openCreate = () => { setEditGoal(null); setForm(EMPTY_FORM); setError(null); setShowForm(true) }
  const openEdit = (g: Goal) => {
    setEditGoal(g)
    setForm({
      name: g.name, icon: g.icon,
      target_corpus: String(g.target_corpus),
      target_year: String(g.target_year),
      inflation_rate: String(g.inflation_rate),
      expected_return: String(g.expected_return),
      monthly_sip: g.monthly_sip != null ? String(g.monthly_sip) : '',
      corpus_saved: g.corpus_saved != null ? String(g.corpus_saved) : '',
    })
    setError(null)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Goal name is required.'); return }
    if (!form.target_corpus || Number(form.target_corpus) <= 0) { setError('Target corpus must be > 0.'); return }
    if (!form.target_year || Number(form.target_year) <= new Date().getFullYear()) { setError('Target year must be in the future.'); return }
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(), icon: form.icon,
      target_corpus: Number(form.target_corpus),
      target_year: Number(form.target_year),
      inflation_rate: Number(form.inflation_rate) || 6,
      expected_return: Number(form.expected_return) || 12,
      monthly_sip: form.monthly_sip ? Number(form.monthly_sip) : null,
      corpus_saved: form.corpus_saved ? Number(form.corpus_saved) : 0,
    }
    if (editGoal) {
      const { error } = await supabase.from('goals').update(payload).eq('id', editGoal.id)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not logged in.'); setSaving(false); return }
      const { error } = await supabase.from('goals').insert({ ...payload, user_id: user.id })
      if (error) { setError(error.message); setSaving(false); return }
    }
    setShowForm(false)
    setEditGoal(null)
    await loadGoals()
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal?')) return
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const field = (key: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900">Goals</h1>
          <p className="text-slate-400 text-sm mt-0.5">Plan your financial future. Track what you&apos;re investing toward.</p>
        </div>
        <button onClick={openCreate}
          className="px-3 md:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition">
          + New Goal
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading goals…</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 md:py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <div className="text-5xl mb-4">🎯</div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No goals yet</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
            Create your first goal — retirement, education, dream home, or anything you&apos;re saving for.
          </p>
          <button onClick={openCreate} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition">
            Create First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {goals.map(g => <GoalCard key={g.id} goal={g} onDelete={handleDelete} onEdit={openEdit} />)}
          <div onClick={openCreate}
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-400 transition min-h-[160px]">
            <span className="text-3xl mb-2">✨</span>
            <div className="font-bold text-slate-700 text-sm">Add another goal</div>
            <div className="text-xs text-slate-400 mt-1">Vacation, emergency fund, car…</div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-5 md:p-6 w-full md:max-w-lg shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-xl text-slate-900">{editGoal ? 'Edit Goal' : 'Create New Goal'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {GOAL_ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => setForm(p => ({ ...p, icon: ic }))}
                      className={['text-2xl p-1.5 rounded-lg border-2 transition', form.icon === ic ? 'border-indigo-500 bg-indigo-50' : 'border-transparent hover:border-slate-200'].join(' ')}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Goal Name *</label>
                <input value={form.name} onChange={field('name')} type="text" placeholder="e.g., Retirement, Child Education, Dream Home"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Corpus (₹) *</label>
                  <input value={form.target_corpus} onChange={field('target_corpus')} type="number" placeholder="5000000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Year *</label>
                  <input value={form.target_year} onChange={field('target_year')} type="number" min={new Date().getFullYear() + 1} max="2070"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Already Saved towards this goal (₹)</label>
                <input value={form.corpus_saved} onChange={field('corpus_saved')} type="number" placeholder="0 — enter what you&apos;ve already set aside"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monthly SIP (₹)</label>
                <input value={form.monthly_sip} onChange={field('monthly_sip')} type="number" placeholder="Optional — how much you invest monthly"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expected Return (%)</label>
                  <input value={form.expected_return} onChange={field('expected_return')} type="number" step="0.5"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Inflation Rate (%)</label>
                  <input value={form.inflation_rate} onChange={field('inflation_rate')} type="number" step="0.5"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">{error}</p>}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-500 disabled:opacity-60 transition">
                {saving ? 'Saving…' : editGoal ? 'Save Changes' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
