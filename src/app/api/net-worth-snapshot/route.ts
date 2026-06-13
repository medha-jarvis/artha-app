import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase.from('net_worth_snapshots').upsert({
    user_id: user.id,
    snapshot_date: today,
    net_worth: Math.round(body.net_worth),
    invested: Math.round(body.invested || 0),
    breakdown: body.breakdown || {},
  }, { onConflict: 'user_id,snapshot_date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
