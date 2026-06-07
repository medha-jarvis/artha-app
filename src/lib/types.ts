export type AssetClass = 'stocks' | 'mf' | 'epf' | 'ppf' | 'ssy' | 'nps' | 'ulip' | 'pms' | 'fd' | 'bank'

export interface AssetClassMeta {
  code: AssetClass
  name: string
  icon: string
  color: string
  description: string
}

export const ASSET_CLASSES: AssetClassMeta[] = [
  { code: 'stocks', name: 'Stocks', icon: '📈', color: '#4f46e5', description: 'Direct equity holdings (NSE/BSE)' },
  { code: 'mf', name: 'Mutual Funds', icon: '🏦', color: '#059669', description: 'Direct & regular MF folios' },
  { code: 'epf', name: 'EPF', icon: '🏢', color: '#0891b2', description: 'Employee Provident Fund' },
  { code: 'ppf', name: 'PPF', icon: '🏛️', color: '#7c3aed', description: 'Public Provident Fund' },
  { code: 'ssy', name: 'SSY', icon: '👧', color: '#db2777', description: "Sukanya Samriddhi Yojana" },
  { code: 'nps', name: 'NPS', icon: '🎯', color: '#d97706', description: 'National Pension System' },
  { code: 'ulip', name: 'ULIP', icon: '🛡️', color: '#dc2626', description: 'Unit Linked Insurance Plan' },
  { code: 'pms', name: 'PMS', icon: '💼', color: '#1d4ed8', description: 'Portfolio Management Service' },
  { code: 'fd', name: 'Fixed Deposits', icon: '🏦', color: '#b45309', description: 'Bank & NBFC Fixed Deposits' },
  { code: 'bank', name: 'Bank Accounts', icon: '🏧', color: '#374151', description: 'Savings & current accounts' },
]

export interface Holding {
  id: string
  user_id: string
  asset_class: AssetClass
  name: string
  current_value: number
  total_invested: number
  xirr?: number
  returns_1d?: number
  returns_1w?: number
  returns_1m?: number
  returns_1y?: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface StockTransaction {
  id: string
  holding_id: string
  symbol: string
  isin?: string
  trade_date: string
  trade_type: 'buy' | 'sell'
  quantity: number
  price: number
  brokerage: number
  broker?: string
}

export interface PortfolioSummary {
  total_value: number
  total_invested: number
  total_gain: number
  total_gain_pct: number
  xirr: number | null
  day_gain: number
  day_gain_pct: number
  by_asset_class: Record<AssetClass, { value: number; invested: number; xirr: number | null }>
}
