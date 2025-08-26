# 🚀 BFF (Backend for Frontend) セットアップガイド

## 概要
本プロジェクトはCORS問題を根本的に解決するため、BFF方式を採用しています。

**アーキテクチャ:**
```
ブラウザ → Vercel BFF (/api/analysis) → Lambda Function URL → AWS Bedrock
        （同一オリジン）             （サーバー間通信）
```

## 📋 セットアップ手順

### 1. Lambda Function URL の作成

AWS Lambdaコンソールで Function URL を作成:
```
1. AWS Lambda コンソールにログイン
2. 関数一覧から「sap-claude-handler」を選択
3. 「設定」タブ → 「関数URL」セクション
4. 「関数URLを作成」をクリック
5. 以下の設定で作成:
   - 認証タイプ: NONE（まずは疎通優先）
   - CORS設定: 有効化
   - 許可オリジン: * （または特定のVercelドメイン）
6. 作成されたURLをコピー（例: https://xxxxx.lambda-url.us-east-1.on.aws/）
```

### 2. Vercel環境変数の設定

Vercelダッシュボードで環境変数を追加:
```
1. Vercelダッシュボードにログイン
2. プロジェクトを選択
3. Settings → Environment Variables
4. 「Add New」をクリック
5. 以下を入力:
   - Name: LAMBDA_URL
   - Value: [コピーしたLambda Function URL]
   - Environment: ✅ Production ✅ Preview ✅ Development
6. 「Save」をクリック
```

### 3. デプロイ

環境変数を反映させるため再デプロイ:
```bash
# Option 1: Git push でトリガー
git add .
git commit -m "feat: Add BFF architecture to solve CORS issues"
git push origin main

# Option 2: Vercel CLI
vercel --prod
```

## 🧪 動作確認

### PowerShellでのテスト

#### ローカル環境
```powershell
# BFFエンドポイントのテスト
$body = @{
    prompt = "売上を分析して"
    salesData = @(
        @{
            "日付" = "2024-01-01"
            "売上金額" = 10000
            "商品名" = "テスト商品"
        }
    )
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:5173/api/analysis" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

#### 本番環境
```powershell
# Vercelデプロイ済みのURLでテスト
$prodUrl = "https://sap-project-frontend.vercel.app/api/analysis"

Invoke-RestMethod -Uri $prodUrl `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### ブラウザでの確認ポイント

1. **アプリケーションで確認**:
   - 売上データファイルをアップロード
   - 「AIに質問する」ボタンをクリック
   - 正常にレスポンスが返ること

2. **DevToolsで確認**:
   - F12でDevToolsを開く
   - Networkタブで以下を確認:
     - リクエストURL: `/api/analysis`
     - ステータス: 200 OK
     - CORSエラーが出ていないこと

## 🚨 トラブルシューティング

### よくあるエラーと対処法

| エラーコード | 原因 | 対処法 |
|-------------|------|--------|
| `CONFIG_ERROR` | LAMBDA_URL環境変数が未設定 | Vercelで環境変数を設定し再デプロイ |
| `UPSTREAM_TIMEOUT` | Lambda処理が60秒超過 | Lambda関数のタイムアウト設定を確認 |
| `PAYLOAD_TOO_LARGE` | リクエストが6MB超過 | データを分割して送信 |
| `INVALID_PROMPT` | promptフィールドが不足 | リクエストボディにpromptを追加 |
| `MISSING_DATA` | salesData/csvDataが不足 | いずれかのデータフィールドを追加 |

### ログの確認方法

#### Vercel Function ログ
```
1. Vercelダッシュボード → Functions タブ
2. api/analysis をクリック
3. Logsセクションでリアルタイムログを確認
```

#### Lambda関数ログ（CloudWatch）
```
1. AWS CloudWatch → ロググループ
2. /aws/lambda/sap-claude-handler を選択
3. 最新のログストリームを確認
```

## 🔄 ロールバック手順

### 緊急ロールバック（5分以内）

フロントエンドのAPI呼び出し先を元に戻す:

1. `src/App.tsx` を編集:
```typescript
// 変更前（BFF使用）
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || "/api/analysis";

// 変更後（直接API Gateway呼び出し）
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || 
    "https://ylgrnwffx6.execute-api.us-east-1.amazonaws.com/prod";
```

2. コミット&デプロイ:
```bash
git add src/App.tsx
git commit -m "revert: Rollback to direct API Gateway connection"
git push origin main
```

### 完全ロールバック（BFF完全削除）

1. **ファイル削除**:
```bash
rm api/analysis.ts
rm BFF-SETUP.md  # このファイル
```

2. **vercel.json修正** - functionsセクションを削除:
```json
{
  "version": 2,
  "builds": [...],
  "routes": [...],
  // "functions": { ... } ← この部分を削除
  "env": { ... }
}
```

3. **環境変数削除**:
   - Vercel Dashboard → Settings → Environment Variables
   - LAMBDA_URL を削除

4. **再デプロイ**:
```bash
git add -A
git commit -m "revert: Remove BFF architecture"
git push origin main
```

## 📊 パフォーマンス監視

### メトリクス確認
- **Vercel Analytics**: Functions タブでレスポンスタイムを監視
- **AWS CloudWatch**: Lambda関数の実行時間とエラー率を監視

### 推奨閾値
- BFF応答時間: < 2秒（通常時）
- Lambda実行時間: < 30秒
- エラー率: < 1%

## 🔐 セキュリティ考慮事項

### 現在の設定（開発/テスト用）
- Lambda Function URL: 認証なし（NONE）
- CORS: すべてのオリジン許可（*）

### 本番推奨設定
1. **Lambda認証**: IAM認証に変更
2. **CORS制限**: Vercelドメインのみ許可
3. **Rate Limiting**: Vercel側で実装
4. **環境変数暗号化**: Vercel Encrypted Secrets使用

## 📝 開発者向けメモ

### ローカル開発
```bash
# .env.localファイルを作成
echo "LAMBDA_URL=https://your-lambda.lambda-url.us-east-1.on.aws/" >> .env.local

# 開発サーバー起動
npm run dev

# Vercel CLI でローカルテスト（Serverless Function含む）
vercel dev
```

### デバッグTips
- BFFのconsole.logはVercel Functionログに出力
- `[BFF]`プレフィックスでフィルタリング可能
- リクエスト/レスポンスのサイズと時間を記録

### 将来の拡張案
- [ ] JWT認証の追加
- [ ] Request ID によるトレーシング
- [ ] キャッシュレイヤー（Redis）
- [ ] WebSocket対応（リアルタイム分析）
- [ ] GraphQL対応