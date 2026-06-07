// CAMS & KFintech CAS (Consolidated Account Statement) parser
// Supports: CAMS email statement (PDF text), KFintech statement
// Input: plain text extracted from PDF (use pdf-parse on server side)

export interface MFTransaction {
  folio: string
  scheme_name: string
  amfi_code?: string
  isin?: string
  tx_date: string
  tx_type: 'purchase' | 'redemption' | 'sip' | 'switch_in' | 'switch_out' | 'dividend' | 'other'
  units: number
  nav: number
  amount: number
  registrar: 'cams' | 'kfintech' | 'unknown'
}

export interface CASParseResult {
  investor_name?: string
  pan?: string
  email?: string
  period_from?: string
  period_to?: string
  transactions: MFTransaction[]
  errors: string[]
  registrar: 'cams' | 'kfintech' | 'unknown'
}

function normalizeTxType(raw: string): MFTransaction['tx_type'] {
  const r = raw.toLowerCase().trim()
  if (r.includes('sip') || r.includes('systematic')) return 'sip'
  if (r.includes('switch') && r.includes('in')) return 'switch_in'
  if (r.includes('switch') && r.includes('out')) return 'switch_out'
  if (r.includes('redemp') || r.includes('withdraw')) return 'redemption'
  if (r.includes('purchas') || r.includes('buy') || r.includes('lumpsum')) return 'purchase'
  if (r.includes('dividend') || r.includes('idcw')) return 'dividend'
  return 'other'
}

function normalizeDate(raw: string): string {
  // Handle DD-Mon-YYYY (01-Jan-2024) and DD/MM/YYYY
  const monMap: Record<string, string> = {
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'
  }
  const dmy = raw.trim().match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${monMap[m.toLowerCase()] || '01'}-${d.padStart(2,'0')}`
  }
  const numeric = raw.trim().match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
  if (numeric) {
    const [, d, m, y] = numeric
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return raw.trim()
}

// Detect registrar from text content
function detectRegistrar(text: string): 'cams' | 'kfintech' | 'unknown' {
  const t = text.toLowerCase()
  if (t.includes('cams') || t.includes('computer age management') || t.includes('camsonline')) return 'cams'
  if (t.includes('kfintech') || t.includes('karvy') || t.includes('k-fin')) return 'kfintech'
  return 'unknown'
}

// Parse CAMS CAS text format
function parseCAMS(lines: string[]): MFTransaction[] {
  const transactions: MFTransaction[] = []
  let currentFolio = ''
  let currentScheme = ''
  let currentIsin = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Folio line: "Folio No: 1234567890 / 1"
    const folioMatch = line.match(/folio\s*(?:no\.?|number)?:?\s*([A-Z0-9\/\-]+)/i)
    if (folioMatch) {
      currentFolio = folioMatch[1].trim()
      continue
    }

    // Scheme line: usually has ISIN
    const isinMatch = line.match(/ISIN[:\s]+([A-Z]{2}[A-Z0-9]{10})/i)
    if (isinMatch) {
      currentIsin = isinMatch[1]
    }

    // Scheme name line (line with fund name, no date at start)
    if (line.length > 10 && !line.match(/^\d{2}[-\/]/) && line.match(/fund|growth|direct|regular|liquid|flexi|small|mid|large|equity|debt|hybrid|index/i)) {
      currentScheme = line.split('(')[0].trim()
    }

    // Transaction line: starts with date DD-Mon-YYYY or DD/MM/YYYY
    const txMatch = line.match(/^(\d{1,2}[-\/][A-Za-z0-9]{2,3}[-\/]\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\-\d,]+\.?\d*)/)
    if (txMatch) {
      const [, dateRaw, txTypeRaw, unitsRaw, navRaw, amtRaw] = txMatch
      const units = parseFloat(unitsRaw.replace(/,/g, ''))
      const nav = parseFloat(navRaw.replace(/,/g, ''))
      const amount = parseFloat(amtRaw.replace(/,/g, ''))

      if (!isNaN(units) && !isNaN(nav) && !isNaN(amount)) {
        transactions.push({
          folio: currentFolio,
          scheme_name: currentScheme,
          isin: currentIsin || undefined,
          tx_date: normalizeDate(dateRaw),
          tx_type: normalizeTxType(txTypeRaw),
          units: Math.abs(units),
          nav,
          amount: Math.abs(amount),
          registrar: 'cams',
        })
      }
      continue
    }

    // Simpler transaction line: date + description + amount
    const simpleTx = line.match(/^(\d{1,2}[-\/][A-Za-z0-9]{2,3}[-\/]\d{4})\s+(.+?)\s+([\d,]+\.?\d+)\s+([\d,]+\.?\d+)/)
    if (simpleTx && currentFolio) {
      const [, dateRaw, txTypeRaw, navRaw, amtRaw] = simpleTx
      const nav = parseFloat(navRaw.replace(/,/g, ''))
      const amount = parseFloat(amtRaw.replace(/,/g, ''))
      if (!isNaN(nav) && !isNaN(amount) && amount > 0) {
        transactions.push({
          folio: currentFolio,
          scheme_name: currentScheme,
          isin: currentIsin || undefined,
          tx_date: normalizeDate(dateRaw),
          tx_type: normalizeTxType(txTypeRaw),
          units: amount / nav,
          nav,
          amount,
          registrar: 'cams',
        })
      }
    }
  }

  return transactions
}

// Parse KFintech CAS text format
function parseKFintech(lines: string[]): MFTransaction[] {
  const transactions: MFTransaction[] = []
  let currentFolio = ''
  let currentScheme = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    const folioMatch = line.match(/folio[:\s]+([A-Z0-9\/\-]+)/i)
    if (folioMatch) {
      currentFolio = folioMatch[1].trim()
    }

    if (line.match(/\b(fund|growth|idcw|dividend|direct|regular)\b/i) && line.length > 15 && !line.match(/^\d/)) {
      currentScheme = line.trim()
    }

    // KFintech tx line: Date | Description | Amount | Units | NAV | Balance
    const txMatch = line.match(/^(\d{2}[-\/]\d{2}[-\/]\d{4})\s+\|?\s*(.+?)\s+\|?\s*([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/)
    if (txMatch) {
      const [, dateRaw, txTypeRaw, amtRaw, unitsRaw, navRaw] = txMatch
      const amount = parseFloat(amtRaw.replace(/,/g, ''))
      const units = parseFloat(unitsRaw.replace(/,/g, ''))
      const nav = parseFloat(navRaw.replace(/,/g, ''))

      if (!isNaN(amount) && !isNaN(units) && units > 0) {
        transactions.push({
          folio: currentFolio,
          scheme_name: currentScheme,
          tx_date: normalizeDate(dateRaw),
          tx_type: normalizeTxType(txTypeRaw),
          units,
          nav: isNaN(nav) ? amount / units : nav,
          amount,
          registrar: 'kfintech',
        })
      }
    }
  }

  return transactions
}

// CSV format (CAMS sometimes provides CSV download)
export function parseCAMScsv(csvText: string): CASParseResult {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: MFTransaction[] = []
  const errors: string[] = []

  // Find header row
  const headerIdx = lines.findIndex(l =>
    l.toLowerCase().includes('date') && l.toLowerCase().includes('amount')
  )

  if (headerIdx < 0) {
    return { transactions: [], errors: ['Could not find header row in CAMS CSV'], registrar: 'cams' }
  }

  const headers = lines[headerIdx].split(',').map(h => h.toLowerCase().trim().replace(/"/g, ''))

  const get = (row: string[], candidates: string[]) => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c))
      if (idx >= 0) return (row[idx] || '').replace(/"/g, '').trim()
    }
    return ''
  }

  let currentFolio = ''
  let currentScheme = ''

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]

    // Folio/scheme info rows
    const folioM = line.match(/folio[:\s]+([A-Z0-9\/\-]+)/i)
    if (folioM) { currentFolio = folioM[1]; continue }

    const row = line.split(',').map(c => c.replace(/"/g, '').trim())
    if (row.length < 4) continue

    const dateRaw = get(row, ['date', 'transaction date', 'trade date'])
    const txTypeRaw = get(row, ['transaction type', 'type', 'description', 'narration'])
    const amtRaw = get(row, ['amount', 'transaction amount'])
    const unitsRaw = get(row, ['units', 'quantity'])
    const navRaw = get(row, ['nav', 'price'])
    const scheme = get(row, ['scheme', 'fund', 'scheme name'])
    const folio = get(row, ['folio', 'folio no'])

    if (folio) currentFolio = folio
    if (scheme) currentScheme = scheme

    const amount = parseFloat(amtRaw.replace(/,/g, ''))
    const units = parseFloat(unitsRaw.replace(/,/g, ''))
    const nav = parseFloat(navRaw.replace(/,/g, ''))

    if (!dateRaw || isNaN(amount)) continue

    transactions.push({
      folio: currentFolio,
      scheme_name: currentScheme || scheme,
      tx_date: normalizeDate(dateRaw),
      tx_type: normalizeTxType(txTypeRaw),
      units: isNaN(units) ? Math.abs(amount / (isNaN(nav) ? 1 : nav)) : Math.abs(units),
      nav: isNaN(nav) ? 0 : nav,
      amount: Math.abs(amount),
      registrar: 'cams',
    })
  }

  return { transactions, errors, registrar: 'cams' }
}

// Main entry: parse text extracted from CAMS/KFintech PDF
export function parseCASText(text: string): CASParseResult {
  const registrar = detectRegistrar(text)
  const lines = text.split('\n')
  const errors: string[] = []

  // Extract metadata
  const panMatch = text.match(/PAN[:\s]+([A-Z]{5}\d{4}[A-Z])/i)
  const nameMatch = text.match(/investor\s*name[:\s]+([A-Za-z\s]+)/i)
  const periodMatch = text.match(/(\d{2}[-\/]\w{3}[-\/]\d{4})\s+to\s+(\d{2}[-\/]\w{3}[-\/]\d{4})/i)

  let transactions: MFTransaction[] = []
  if (registrar === 'kfintech') {
    transactions = parseKFintech(lines)
  } else {
    transactions = parseCAMS(lines)
  }

  if (transactions.length === 0) {
    errors.push('No transactions found. Ensure the PDF text was extracted correctly.')
  }

  return {
    investor_name: nameMatch?.[1]?.trim(),
    pan: panMatch?.[1],
    period_from: periodMatch ? normalizeDate(periodMatch[1]) : undefined,
    period_to: periodMatch ? normalizeDate(periodMatch[2]) : undefined,
    transactions,
    errors,
    registrar,
  }
}

// Dedup MF transactions against existing records
export function dedupMFTransactions(
  incoming: MFTransaction[],
  existing: { folio: string; tx_date: string; tx_type: string; amount: number }[]
): { unique: MFTransaction[]; duplicates: MFTransaction[] } {
  const existingKeys = new Set(
    existing.map(t => `${t.folio}|${t.tx_date}|${t.tx_type}|${Math.round(t.amount)}`)
  )
  const unique: MFTransaction[] = []
  const duplicates: MFTransaction[] = []

  for (const t of incoming) {
    const key = `${t.folio}|${t.tx_date}|${t.tx_type}|${Math.round(t.amount)}`
    if (existingKeys.has(key)) {
      duplicates.push(t)
    } else {
      existingKeys.add(key)
      unique.push(t)
    }
  }
  return { unique, duplicates }
}
