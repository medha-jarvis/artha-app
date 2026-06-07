import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { transactions, broker, filename } = body

  if (!transactions?.length) {
    return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
  }

  // Get existing transactions to dedup
  const { data: existing } = await supabase
    .from('stock_transactions')
    .select('symbol, trade_date, trade_type, quantity, price')
    .eq('user_id', user.id)

  const existingKeys = new Set(
    (existing || []).map((t: { symbol: string; trade_date: string; trade_type: string; quantity: number; price: number }) =>
      `${t.symbol}|${t.trade_date}|${t.trade_type}|${t.quantity}|${Math.round(t.price * 100)}`
    )
  )

  const unique = transactions.filter((t: { symbol: string; trade_date: string; trade_type: string; quantity: number; price: number }) => {
    const key = `${t.symbol}|${t.trade_date}|${t.trade_type}|${t.quantity}|${Math.round(t.price * 100)}`
    if (existingKeys.has(key)) return false
    existingKeys.add(key)
    return true
  })

  // Insert unique transactions
  if (unique.length > 0) {
    const rows = unique.map((t: { symbol: string; isin?: string; trade_date: string; trade_type: string; quantity: number; price: number; brokerage?: number; exchange?: string }) => ({
      user_id: user.id,
      symbol: t.symbol,
      isin: t.isin,
      trade_date: t.trade_date,
      trade_type: t.trade_type,
      quantity: t.quantity,
      price: t.price,
      brokerage: t.brokerage || 0,
      exchange: t.exchange || 'NSE',
      broker,
      source: broker || 'manual',
    }))

    const { error } = await supabase.from('stock_transactions').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log the import job
  await supabase.from('import_jobs').insert({
    user_id: user.id,
    broker,
    filename,
    total_rows: transactions.length,
    imported: unique.length,
    duplicates: transactions.length - unique.length,
    status: 'completed',
  })

  return NextResponse.json({
    imported: unique.length,
    duplicates: transactions.length - unique.length,
    total: transactions.length,
  })
}
