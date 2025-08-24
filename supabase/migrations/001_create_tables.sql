-- =====================================================
-- Supabase Migration: SAP Format Learning & AI Usage
-- Version: 1.0.0
-- Date: 2025-08-23
-- =====================================================

-- 1. フォーマットプロファイルテーブル
CREATE TABLE IF NOT EXISTS format_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    format_signature VARCHAR(64) NOT NULL,
    headers JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 複合ユニーク制約（同一テナント内で同じフォーマットは1つ）
    UNIQUE(tenant_id, format_signature)
);

-- インデックス作成
CREATE INDEX idx_format_profiles_tenant ON format_profiles(tenant_id);
CREATE INDEX idx_format_profiles_signature ON format_profiles(format_signature);

-- 2. カラムマッピングテーブル
CREATE TABLE IF NOT EXISTS column_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES format_profiles(id) ON DELETE CASCADE,
    source_header VARCHAR(255) NOT NULL,
    target_field VARCHAR(255) NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 同一プロファイル内で同じソースヘッダーは1つ
    UNIQUE(profile_id, source_header)
);

-- インデックス作成
CREATE INDEX idx_column_mappings_profile ON column_mappings(profile_id);

-- 3. プロファイルメタデータテーブル
CREATE TABLE IF NOT EXISTS profile_meta (
    profile_id UUID PRIMARY KEY REFERENCES format_profiles(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usage_count INTEGER DEFAULT 0,
    column_count INTEGER DEFAULT 0,
    
    -- 統計情報
    success_rate DECIMAL(5,2),
    avg_processing_time_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_profile_meta_tenant ON profile_meta(tenant_id);
CREATE INDEX idx_profile_meta_last_used ON profile_meta(last_used DESC);

-- 4. AI使用量テーブル
CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    tokens_in INTEGER NOT NULL,
    tokens_out INTEGER NOT NULL,
    cost DECIMAL(10,6) NOT NULL,
    request_id VARCHAR(255),
    model_id VARCHAR(100) DEFAULT 'claude-3-sonnet',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- パフォーマンス情報
    duration_ms INTEGER,
    error_code VARCHAR(50),
    error_message TEXT
);

-- インデックス作成
CREATE INDEX idx_ai_usage_tenant ON ai_usage(tenant_id);
CREATE INDEX idx_ai_usage_created ON ai_usage(created_at DESC);
CREATE INDEX idx_ai_usage_tenant_month ON ai_usage(tenant_id, date_trunc('month', created_at));

-- 月次集計用のマテリアライズドビュー（オプション）
CREATE MATERIALIZED VIEW IF NOT EXISTS ai_usage_monthly AS
SELECT 
    tenant_id,
    date_trunc('month', created_at) as month,
    COUNT(*) as request_count,
    SUM(tokens_in) as total_tokens_in,
    SUM(tokens_out) as total_tokens_out,
    SUM(cost) as total_cost,
    AVG(duration_ms) as avg_duration_ms
FROM ai_usage
GROUP BY tenant_id, date_trunc('month', created_at);

-- マテリアライズドビューのインデックス
CREATE UNIQUE INDEX idx_ai_usage_monthly_tenant_month 
ON ai_usage_monthly(tenant_id, month);

-- 5. 監査ログテーブル（将来の拡張用）
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100),
    entity_id VARCHAR(255),
    payload JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_audit_events_tenant ON audit_events(tenant_id);
CREATE INDEX idx_audit_events_created ON audit_events(created_at DESC);
CREATE INDEX idx_audit_events_entity ON audit_events(entity, entity_id);

-- =====================================================
-- Helper Functions
-- =====================================================

-- 使用回数をインクリメントする関数
CREATE OR REPLACE FUNCTION increment_usage_count(pid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE profile_meta 
    SET usage_count = usage_count + 1,
        last_used = NOW()
    WHERE profile_id = pid
    RETURNING usage_count INTO new_count;
    
    IF new_count IS NULL THEN
        INSERT INTO profile_meta (profile_id, tenant_id, usage_count)
        SELECT pid, tenant_id, 1 
        FROM format_profiles 
        WHERE id = pid
        RETURNING usage_count INTO new_count;
    END IF;
    
    RETURN COALESCE(new_count, 1);
END;
$$;

-- 月次使用量を取得する関数
CREATE OR REPLACE FUNCTION get_monthly_usage(
    p_tenant_id VARCHAR(255),
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
    p_month INTEGER DEFAULT EXTRACT(MONTH FROM NOW())
)
RETURNS TABLE (
    total_requests INTEGER,
    total_tokens_in BIGINT,
    total_tokens_out BIGINT,
    total_cost DECIMAL(10,2),
    avg_duration_ms INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_requests,
        COALESCE(SUM(tokens_in), 0)::BIGINT as total_tokens_in,
        COALESCE(SUM(tokens_out), 0)::BIGINT as total_tokens_out,
        COALESCE(SUM(cost), 0)::DECIMAL(10,2) as total_cost,
        AVG(duration_ms)::INTEGER as avg_duration_ms
    FROM ai_usage
    WHERE tenant_id = p_tenant_id
        AND EXTRACT(YEAR FROM created_at) = p_year
        AND EXTRACT(MONTH FROM created_at) = p_month;
END;
$$;

-- =====================================================
-- Row Level Security (RLS) - 基本設定
-- =====================================================

-- RLSを有効化
ALTER TABLE format_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Service Roleは全アクセス可能（Lambda関数用）
CREATE POLICY "Service role has full access to format_profiles" 
ON format_profiles FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role has full access to column_mappings" 
ON column_mappings FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role has full access to profile_meta" 
ON profile_meta FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_usage" 
ON ai_usage FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role has full access to audit_events" 
ON audit_events FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- =====================================================
-- Initial Data (Optional)
-- =====================================================

-- デフォルトのカノニカルマッピング辞書
CREATE TABLE IF NOT EXISTS canonical_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    canonical_name VARCHAR(100) NOT NULL UNIQUE,
    patterns TEXT[] NOT NULL,
    description TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 初期データ投入
INSERT INTO canonical_mappings (canonical_name, patterns, category, description) VALUES
('売上', ARRAY['売上', '売り上げ', '金額', 'sales', 'amount', '売上金額', '売上高', 'revenue'], 'financial', '売上関連の列'),
('日付', ARRAY['日付', '日', 'date', '年月日', '受注日', '販売日', '取引日'], 'temporal', '日付関連の列'),
('商品', ARRAY['商品', '商品名', 'product', 'item', '品名', 'アイテム', '製品'], 'product', '商品関連の列'),
('数量', ARRAY['数量', '個数', 'quantity', 'qty', '販売数', '出荷数'], 'quantity', '数量関連の列'),
('顧客', ARRAY['顧客', '顧客名', 'customer', 'client', '取引先', '得意先'], 'customer', '顧客関連の列'),
('単価', ARRAY['単価', '価格', 'price', 'unit_price', '販売単価'], 'financial', '単価関連の列'),
('原価', ARRAY['原価', 'cost', '仕入値', '仕入価格', '製造原価'], 'financial', '原価関連の列'),
('利益', ARRAY['利益', '粗利', 'profit', 'margin', '利益率', '粗利益'], 'financial', '利益関連の列'),
('地域', ARRAY['地域', 'region', 'area', 'エリア', '地区', '支店'], 'geographic', '地域関連の列'),
('カテゴリ', ARRAY['カテゴリ', 'category', '分類', '種別', 'タイプ', 'type'], 'classification', 'カテゴリ関連の列')
ON CONFLICT (canonical_name) DO NOTHING;

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- 追加のパフォーマンス最適化インデックス
CREATE INDEX IF NOT EXISTS idx_ai_usage_request_id ON ai_usage(request_id);
CREATE INDEX IF NOT EXISTS idx_format_profiles_updated ON format_profiles(updated_at DESC);

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE format_profiles IS 'データフォーマットのプロファイル情報を保存';
COMMENT ON TABLE column_mappings IS 'カラムの意味的マッピング情報を保存';
COMMENT ON TABLE profile_meta IS 'プロファイルの使用統計情報';
COMMENT ON TABLE ai_usage IS 'AI API使用量の記録';
COMMENT ON TABLE audit_events IS '監査ログ（将来の拡張用）';
COMMENT ON TABLE canonical_mappings IS 'カノニカル（標準）カラム名の辞書';

-- Migration complete message
DO $$
BEGIN
    RAISE NOTICE 'Migration 001_create_tables.sql completed successfully';
END $$;