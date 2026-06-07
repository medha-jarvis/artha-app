-- =============================================
-- ARTHA — Initial Database Schema
-- =============================================

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID REFERENCES auth.users PRIMARY KEY,
  display_name  TEXT,
  pan_hash      TEXT,              -- SHA-256 hash, NEVER plaintext
  tax_bracket   INT DEFAULT 30,    -- 20 or 30
  risk_profile  TEXT CHECK (risk_profile IN ('conservative','moderate','aggressive')) DEFAULT 'moderate',
  subscription  TEXT DEFAULT 'free' CHECK (subscription IN ('free','pro','elite')),
  sub_expires   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Asset class reference
CREATE TABLE IF NOT EXISTS asset_classes (
  id    SERIAL PRIMARY KEY,
  code  TEXT UNIQUE NOT NULL,
  name  TEXT NOT NULL,
  icon  TEXT,
  color TEXT,
  sort_order INT
);

INSERT INTO asset_classes (code, name, icon, color, sort_order) VALUES
  ('stocks','Stocks','📈','#4f46e5',1),
  ('mf','Mutual Funds','🏦','#059669',2),
  ('epf','EPF','🏢','#0891b2',3),
  ('ppf','PPF','🏛️','#7c3aed',4),
  ('ssy','SSY','👧','#db2777',5),
  ('nps','NPS','🎯','#d97706',6),
  ('ulip','ULIP','🛡️','#dc2626',7),
  ('pms','PMS','💼','#1d4ed8',8),
  ('fd','Fixed Deposits','💰','#b45309',9),
  ('bank','Bank Accounts','🏧','#374151',10)
ON CONFLICT (code) DO NOTHING;

-- Holdings (top-level for each instrument held)
CREATE TABLE IF NOT EXISTS holdings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users NOT NULL,
  asset_class      TEXT REFERENCES asset_classes(code) NOT NULL,
  name             TEXT NOT NULL,
  account_number   TEXT,
  current_value    DECIMAL(15,2),
  total_invested   DECIMAL(15,2),
  units            DECIMAL(15,6),      -- for MF/NPS/ULIP
  current_nav      DECIMAL(15,4),      -- for MF/NPS/ULIP
  is_active        BOOLEAN DEFAULT TRUE,
  last_refreshed   TIMESTAMPTZ,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Stock transactions (granular buy/sell records)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  holding_id  UUID REFERENCES holdings(id),
  symbol      TEXT NOT NULL,
  isin        TEXT,
  trade_date  DATE NOT NULL,
  trade_type  TEXT CHECK (trade_type IN ('buy','sell')) NOT NULL,
  quantity    DECIMAL(12,3) NOT NULL,
  price       DECIMAL(12,4) NOT NULL,
  brokerage   DECIMAL(10,2) DEFAULT 0,
  exchange    TEXT DEFAULT 'NSE',
  broker      TEXT,
  source      TEXT DEFAULT 'manual',  -- 'manual', 'zerodha', 'groww', etc.
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicates on import
CREATE UNIQUE INDEX IF NOT EXISTS stock_tx_dedup
  ON stock_transactions(user_id, symbol, trade_date, trade_type, quantity, ROUND(price::NUMERIC, 2));

-- MF transactions
CREATE TABLE IF NOT EXISTS mf_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  holding_id  UUID REFERENCES holdings(id),
  amfi_code   TEXT NOT NULL,
  folio       TEXT,
  tx_date     DATE NOT NULL,
  tx_type     TEXT CHECK (tx_type IN ('purchase','redemption','sip','switch_in','switch_out')),
  units       DECIMAL(12,4),
  nav         DECIMAL(10,4),
  amount      DECIMAL(12,2),
  source      TEXT DEFAULT 'manual',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- MF NAV daily (cached from AMFI)
CREATE TABLE IF NOT EXISTS mf_nav_daily (
  amfi_code   TEXT NOT NULL,
  nav_date    DATE NOT NULL,
  nav         DECIMAL(12,4) NOT NULL,
  scheme_name TEXT,
  PRIMARY KEY (amfi_code, nav_date)
);

-- Stock prices cache
CREATE TABLE IF NOT EXISTS stock_price_cache (
  symbol      TEXT PRIMARY KEY,
  price       DECIMAL(12,4) NOT NULL,
  change_pct  DECIMAL(8,4),
  change_abs  DECIMAL(10,4),
  market_cap  BIGINT,
  fetched_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Benchmark data (Nifty50 TRI, Nifty500 TRI etc.)
CREATE TABLE IF NOT EXISTS benchmark_data (
  benchmark   TEXT NOT NULL,
  date        DATE NOT NULL,
  value       DECIMAL(14,4) NOT NULL,
  PRIMARY KEY (benchmark, date)
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users NOT NULL,
  name             TEXT NOT NULL,
  icon             TEXT DEFAULT '🎯',
  target_corpus    DECIMAL(15,2) NOT NULL,
  target_year      INT NOT NULL,
  inflation_rate   DECIMAL(5,2) DEFAULT 6.0,
  expected_return  DECIMAL(5,2) DEFAULT 12.0,
  monthly_sip      DECIMAL(12,2),
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Goal to holding mapping
CREATE TABLE IF NOT EXISTS goal_holdings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID REFERENCES goals(id) ON DELETE CASCADE,
  holding_id  UUID REFERENCES holdings(id) ON DELETE CASCADE,
  allocation_pct DECIMAL(5,2) DEFAULT 100,  -- % of holding allocated to this goal
  UNIQUE(goal_id, holding_id)
);

-- AI insights
CREATE TABLE IF NOT EXISTS ai_insights (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  week_start  DATE NOT NULL,
  content     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Research reports
CREATE TABLE IF NOT EXISTS research_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  stock       TEXT NOT NULL,
  report_type TEXT NOT NULL,
  price_paid  DECIMAL(8,2),
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed')),
  pdf_url     TEXT,
  ordered_at  TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- Import jobs
CREATE TABLE IF NOT EXISTS import_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  broker      TEXT,
  filename    TEXT,
  total_rows  INT,
  imported    INT,
  duplicates  INT,
  errors      INT DEFAULT 0,
  status      TEXT DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (user data isolation)
-- =============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mf_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "user_own_profile" ON user_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "user_own_holdings" ON holdings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_stock_tx" ON stock_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_mf_tx" ON mf_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_goals" ON goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_insights" ON ai_insights FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_reports" ON research_reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_imports" ON import_jobs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_goal_holdings" ON goal_holdings FOR ALL
  USING (goal_id IN (SELECT id FROM goals WHERE user_id = auth.uid()));

-- Public read for reference tables
CREATE POLICY "public_asset_classes" ON asset_classes FOR SELECT USING (true);
CREATE POLICY "public_nav" ON mf_nav_daily FOR SELECT USING (true);
CREATE POLICY "public_prices" ON stock_price_cache FOR SELECT USING (true);
CREATE POLICY "public_benchmarks" ON benchmark_data FOR SELECT USING (true);

-- =============================================
-- AUTO-UPDATE updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_holdings_updated BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
