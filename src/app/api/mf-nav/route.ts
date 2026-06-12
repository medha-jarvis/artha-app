import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface MfTx {
  holding_id: string
  tx_type: string
  units: number
  amfi_code: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all MF transactions for user
  const { data: txs } = await supabase
    .from('mf_transactions')
    .select('holding_id, tx_type, units, amfi_code')
    .eq('user_id', user.id)

  if (!txs?.length) return NextResponse.json({})

  // Compute net units per holding
  const holdingMap: Record<string, { units: number; amfi_code: string }> = {}
  for (const tx of txs as MfTx[]) {
    if (!tx.holding_id || !tx.units) continue
    if (!holdingMap[tx.holding_id]) {
      holdingMap[tx.holding_id] = { units: 0, amfi_code: tx.amfi_code || '' }
    }
    const isPurchase = ['purchase', 'sip', 'switch_in', 'dividend_reinvest'].includes(tx.tx_type)
    const isRedemption = ['redemption', 'switch_out'].includes(tx.tx_type)
    if (isPurchase) holdingMap[tx.holding_id].units += tx.units
    else if (isRedemption) holdingMap[tx.holding_id].units -= tx.units
    if (tx.amfi_code) holdingMap[tx.holding_id].amfi_code = tx.amfi_code
  }

  // Fetch NAV for each unique AMFI code
  const uniqueCodes = [...new Set(Object.values(holdingMap).map(h => h.amfi_code).filter(Boolean))]
  const navMap: Record<string, number> = {}

  await Promise.all(
    uniqueCodes.map(async (code) => {
      try {
        const res = await fetch(`https://api.mfapi.in/mf/${code}`, {
          next: { revalidate: 3600 }, // 1-hour edge cache
        })
        if (!res.ok) return
        const json = await res.json()
        const latestNav = json.data?.[0]?.nav
        if (latestNav) navMap[code] = parseFloat(latestNav)
      } catch {
        // ignore individual fund failures
      }
    })
  )

  // Build result: holding_id → { units, nav, current_value }
  const result: Record<string, { units: number; nav: number; current_value: number }> = {}
  for (const [holdingId, info] of Object.entries(holdingMap)) {
    const nav = navMap[info.amfi_code]
    if (!nav) continue
    const units = Math.max(0, info.units)
    result[holdingId] = { units, nav, current_value: units * nav }
  }

  return NextResponse.json(result)
}
