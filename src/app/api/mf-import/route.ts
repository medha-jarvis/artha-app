import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MFTransaction } from '@/lib/cams-parser'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { transactions, registrar, filename }: {
    transactions: MFTransaction[]
    registrar: string
    filename: string
  } = body

  if (!transactions?.length) {
    return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
  }

  // Get existing MF transactions for dedup
  const { data: existing } = await supabase
    .from('mf_transactions')
    .select('folio, tx_date, tx_type, amount')
    .eq('user_id', user.id)

  const existingKeys = new Set(
    (existing || []).map((t: { folio: string; tx_date: string; tx_type: string; amount: number }) =>
      `${t.folio}|${t.tx_date}|${t.tx_type}|${Math.round(t.amount)}`
    )
  )

  const unique = transactions.filter(t => {
    const key = `${t.folio}|${t.tx_date}|${t.tx_type}|${Math.round(t.amount)}`
    if (existingKeys.has(key)) return false
    existingKeys.add(key)
    return true
  })

  if (unique.length > 0) {
    // Upsert holdings for each unique scheme
    const schemes = [...new Map(unique.map(t => [t.folio + t.scheme_name, t])).values()]

    for (const scheme of schemes) {
      // Check if holding exists
      const { data: existing_holding } = await supabase
        .from('holdings')
        .select('id')
        .eq('user_id', user.id)
        .eq('asset_class', 'mf')
        .ilike('name', `%${scheme.scheme_name.substring(0, 30)}%`)
        .maybeSingle()

      let holdingId = existing_holding?.id

      if (!holdingId) {
        const schemeTxs = unique.filter(t => t.folio === scheme.folio && t.scheme_name === scheme.scheme_name)
        const totalInvested = schemeTxs
          .filter(t => t.tx_type === 'purchase' || t.tx_type === 'sip')
          .reduce((s, t) => s + t.amount, 0)

        const { data: newHolding } = await supabase
          .from('holdings')
          .insert({
            user_id: user.id,
            asset_class: 'mf',
            name: scheme.scheme_name,
            account_number: scheme.folio,
            total_invested: totalInvested,
            current_value: totalInvested, // placeholder until NAV refresh
            metadata: { isin: scheme.isin, registrar }
          })
          .select('id')
          .single()

        holdingId = newHolding?.id
      }

      // Insert transactions
      const rows = unique
        .filter(t => t.folio === scheme.folio && t.scheme_name === scheme.scheme_name)
        .map(t => ({
          user_id: user.id,
          holding_id: holdingId,
          amfi_code: t.amfi_code || '',
          folio: t.folio,
          tx_date: t.tx_date,
          tx_type: t.tx_type,
          units: t.units,
          nav: t.nav,
          amount: t.amount,
          source: registrar,
        }))

      if (rows.length > 0) {
        await supabase.from('mf_transactions').insert(rows)
      }
    }
  }

  // Log import job
  await supabase.from('import_jobs').insert({
    user_id: user.id,
    broker: registrar,
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
    schemes: [...new Set(unique.map(t => t.scheme_name))].length,
  })
}
