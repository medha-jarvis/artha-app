import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { symbols }: { symbols: string[] } = await req.json()
  if (!symbols?.length) return NextResponse.json({})

  const yahooSymbols = symbols.map(s => `${s}.NS`).join(',')

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbols)}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketPreviousClose`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        next: { revalidate: 900 }, // 15-min edge cache
      }
    )

    if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`)
    const data = await res.json()

    const result: Record<string, { price: number; change: number; prev_close: number }> = {}
    for (const q of (data.quoteResponse?.result || [])) {
      const sym = q.symbol.replace('.NS', '').replace('.BO', '')
      result[sym] = {
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChangePercent ?? 0,
        prev_close: q.regularMarketPreviousClose ?? 0,
      }
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[live-prices]', err)
    return NextResponse.json({}, { status: 200 }) // graceful: portfolio falls back to cost basis
  }
}
