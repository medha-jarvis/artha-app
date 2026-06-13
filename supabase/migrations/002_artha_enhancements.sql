-- Net worth history table
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  snapshot_date date NOT NULL,
  net_worth numeric(15,2) NOT NULL,
  invested numeric(15,2),
  breakdown jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own snapshots" ON net_worth_snapshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Goal projections: track already-saved corpus per goal
ALTER TABLE goals ADD COLUMN IF NOT EXISTS corpus_saved numeric(15,2) DEFAULT 0;
