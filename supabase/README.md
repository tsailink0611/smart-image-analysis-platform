# Supabaseデータベース設定

## テーブル作成手順

### 1. Supabaseダッシュボードにログイン
プロジェクト: `https://supabase.com/dashboard/project/lmyejjujmzorqmrwpljz`

### 2. SQL Editorでテーブル作成

以下の手順でテーブルを作成してください：

1. Supabaseダッシュボードの左メニューから「SQL Editor」を選択
2. 「New query」をクリック
3. `migrations/001_create_format_profiles_table.sql`の内容をコピー＆ペースト
4. 「Run」ボタンをクリックして実行

### 3. テーブル作成の確認

実行後、以下を確認してください：
- 「Table Editor」で`format_profiles`テーブルが表示される
- テーブル構造が正しく作成されている

## テーブル構造

### format_profiles テーブル
カラムマッピング学習データを保存するテーブル

| カラム名 | データ型 | 説明 |
|---------|---------|------|
| id | SERIAL | プライマリキー |
| tenant_id | TEXT | テナントID（会社識別子） |
| format_signature | TEXT | ヘッダー列のハッシュ値 |
| column_mappings | JSONB | カラムマッピング情報 |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

## トラブルシューティング

### エラー: "column format_profiles in the schema cache"
このエラーが表示される場合は、テーブルがまだ作成されていません。
上記の手順に従ってテーブルを作成してください。

### エラー: "permission denied"
Row Level Security (RLS) の設定に問題がある可能性があります。
SQLエディターで以下を実行してください：

```sql
-- RLSを一時的に無効化（開発用）
ALTER TABLE format_profiles DISABLE ROW LEVEL SECURITY;
```

### テーブルの削除と再作成
問題が解決しない場合は、テーブルを削除して再作成できます：

```sql
-- テーブルの削除
DROP TABLE IF EXISTS format_profiles CASCADE;

-- その後、001_create_format_profiles_table.sqlを再実行
```