- 念のために2年前に作成したSQLのコードを確認してください。このコードを貼った状態で一度失敗をしているはずなので、あなたが新しく作成したものにした方がいいような気もするんですが、どちらを選択した方がいいでしょうか。　#　-- Strategic AI Platform: Human-in-the-Loop フォーマット学習機能
  -- データベーステーブル作成スクリプト

  -- 1. format_profiles テーブル: 会社ごと、フォーマットごとのプロファイル管理
  CREATE TABLE format_profiles (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL,                -- 会社・テナントID
      format_signature VARCHAR(500) NOT NULL,         -- フォーマットの特徴を表すハッシュ
      profile_name VARCHAR(200) NOT NULL,             -- プロファイル名（例：「月次売上レポート」）
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      -- ユニーク制約: 同じテナントで同じフォーマットは1つのプロファイルのみ
      UNIQUE(tenant_id, format_signature)
  );

  -- 2. column_mappings テーブル: 列名の翻訳ルール学習
  CREATE TABLE column_mappings (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      profile_id UUID REFERENCES format_profiles(id) ON DELETE CASCADE,
      source_header VARCHAR(200) NOT NULL,            -- 元の列名（例：「売り上げ」）
      target_field VARCHAR(100) NOT NULL,             -- 標準化後の列名（例：「sales」）
      last_corrected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      -- ユニーク制約: 1つのプロファイル内で同じ元列名は1つのマッピングのみ
      UNIQUE(profile_id, source_header)
  );

  -- 3. profile_meta テーブル: フォーマットのメタ情報
  CREATE TABLE profile_meta (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      profile_id UUID REFERENCES format_profiles(id) ON DELETE CASCADE,
      currency_unit VARCHAR(10) DEFAULT 'JPY',        -- 通貨単位
      currency_scale INTEGER DEFAULT 1,               -- 通貨スケール（例：1000で千円単位）
      header_row_index INTEGER DEFAULT 0,             -- ヘッダー行のインデックス
      data_start_row_index INTEGER DEFAULT 1,         -- データ開始行のインデックス
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- インデックス作成（パフォーマンス向上のため）
  CREATE INDEX idx_format_profiles_tenant ON format_profiles(tenant_id);
  CREATE INDEX idx_column_mappings_profile ON column_mappings(profile_id);
  CREATE INDEX idx_profile_meta_profile ON profile_meta(profile_id);

  -- Row Level Security (RLS) の有効化
  ALTER TABLE format_profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE column_mappings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE profile_meta ENABLE ROW LEVEL SECURITY;

  -- 基本的なRLSポリシー（後で詳細設定）
  CREATE POLICY "Enable read for authenticated users" ON format_profiles FOR SELECT USING (auth.role() =
  'authenticated');
  CREATE POLICY "Enable read for authenticated users" ON column_mappings FOR SELECT USING (auth.role() =
  'authenticated');
  CREATE POLICY "Enable read for authenticated users" ON profile_meta FOR SELECT USING (auth.role() =
  'authenticated');

  -- 成功メッセージ
  SELECT 'Human-in-the-Loop フォーマット学習テーブルが正常に作成されました！' AS message;