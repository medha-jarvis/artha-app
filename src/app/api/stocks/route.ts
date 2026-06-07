import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const symbols = req.nextUrl.searchParams.get('symbols')?.split(',') || []

  if (!symbols.length) {
    return NextResponse.json({ error: 'No symbols provided' }, { status: 400 })
  }

  // Check cache first (15-min TTL)
  const { data: cached } = await supabase
    .from('stock_price_cache')
    .select('*')
    .in('symbol', symbols)
    .gte('fetched_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())

  const cachedSymbols = new Set((cached || []).map((c: { symbol: string }) => c.symbol))
  const missing = symbols.filter(s => !cachedSymbols.has(s))

  let fresh: Record<string, { price: number; change_pct: number; change_abs: number }> = {}

  if (missing.length > 0) {
    // In production: call yfinance Python function or NSE API
    // For demo, return mock data
    fresh = Object.fromEntries(
      missing.map(s => [s, {
        price: Math.round(1000 + Math.random() * 3000),
        change_pct: (Math.random() - 0.4) * 4,
        change_abs: Math.round((Math.random() - 0.4) * 80),
      }])
    )

    // Upsert to cache
    const rows = missing.map(s => ({
      symbol: s,
      price: fresh[s].price,
      change_pct: fresh[s].change_pct,
      change_abs: fresh[s].change_abs,
    }))
    await supabase.from('stock_price_cache').upsert(rows)
  }

  const result: Record<string, unknown> = {}
  ;(cached || []).forEach((c: { symbol: string; price: number; change_pct: number; change_abs: number }) => { result[c.symbol] = c })
  Object.entries(fresh).forEach(([s, v]) => { result[s] = v })

  return NextResponse.json(result)
}
