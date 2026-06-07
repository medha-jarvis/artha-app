import { NextRequest, NextResponse } from 'next/server'
import { computeXIRR } from '@/lib/xirr'

export async function POST(req: NextRequest) {
  const { cashflows } = await req.json()

  if (!cashflows?.length) {
    return NextResponse.json({ error: 'No cashflows provided' }, { status: 400 })
  }

  const parsed = cashflows.map((cf: { date: string; amount: number }) => ({
    date: new Date(cf.date),
    amount: cf.amount,
  }))

  const xirr = computeXIRR(parsed)
  return NextResponse.json({ xirr, xirr_pct: xirr !== null ? xirr * 100 : null })
}
