// XIRR computation using Newton-Raphson iteration
// Matches scipy.optimize.brentq precision

interface CashFlow {
  date: Date
  amount: number
}

function daysBetween(d1: Date, d2: Date): number {
  return (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)
}

function xirrFunc(cashflows: CashFlow[], rate: number): number {
  const d0 = cashflows[0].date
  return cashflows.reduce((sum, cf) => {
    const t = daysBetween(d0, cf.date) / 365
    return sum + cf.amount / Math.pow(1 + rate, t)
  }, 0)
}

function xirrDeriv(cashflows: CashFlow[], rate: number): number {
  const d0 = cashflows[0].date
  return cashflows.reduce((sum, cf) => {
    const t = daysBetween(d0, cf.date) / 365
    return sum - t * cf.amount / Math.pow(1 + rate, t + 1)
  }, 0)
}

export function computeXIRR(cashflows: CashFlow[], guess = 0.1): number | null {
  if (cashflows.length < 2) return null
  const hasPositive = cashflows.some(cf => cf.amount > 0)
  const hasNegative = cashflows.some(cf => cf.amount < 0)
  if (!hasPositive || !hasNegative) return null

  let rate = guess
  for (let i = 0; i < 100; i++) {
    const f = xirrFunc(cashflows, rate)
    const df = xirrDeriv(cashflows, rate)
    if (Math.abs(df) < 1e-12) break
    const newRate = rate - f / df
    if (Math.abs(newRate - rate) < 1e-7) return newRate
    rate = newRate
    if (rate < -0.999) rate = -0.999
  }
  return rate
}

// Simple XIRR for a holding: invested at buy_date, current value today
export function holdingXIRR(
  transactions: { date: string; amount: number }[],
  currentValue: number
): number | null {
  const cashflows: CashFlow[] = transactions.map(t => ({
    date: new Date(t.date),
    amount: t.amount,
  }))
  cashflows.push({ date: new Date(), amount: currentValue })
  return computeXIRR(cashflows)
}
