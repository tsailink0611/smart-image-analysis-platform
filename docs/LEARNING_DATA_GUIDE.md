# 📚 学習データ管理ガイド

## 学習データの修正方法

### 1. Supabaseダッシュボードでの修正

間違った学習データを修正する場合：

1. **Supabaseダッシュボードにアクセス**
   ```
   https://supabase.com/dashboard/project/lmyejjujmzorqmrwpljz
   ```

2. **Table Editorを開く**
   - 左メニューから「Table Editor」をクリック
   - `format_profiles`テーブルを選択

3. **データを修正**
   - 修正したい行を見つける
   - `column_mappings`フィールドをクリック
   - JSONデータを直接編集
   - 「Save」ボタンで保存

### 2. SQLを使った修正

SQL Editorで以下のコマンドを実行：

```sql
-- 特定のテナントの学習データを確認
SELECT * FROM format_profiles 
WHERE tenant_id = 'default';

-- 学習データを更新
UPDATE format_profiles 
SET column_mappings = '{"売上": "売上高", "日付": "取引日"}'::jsonb
WHERE tenant_id = 'default' 
AND format_signature = 'YOUR_SIGNATURE_HERE';

-- 不要な学習データを削除
DELETE FROM format_profiles 
WHERE id = 'YOUR_ID_HERE';
```

## 学習データの仕組み

### データ構造
- **tenant_id**: 会社・組織の識別子
- **format_signature**: ヘッダー列のハッシュ値（自動生成）
- **column_mappings**: カラム名と意味のマッピング（JSON形式）

### 自動認識の流れ
1. CSVアップロード時にヘッダーを読み取り
2. ヘッダーのハッシュ値（signature）を生成
3. データベースから同じsignatureのマッピングを検索
4. 見つかれば自動適用、なければ学習ダイアログを表示

## トラブルシューティング

### Q: 間違った学習データを保存してしまった
A: Supabaseダッシュボードから直接編集するか、SQLで更新してください。

### Q: 同じフォーマットなのに毎回学習を求められる
A: ヘッダーの順序や名前が完全に一致している必要があります。スペースや大文字小文字の違いも影響します。

### Q: 学習データをリセットしたい
A: SQL Editorで以下を実行：
```sql
TRUNCATE TABLE format_profiles;
```

## ベストプラクティス

1. **一貫性のあるファイル形式を使用**
   - ヘッダー名を統一
   - 列の順序を固定
   - 不要な空白を避ける

2. **テナントIDの活用**
   - 複数の会社・部門で使用する場合は異なるtenant_idを設定
   - デフォルトは'default'

3. **定期的なバックアップ**
   - 重要な学習データは定期的にエクスポート
   - SQL Editorで`SELECT * FROM format_profiles`を実行してCSVダウンロード