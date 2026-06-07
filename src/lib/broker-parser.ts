// Auto-detect and parse transaction files from 7 Indian brokers

export type BrokerName = 'zerodha' | 'groww' | 'upstox' | 'angel' | 'icici' | 'hdfc' | 'kotak' | 'unknown'

export interface ParsedTransaction {
  symbol: string
  isin?: string
  trade_date: string
  trade_type: 'buy' | 'sell'
  quantity: number
  price: number
  brokerage?: number
  exchange?: string
  broker: BrokerName
}

export interface ParseResult {
  broker: BrokerName
  transactions: ParsedTransaction[]
  errors: string[]
  totalRows: number
}

function normalizeDate(raw: string): string {
  // Handle DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
  raw = raw.trim()
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const ymd = raw.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
  if (ymd) return ymd[0]
  return raw
}

function detectBroker(headers: string[]): BrokerName {
  const h = headers.map(x => x.toLowerCase().trim()).join(' ')
  if (h.includes('tradingsymbol') || h.includes('instrument_type')) return 'zerodha'
  if (h.includes('scrip name') || h.includes('transaction charges')) return 'groww'
  if (h.includes('script name') && h.includes('exchange')) return 'upstox'
  if (h.includes('angel') || (h.includes('symbol') && h.includes('series'))) return 'angel'
  if (h.includes('action') && (h.includes('icici') || h.includes('rate'))) return 'icici'
  if (h.includes('script name') && h.includes('transaction date')) return 'hdfc'
  if (h.includes('kotak') || (h.includes('symbol') && h.includes('seg.'))) return 'kotak'
  return 'unknown'
}

function parseZerodha(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map(row => ({
    symbol: (row['tradingsymbol'] || row['symbol'] || row['instrument']).trim().toUpperCase(),
    isin: row['isin']?.trim(),
    trade_date: normalizeDate(row['trade_date'] || row['date']),
    trade_type: ((row['trade_type'] || row['buy_sell'] || '').toLowerCase().startsWith('b') ? 'buy' : 'sell') as 'buy' | 'sell',
    quantity: Math.abs(parseFloat(row['quantity'] || row['qty'] || '0')),
    price: parseFloat(row['price'] || row['average_price'] || row['trade_price'] || '0'),
    brokerage: parseFloat(row['brokerage'] || row['charges'] || '0') || 0,
    exchange: row['exchange']?.trim(),
    broker: 'zerodha' as BrokerName,
  })).filter(t => t.symbol && t.quantity > 0 && t.price > 0)
}

function parseGroww(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map(row => ({
    symbol: (row['scrip name'] || row['stock name'] || row['symbol'] || '').trim().toUpperCase(),
    trade_date: normalizeDate(row['date'] || row['trade date'] || ''),
    trade_type: ((row['transaction type'] || row['type'] || '').toLowerCase().includes('buy') ? 'buy' : 'sell') as 'buy' | 'sell',
    quantity: Math.abs(parseFloat(row['quantity'] || row['qty'] || '0')),
    price: parseFloat(row['price'] || row['trade price'] || '0'),
    brokerage: parseFloat(row['transaction charges'] || '0') || 0,
    broker: 'groww' as BrokerName,
  })).filter(t => t.symbol && t.quantity > 0 && t.price > 0)
}

function parseGeneric(rows: Record<string, string>[], broker: BrokerName): ParsedTransaction[] {
  return rows.map(row => {
    const keys = Object.keys(row).map(k => k.toLowerCase())
    const get = (candidates: string[]) => {
      for (const c of candidates) {
        const k = keys.find(k => k.includes(c))
        if (k) return row[Object.keys(row)[keys.indexOf(k)]] || ''
      }
      return ''
    }
    const symbol = get(['symbol', 'scrip', 'script', 'stock', 'instrument']).trim().toUpperCase()
    const dateRaw = get(['date', 'trade date', 'transaction date'])
    const typeRaw = get(['type', 'buy/sell', 'transaction type', 'action']).toLowerCase()
    const qty = Math.abs(parseFloat(get(['quantity', 'qty', 'no.']) || '0'))
    const price = parseFloat(get(['price', 'rate', 'trade price', 'average']) || '0')
    return {
      symbol,
      trade_date: normalizeDate(dateRaw),
      trade_type: ((typeRaw.includes('b') && !typeRaw.includes('sell')) ? 'buy' : 'sell') as 'buy' | 'sell',
      quantity: qty,
      price,
      broker,
    }
  }).filter(t => t.symbol && t.quantity > 0 && t.price > 0)
}

export function parseBrokerCSV(csvText: string): ParseResult {
  // Split into lines, handle CRLF
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  // Find header row (first non-empty line)
  let headerIdx = 0
  while (headerIdx < lines.length && !lines[headerIdx].trim()) headerIdx++

  if (headerIdx >= lines.length) {
    return { broker: 'unknown', transactions: [], errors: ['Empty file'], totalRows: 0 }
  }

  // Simple CSV parse (handles quoted fields)
  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes
      } else if (line[i] === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += line[i]
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseCSVLine(lines[headerIdx])
  const broker = detectBroker(headers)

  const rows: Record<string, string>[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h.toLowerCase().trim()] = values[idx] || ''
    })
    rows.push(row)
  }

  let transactions: ParsedTransaction[] = []
  if (broker === 'zerodha') transactions = parseZerodha(rows)
  else if (broker === 'groww') transactions = parseGroww(rows)
  else transactions = parseGeneric(rows, broker)

  return {
    broker,
    transactions,
    errors: [],
    totalRows: rows.length,
  }
}

// Deduplication: removes exact duplicates across multiple import sessions
export function deduplicateTransactions(
  incoming: ParsedTransaction[],
  existing: { symbol: string; trade_date: string; trade_type: string; quantity: number; price: number }[]
): { unique: ParsedTransaction[]; duplicates: ParsedTransaction[] } {
  const existingKeys = new Set(
    existing.map(t => `${t.symbol}|${t.trade_date}|${t.trade_type}|${t.quantity}|${Math.round(t.price * 100)}`)
  )

  const unique: ParsedTransaction[] = []
  const duplicates: ParsedTransaction[] = []

  for (const t of incoming) {
    const key = `${t.symbol}|${t.trade_date}|${t.trade_type}|${t.quantity}|${Math.round(t.price * 100)}`
    if (existingKeys.has(key)) {
      duplicates.push(t)
    } else {
      existingKeys.add(key) // prevent within-batch duplicates
      unique.push(t)
    }
  }

  return { unique, duplicates }
}
