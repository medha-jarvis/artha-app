import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 })

  const nseSym = `${symbol}.NS`
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  }

  try {
    const [quoteRes, summaryRes] = await Promise.all([
      fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${nseSym}`,
        { headers, next: { revalidate: 300 } }
      ),
      fetch(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${nseSym}?modules=summaryDetail,financialData,defaultKeyStatistics,price`,
        { headers, next: { revalidate: 900 } }
      ),
    ])

    let quoteData: Record<string, unknown> = {}
    let summaryData: Record<string, unknown> = {}
    try { quoteData = await quoteRes.json() } catch { /* fallback */ }
    try { summaryData = await summaryRes.json() } catch { /* fallback */ }

    const quote = (quoteData as { quoteResponse?: { result?: Record<string, unknown>[] } })?.quoteResponse?.result?.[0] ?? {}
    const resultArr = (summaryData as { quoteSummary?: { result?: Record<string, unknown>[] } })?.quoteSummary?.result
    const result = resultArr?.[0] ?? {}
    const sd = (result as { summaryDetail?: Record<string, { raw?: number }> })?.summaryDetail ?? {}
    const fd = (result as { financialData?: Record<string, { raw?: number }> })?.financialData ?? {}
    const ks = (result as { defaultKeyStatistics?: Record<string, { raw?: number }> })?.defaultKeyStatistics ?? {}
    const priceModule = (result as { price?: Record<string, unknown> })?.price ?? {}

    const n = (obj: Record<string, { raw?: number }>, key: string): number | null => obj[key]?.raw ?? null
    const q = (key: string) => (quote as Record<string, unknown>)[key] as number | null ?? null

    return NextResponse.json({
      symbol,
      name: q('longName') || q('shortName') || (priceModule as Record<string, unknown>).longName || symbol,
      price: q('regularMarketPrice') ?? 0,
      change: q('regularMarketChangePercent') ?? 0,
      change_abs: q('regularMarketChange') ?? 0,
      prev_close: q('regularMarketPreviousClose') ?? 0,
      open: q('regularMarketOpen') ?? 0,
      high: q('regularMarketDayHigh') ?? 0,
      low: q('regularMarketDayLow') ?? 0,
      volume: q('regularMarketVolume') ?? 0,
      market_cap: (priceModule as { marketCap?: { raw?: number } })?.marketCap?.raw ?? q('marketCap') ?? 0,
      pe_trailing: n(ks, 'trailingPE') ?? n(sd, 'trailingPE'),
      pe_forward: n(sd, 'forwardPE'),
      pb: n(ks, 'priceToBook'),
      eps_ttm: n(ks, 'trailingEps'),
      eps_forward: n(ks, 'forwardEps'),
      dividend_yield: n(sd, 'dividendYield'),
      beta: n(sd, 'beta') ?? n(ks, 'beta'),
      week_52_high: n(sd, 'fiftyTwoWeekHigh') ?? q('fiftyTwoWeekHigh'),
      week_52_low: n(sd, 'fiftyTwoWeekLow') ?? q('fiftyTwoWeekLow'),
      roe: n(fd, 'returnOnEquity'),
      revenue: n(fd, 'totalRevenue'),
      gross_margin: n(fd, 'grossMargins'),
      operating_margin: n(fd, 'operatingMargins'),
      profit_margin: n(fd, 'profitMargins'),
      debt_to_equity: n(fd, 'debtToEquity'),
      current_ratio: n(fd, 'currentRatio'),
      free_cash_flow: n(fd, 'freeCashflow'),
    })
  } catch (err) {
    console.error('[stock-detail]', err)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
