import { NextRequest, NextResponse } from 'next/server'

// VPS yfinance microservice — port 8765
const VPS_STOCK_API = process.env.STOCK_API_URL ?? 'http://31.97.227.135:8765'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 })

  try {
    const res = await fetch(`${VPS_STOCK_API}/stock?symbol=${encodeURIComponent(symbol)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) throw new Error(`VPS API ${res.status}`)
    const data = await res.json()

    // Normalise field names to match what the frontend expects
    return NextResponse.json({
      symbol: data.symbol ?? symbol,
      name: data.name ?? symbol,
      price: data.price ?? 0,
      change: data.change ?? 0,
      change_abs: data.change_abs ?? 0,
      prev_close: data.prev_close ?? 0,
      open: data.open ?? 0,
      high: data.high ?? 0,
      low: data.low ?? 0,
      volume: data.volume ?? 0,
      market_cap: data.market_cap ?? 0,
      pe_trailing: data.pe_trailing ?? null,
      pe_forward: data.pe_forward ?? null,
      pb: data.pb ?? null,
      eps_ttm: data.eps_ttm ?? null,
      eps_forward: data.eps_forward ?? null,
      dividend_yield: data.dividend_yield ?? null,
      beta: data.beta ?? null,
      week_52_high: data.week_52_high ?? null,
      week_52_low: data.week_52_low ?? null,
      roe: data.roe ?? null,
      gross_margin: data.gross_margin ?? null,
      operating_margin: data.operating_margin ?? null,
      profit_margin: data.profit_margin ?? null,
      debt_to_equity: data.debt_to_equity ?? null,
      current_ratio: data.current_ratio ?? null,
      free_cash_flow: data.free_cash_flow ?? null,
    })
  } catch (err) {
    console.error('[stock-detail]', err)
    return NextResponse.json({ error: 'Data unavailable', symbol }, { status: 503 })
  }
}
