import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { asset_class, name, current_value, total_invested, account_number, metadata } = body

  if (!asset_class || !name || current_value == null) {
    return NextResponse.json({ error: 'asset_class, name, and current_value are required' }, { status: 400 })
  }

  // Upsert by name + asset_class + user to avoid duplicates from re-saving
  const { data: existing } = await supabase
    .from('holdings')
    .select('id')
    .eq('user_id', user.id)
    .eq('asset_class', asset_class)
    .eq('name', name)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('holdings')
      .update({ current_value, total_invested, account_number, metadata, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: existing.id, updated: true })
  }

  const { data, error } = await supabase
    .from('holdings')
    .insert({ user_id: user.id, asset_class, name, current_value, total_invested, account_number, metadata, is_active: true })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, created: true })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('asset_class')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ holdings: data })
}
