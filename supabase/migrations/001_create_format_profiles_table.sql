-- format_profiles テーブルの作成
-- カラムマッピング学習データを保存するテーブル

CREATE TABLE IF NOT EXISTS format_profiles (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  format_signature TEXT NOT NULL,
  column_mappings JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- format_signatureはテナントごとにユニーク
  CONSTRAINT unique_tenant_format UNIQUE (tenant_id, format_signature)
);

-- インデックスの作成（検索パフォーマンス向上）
CREATE INDEX idx_format_profiles_tenant_id ON format_profiles(tenant_id);
CREATE INDEX idx_format_profiles_format_signature ON format_profiles(format_signature);
CREATE INDEX idx_format_profiles_created_at ON format_profiles(created_at DESC);

-- Row Level Security (RLS) ポリシー
-- 注: 実際の本番環境では認証に基づくRLSポリシーを実装してください
ALTER TABLE format_profiles ENABLE ROW LEVEL SECURITY;

-- 一時的にすべてのユーザーにアクセスを許可（開発用）
CREATE POLICY "Enable all operations for all users" ON format_profiles
  FOR ALL USING (true) WITH CHECK (true);

-- 更新時刻の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_format_profiles_updated_at
  BEFORE UPDATE ON format_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- コメント追加
COMMENT ON TABLE format_profiles IS 'カラムマッピング学習データの保存テーブル';
COMMENT ON COLUMN format_profiles.tenant_id IS 'テナント識別子（会社ID等）';
COMMENT ON COLUMN format_profiles.format_signature IS 'ヘッダー列のハッシュ値（Base64）';
COMMENT ON COLUMN format_profiles.column_mappings IS 'カラム名と意味のマッピング（JSON）';
COMMENT ON COLUMN format_profiles.created_at IS '作成日時';
COMMENT ON COLUMN format_profiles.updated_at IS '更新日時';