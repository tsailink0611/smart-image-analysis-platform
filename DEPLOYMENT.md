# 📚 デプロイメントガイド - Strategic AI Platform

## 🚀 クイックスタート

### 1. Supabaseセットアップ

#### 1.1 テーブル作成
1. [Supabase Dashboard](https://app.supabase.com)にログイン
2. SQL Editorを開く
3. `/supabase/migrations/001_create_tables.sql`の内容を実行
4. 実行成功を確認

#### 1.2 環境変数の取得
- **Project URL**: Settings > API > Project URL
- **Service Role Key**: Settings > API > Service role (secret)

### 2. AWS Lambda デプロイ

#### 2.1 Lambda関数の作成/更新

**メイン分析関数（sap-claude-handler-v2）**
```bash
# 関数作成（初回のみ）
aws lambda create-function \
  --function-name sap-claude-handler-v2 \
  --runtime python3.12 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler sap-claude-handler-v2.lambda_handler \
  --timeout 60 \
  --memory-size 1024

# コードのアップロード
cd lambda
zip -r function.zip sap-claude-handler-v2.py requirements.txt
aws lambda update-function-code \
  --function-name sap-claude-handler-v2 \
  --zip-file fileb://function.zip
```

**フォーマット学習関数（format-learning-handler）**
```bash
# 関数作成（初回のみ）
aws lambda create-function \
  --function-name format-learning-handler \
  --runtime python3.12 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler format-learning-handler.lambda_handler \
  --timeout 30 \
  --memory-size 512

# コードのアップロード
zip -r format-function.zip format-learning-handler.py requirements.txt
aws lambda update-function-code \
  --function-name format-learning-handler \
  --zip-file fileb://format-function.zip
```

#### 2.2 環境変数の設定
```bash
# メイン関数用
aws lambda update-function-configuration \
  --function-name sap-claude-handler-v2 \
  --environment Variables='{
    "SUPABASE_URL":"https://fggpltpqtkebkwkqyzkh.supabase.co",
    "SUPABASE_SERVICE_KEY":"your-service-key"
  }'

# フォーマット学習関数用
aws lambda update-function-configuration \
  --function-name format-learning-handler \
  --environment Variables='{
    "SUPABASE_URL":"https://fggpltpqtkebkwkqyzkh.supabase.co",
    "SUPABASE_SERVICE_KEY":"your-service-key"
  }'
```

### 3. API Gateway 設定

#### 3.1 新エンドポイントの追加
1. API Gatewayコンソールを開く
2. 既存のAPIを選択
3. 新しいリソースを作成:
   - `/format-learning` - フォーマット学習用
   - `/usage` - 使用量取得用

#### 3.2 Lambda統合の設定
各エンドポイントに対して:
1. POSTメソッドを作成
2. Lambda関数と統合
3. CORSを有効化

### 4. フロントエンド更新

#### 4.1 環境変数の確認
`.env`ファイル:
```env
VITE_API_ENDPOINT=https://ylgrnwffx6.execute-api.us-east-1.amazonaws.com
```

#### 4.2 ビルドとデプロイ
```bash
npm run build
# Vercelへの自動デプロイまたは手動アップロード
```

## 🧪 動作確認

### テスト手順

1. **基本動作テスト**
   ```bash
   # ヘルスチェック
   curl -X POST https://your-api.execute-api.us-east-1.amazonaws.com/ \
     -H "Content-Type: application/json" \
     -d '{"prompt":"テスト"}'
   ```

2. **ファイルアップロードテスト**
   - CSVファイルをアップロード
   - 分析結果がJSON形式で返ることを確認

3. **フォーマット学習テスト**
   - カラムマッピングを設定
   - 保存ボタンをクリック
   - 同じフォーマットで再度アップロードして自動認識を確認

4. **使用量確認**
   - 複数回分析を実行
   - 使用量が記録されることを確認

## 📊 モニタリング

### CloudWatch ログ
- Lambda関数のログを確認
- エラー率をモニタリング
- 実行時間の確認

### Supabase Dashboard
- テーブルのデータ確認
- 使用量の集計確認
- フォーマットプロファイルの確認

## 🔧 トラブルシューティング

### よくある問題と解決方法

**問題**: CORS エラー
```
解決: API GatewayでCORS設定を確認
- Access-Control-Allow-Origin: *
- Access-Control-Allow-Headers: Content-Type
```

**問題**: Supabase接続エラー
```
解決: 環境変数を確認
- SUPABASE_URLが正しいか
- SERVICE_KEYが有効か
```

**問題**: JSON解析エラー
```
解決: Lambda関数のログを確認
- 入力データの形式を確認
- フォールバック処理が動作しているか確認
```

## 📝 チェックリスト

- [ ] Supabaseテーブル作成完了
- [ ] Lambda関数デプロイ完了
- [ ] 環境変数設定完了
- [ ] API Gateway設定完了
- [ ] フロントエンドデプロイ完了
- [ ] 基本動作テスト合格
- [ ] フォーマット学習テスト合格
- [ ] 使用量記録テスト合格

## 🚨 本番環境への移行時の注意

1. **環境変数の管理**
   - AWS Systems Managerパラメータストアを使用
   - 機密情報はコードに含めない

2. **使用量制限**
   - 月次制限を設定
   - アラートを設定

3. **バックアップ**
   - Supabaseの定期バックアップを設定
   - フォーマットプロファイルのエクスポート

---

**最終更新**: 2025-08-23
**バージョン**: 1.0.0