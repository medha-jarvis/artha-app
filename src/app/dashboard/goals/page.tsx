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
  created_at: string
}

const GOAL_ICONS = ['🎯', '🏖️', '🎓', '🏡', '🚗', '✈️', '💍', '👶', '🏋️', '💰', '🌍', '🎵', '🏥', '🎮', '📚']

const EMPTY_FORM = {
  name: '',
  icon: '🎯',
  target_corpus: '',
  target_year: String(new Date().getFullYear() + 10),
  inflation_rate: '6',
  expected_return: '12',
  monthly_sip: '',
}

function calcRequiredSIP(corpus: number, rateAnnual: number, years: number): number {
  if (years <= 0) return corpus
  const r = rateAnnual / 100 / 12
  const n = years * 12
  if (r === 0) return corpus / n
  return corpus * r / (Math.pow(1 + r, n) - 1)
}

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: (id: string) => void }) {
  const yearsLeft = goal.target_year - new Date().getFullYear()
  const reqSIP = calcRequiredSIP(goal.target_corpus, goal.expected_return, yearsLeft)

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
        <button
          onClick={() => onDelete(goal.id)}
          className="text-slate-200 hover:text-red-400 transition text-xl leading-none px-1"
        >
          ×
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Target corpus</span>
          <span className="font-bold text-slate-900">{formatCurrency(goal.target_corpus, true)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Expected return</span>
          <span className="font-medium text-slate-700">{goal.expected_return}% p.a.</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Inflation assumed</span>
          <span className="font-medium text-slate-700">{goal.inflation_rate}% p.a.</span>
        </div>
        {goal.monthly_sip != null && goal.monthly_sip > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Current SIP</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(goal.monthly_sip, true)}/mo</span>
          </div>
        )}
      </div>

      {yearsLeft > 0 && (
        <div className="bg-indigo-50 rounded-lg p-3 mt-3">
          <div className="text-xs font-bold text-indigo-700 mb-0.5">Required SIP (at {goal.expected_return}% returns)</div>
          <div className="text-sm font-black text-indigo-800">{formatCurrency(reqSIP, true)}/month</div>
          {goal.monthly_sip && goal.monthly_sip > 0 && (
            <div className={`text-xs mt-0.5 font-medium ${goal.monthly_sip >= reqSIP ? 'text-emerald-600' : 'text-amber-600'}`}>
              {goal.monthly_sip >= reqSIP
                ? `✓ You're contributing ${formatCurrency(goal.monthly_sip - reqSIP, true)} extra`
                : `⚠ Increase SIP by ${formatCurrency(reqSIP - goal.monthly_sip, true)}/mo`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const supabase = createClient()

  const loadGoals = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setGoals(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadGoals() }, [loadGoals])

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Goal name is required.'); return }
    if (!form.target_corpus || Number(form.target_corpus) <= 0) { setError('Target corpus must be greater than 0.'); return }
    if (!form.target_year || Number(form.target_year) <= new Date().getFullYear()) {
      setError('Target year must be in the future.'); return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in. Please refresh and try again.'); setSaving(false); return }
    const { error } = await supabase.from('goals').insert({
      user_id: user.id,
      name: form.name.trim(),
      icon: form.icon,
      target_corpus: Number(form.target_corpus),
      target_year: Number(form.target_year),
      inflation_rate: Number(form.inflation_rate) || 6,
      expected_return: Number(form.expected_return) || 12,
      monthly_sip: form.monthly_sip ? Number(form.monthly_sip) : null,
    })
    if (error) {
      setError(error.message)
    } else {
      setForm(EMPTY_FORM)
      setShowNew(false)
      await loadGoals()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal?')) return
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const field = (key: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900">Goals</h1>
          <p className="text-slate-400 text-sm mt-0.5">Plan your financial future. Track what you&apos;re investing toward.</p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError(null); setForm(EMPTY_FORM) }}
          className="px-3 md:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition"
        >
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
          <button
            onClick={() => setShowNew(true)}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition"
          >
            Create First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {goals.map(g => <GoalCard key={g.id} goal={g} onDelete={handleDelete} />)}
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-400 transition min-h-[160px]"
            onClick={() => setShowNew(true)}
          >
            <span className="text-3xl mb-2">✨</span>
            <div className="font-bold text-slate-700 text-sm">Add another goal</div>
            <div className="text-xs text-slate-400 mt-1">Vacation, emergency fund, car…</div>
          </div>
        </div>
      )}

      {/* New goal modal — slides up from bottom on mobile */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-5 md:p-6 w-full md:max-w-lg shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-xl text-slate-900">Create New Goal</h2>
              <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              {/* Icon picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {GOAL_ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, icon: ic }))}
                      className={[
                        'text-2xl p-1.5 rounded-lg border-2 transition',
                        form.icon === ic ? 'border-indigo-500 bg-indigo-50' : 'border-transparent hover:border-slate-200',
                      ].join(' ')}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Goal Name *</label>
                <input
                  value={form.name}
                  onChange={field('name')}
                  type="text"
                  placeholder="e.g., Retirement, Child Education, Dream Home"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Corpus (₹) *</label>
                  <input
                    value={form.target_corpus}
                    onChange={field('target_corpus')}
                    type="number"
                    placeholder="5000000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Year *</label>
                  <input
                    value={form.target_year}
                    onChange={field('target_year')}
                    type="number"
                    min={new Date().getFullYear() + 1}
                    max="2070"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expected Return (%)</label>
                  <input
                    value={form.expected_return}
                    onChange={field('expected_return')}
                    type="number"
                    step="0.5"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Inflation Rate (%)</label>
                  <input
                    value={form.inflation_rate}
                    onChange={field('inflation_rate')}
                    type="number"
                    step="0.5"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monthly SIP towards this goal (₹)</label>
                <input
                  value={form.monthly_sip}
                  onChange={field('monthly_sip')}
                  type="number"
                  placeholder="Optional — how much you're investing monthly"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">{error}</p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowNew(false); setError(null) }}
                className="flex-1 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-500 disabled:opacity-60 transition"
              >
                {saving ? 'Saving…' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
