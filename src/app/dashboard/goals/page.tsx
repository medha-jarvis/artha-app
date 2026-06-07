'use client'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

const GOALS_DEMO = [
  {
    id: '1', name: 'Retirement', icon: '🏖️', targetCorpus: 30000000, currentCorpus: 8432750,
    targetYear: 2040, inflationRate: 6, expectedReturn: 12, monthlySIP: 80000,
    taggedHoldings: ['EPF', 'NPS', 'KECL', 'PPFCAS'],
  },
  {
    id: '2', name: "Aarav's Education", icon: '🎓', targetCorpus: 5000000, currentCorpus: 680000,
    targetYear: 2034, inflationRate: 8, expectedReturn: 14, monthlySIP: 25000,
    taggedHoldings: ['SSY', 'Parag Parikh FC'],
  },
  {
    id: '3', name: 'Dream Home', icon: '🏡', targetCorpus: 8000000, currentCorpus: 1200000,
    targetYear: 2028, inflationRate: 5, expectedReturn: 10, monthlySIP: 60000,
    taggedHoldings: ['FD - HDFC', 'FD - SBI'],
  },
]

function GoalCard({ goal }: { goal: typeof GOALS_DEMO[0] }) {
  const progress = (goal.currentCorpus / goal.targetCorpus) * 100
  const gap = goal.targetCorpus - goal.currentCorpus
  const yearsLeft = goal.targetYear - 2026
  const onTrack = progress > (100 - yearsLeft * 6) // Simple heuristic
  const statusColor = progress >= 100 ? 'text-emerald-600' : onTrack ? 'text-amber-600' : 'text-red-500'
  const statusLabel = progress >= 100 ? 'Fully Funded' : onTrack ? 'On Track' : 'Needs Attention'
  const progressBarColor = progress >= 100 ? 'bg-emerald-500' : onTrack ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{goal.icon}</span>
          <div>
            <h3 className="font-black text-slate-900">{goal.name}</h3>
            <div className="text-xs text-slate-400 mt-0.5">Target: {goal.targetYear} · {yearsLeft} years left</div>
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full
          ${onTrack ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Current corpus</span>
          <span className="font-bold text-slate-900">{formatCurrency(goal.currentCorpus, true)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Target corpus</span>
          <span className="font-bold text-slate-900">{formatCurrency(goal.targetCorpus, true)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Gap</span>
          <span className="font-bold text-red-600">{formatCurrency(gap, true)}</span>
        </div>

        <div className="mt-2">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progress</span><span>{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${progressBarColor}`}
              style={{ width: `${Math.min(progress, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-lg p-3 mt-2">
          <div className="text-xs font-bold text-indigo-700 mb-1">AI Recommendation</div>
          <div className="text-xs text-indigo-600">
            Increase SIP by <strong>₹{Math.round(goal.monthlySIP * 0.2 / 1000) * 1000 / 1000}K/mo</strong> to
            comfortably reach ₹{formatCurrency(goal.targetCorpus, true)} by {goal.targetYear} at {goal.expectedReturn}% returns.
          </div>
        </div>

        <div className="mt-2">
          <div className="text-xs text-slate-400 mb-1.5">Tagged investments</div>
          <div className="flex flex-wrap gap-1.5">
            {goal.taggedHoldings.map(h => (
              <span key={h} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{h}</span>
            ))}
            <button className="text-xs text-indigo-600 px-2 py-0.5 border border-indigo-200 rounded-full hover:bg-indigo-50 transition">
              + Tag more
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const [showNew, setShowNew] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Goals</h1>
          <p className="text-slate-400 text-sm mt-0.5">Plan your financial future. Tag investments to each goal.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition">
          + New Goal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {GOALS_DEMO.map(g => <GoalCard key={g.id} goal={g} />)}

        {/* Empty state card */}
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-400 transition"
          onClick={() => setShowNew(true)}>
          <span className="text-4xl mb-3">✨</span>
          <div className="font-bold text-slate-700">Add another goal</div>
          <div className="text-xs text-slate-400 mt-1">Vacation, emergency fund, car…</div>
        </div>
      </div>

      {/* New goal modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="font-black text-xl text-slate-900 mb-4">Create New Goal</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Goal Name</label>
                <input type="text" placeholder="e.g., Retirement, Child Education"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Corpus (₹)</label>
                  <input type="number" placeholder="e.g., 5000000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Year</label>
                  <input type="number" placeholder="e.g., 2040"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expected Return (%)</label>
                  <input type="number" defaultValue={12}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Inflation Rate (%)</label>
                  <input type="number" defaultValue={6}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNew(false)}
                className="flex-1 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={() => setShowNew(false)}
                className="flex-1 bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-500 transition">
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
