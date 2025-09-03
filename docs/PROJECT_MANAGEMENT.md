# 🗂️ SAP Frontend - プロジェクト管理ドキュメント

最終更新: 2025年9月3日  
プロジェクト: SAP Strategic AI Platform Frontend  

---

## 📋 **目次（クイックナビゲーション）**

1. [🚀 プロジェクト概要](#-プロジェクト概要)
2. [⚙️ 技術構成](#-技術構成)
3. [🏗️ AWS CDK インフラ管理](#-aws-cdk-インフラ管理)
4. [🔐 認証情報管理](#-認証情報管理)
5. [📊 デプロイメント手順](#-デプロイメント手順)
6. [🔄 日常運用](#-日常運用)
7. [🆕 新プロジェクト作成時の流用方法](#-新プロジェクト作成時の流用方法)

---

## 🚀 **プロジェクト概要**

### **プロジェクト名**
SAP Strategic AI Platform - Frontend System

### **目的**
- 売上データの AI 分析プラットフォーム
- Excel アップロード → AI 分析 → 戦略レポート生成
- リアルタイムエラー監視（Sentry + LINE 通知）

### **技術スタック**
- **Frontend**: React + TypeScript + Vite
- **Backend**: AWS Lambda (Node.js)
- **Infrastructure**: AWS CDK (TypeScript)
- **Monitoring**: Sentry + LINE Notify
- **Hosting**: S3 + CloudFront
- **API**: API Gateway + Lambda

---

## ⚙️ **技術構成**

### **アーキテクチャ図**
```
ユーザー → CloudFront → S3 (静的ファイル)
          ↓
          API Gateway → Lambda (データ分析)
          ↓
          Sentry → LINE Notify (エラー通知)
```

### **主要コンポーネント**
1. **React SPA**: フロントエンドアプリケーション
2. **AWS CDK**: インフラストラクチャコード
3. **Lambda Functions**: AI 分析エンジン + Sentry-LINE 連携
4. **Monitoring**: 完全自動エラー監視システム

---

## 🏗️ **AWS CDK インフラ管理**

### **CDK プロジェクト構成**
```
cdk/
├── lib/cdk-stack.ts      ← メインインフラコード
├── bin/cdk.ts            ← エントリーポイント
├── test/                 ← インフラテスト
├── scripts/deploy.sh     ← 自動デプロイスクリプト
└── .env                  ← 環境変数
```

### **CDK 管理方針**
- ✅ **プロジェクトごと管理**: 各プロジェクトに専用 CDK
- ✅ **独立デプロイ**: プロジェクト間の影響なし
- ✅ **テンプレート化**: 新プロジェクトで流用可能

### **CDK デプロイ手順**
```bash
# 1. CDK ディレクトリに移動
cd cdk/

# 2. 環境変数確認
# .env ファイルの設定確認

# 3. 自動デプロイ実行
./scripts/deploy.sh --auto-approve

# 4. 手動デプロイの場合
npm run build
cdk diff
cdk deploy
```

### **重要な CDK リソース**
- **S3 Bucket**: `sap-frontend-{account}-{region}`
- **CloudFront Distribution**: グローバル CDN
- **API Gateway**: `SAP Frontend API`
- **Lambda Functions**: 
  - `sap-sentry-line-webhook`
  - `sap-data-analysis`

---

## 🔐 **認証情報管理**

### **管理場所**
```
C:\Users\tsail\Documents\00_プロジェクト管理\01_SAP売上分析システム\認証情報\
```

### **必要な認証情報**
1. **AWS アカウント**
   - Account ID: `123456789012`
   - Region: `ap-northeast-1`
   - IAM ユーザー: CDK デプロイ権限

2. **GitHub**
   - Repository: `tsailink0611/sap-project-frontend`
   - Personal Access Token: リポジトリアクセス用

3. **Sentry**
   - DSN: `https://3c7ec6808ea8866c33b1c7a581c94a4dd6a4509951282970624.ingest.us.sentry.io/4509951305515008`
   - Organization: `tsailink-dev`

4. **LINE Notify**
   - Token: `+cFeR26+BAW+QPd3cMROvZ72lVVeVM84...`

### **環境変数設定**
```bash
# .env.local (開発用)
VITE_SENTRY_DSN=https://3c7ec...
LINE_NOTIFY_TOKEN=+cFeR26+...
VITE_SUPABASE_URL=https://lmyejjujmzorqmrwpljz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# cdk/.env (CDK用)
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=ap-northeast-1
```

---

## 📊 **デプロイメント手順**

### **フロントエンドデプロイ**
```bash
# 1. ビルド
npm run build

# 2. テスト
npm test

# 3. Git プッシュ
git add .
git commit -m "feat: 新機能追加"
git push origin main
```

### **インフラデプロイ**
```bash
# CDK 自動デプロイ
cd cdk
./scripts/deploy.sh

# 出力例:
# WebsiteURL: https://d1234567890123.cloudfront.net
# ApiUrl: https://abcd1234ef.execute-api.ap-northeast-1.amazonaws.com/prod/
# SentryWebhookUrl: https://abcd1234ef.execute-api.ap-northeast-1.amazonaws.com/prod/webhook/sentry
```

### **デプロイ後確認項目**
- [ ] フロントエンドサイト正常表示
- [ ] API エンドポイント応答確認
- [ ] Sentry エラー監視動作確認
- [ ] LINE 通知テスト

---

## 🔄 **日常運用**

### **開発フロー**
1. **ローカル開発**: `npm run dev`
2. **機能実装**: React コンポーネント作成
3. **テスト**: `npm test`
4. **ビルド確認**: `npm run build`
5. **Git コミット**: 機能完了後
6. **デプロイ**: 必要に応じて CDK デプロイ

### **監視・メンテナンス**
- **Sentry ダッシュボード**: エラー監視
- **CloudWatch**: AWS リソース監視
- **LINE 通知**: リアルタイムアラート
- **GitHub Actions**: CI/CD 状況確認

### **コスト管理**
- **予想月額**: 約 $6 (東京リージョン)
- **主要コスト要素**: CloudFront, Lambda, API Gateway
- **最適化設定**: 完了済み

---

## 🆕 **新プロジェクト作成時の流用方法**

### **Step 1: プロジェクトフォルダ準備**
```bash
# プロジェクト管理フォルダ作成
mkdir "03_新プロジェクト名"
cd "03_新プロジェクト名"
mkdir 認証情報 マニュアル 開発環境
```

### **Step 2: CDK テンプレート流用**
```bash
# 新プロジェクトディレクトリ作成
mkdir new-project-frontend
cd new-project-frontend

# CDK をコピー
cp -r ../sap-project-frontend/cdk ./cdk

# プロジェクト固有設定変更
# 1. cdk/bin/cdk.ts: スタック名変更
# 2. cdk/lib/cdk-stack.ts: リソース名変更
# 3. cdk/.env: アカウント・環境変数設定
```

### **Step 3: カスタマイズポイント**
```typescript
// bin/cdk.ts
new CdkStack(app, 'NewProjectStack', {
  env: { account: '123456789012', region: 'ap-northeast-1' },
});

// lib/cdk-stack.ts
const websiteBucket = new s3.Bucket(this, 'NewProjectBucket', {
  bucketName: `new-project-${this.account}-${cdk.Stack.of(this).region}`,
  // ...
});
```

### **Step 4: ドキュメント更新**
1. この `PROJECT_MANAGEMENT.md` をコピー
2. プロジェクト名・目的を更新
3. 認証情報を新プロジェクト用に変更
4. マニュアルフォルダに配置

---

## 📞 **緊急時・トラブル対応**

### **よくある問題**
1. **CDK デプロイエラー**
   - 解決法: `cdk bootstrap` 実行
   - 参照: `cdk/README.md`

2. **Sentry 通知が来ない**
   - 確認: LINE Notify Token 有効性
   - 確認: Webhook URL 設定

3. **ビルドエラー**
   - 解決法: `npm ci` で依存関係再インストール
   - 確認: Node.js バージョン (v18以上)

### **連絡先・リソース**
- **GitHub**: https://github.com/tsailink0611/sap-project-frontend
- **AWS Console**: CDK スタック確認
- **Sentry**: https://sentry.io/tsailink-dev/
- **Claude Code**: AI アシスタント

---

## 🎯 **このドキュメントの使い方**

### **日常参照**
- デプロイ手順の確認
- 認証情報の場所確認
- トラブル時の対処法参照

### **新メンバー向け**
- プロジェクト全体の理解
- 開発環境セットアップ
- 運用フローの把握

### **プロジェクト終了時**
- 設定情報のアーカイブ
- 次期プロジェクトでの流用準備
- ナレッジベース化

---

**💡 重要**: このドキュメントは「プロジェクト管理フォルダ」と連携して使用し、認証情報や詳細設定は別途安全な場所で管理してください。**