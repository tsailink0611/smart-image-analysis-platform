# SAP Frontend Infrastructure - AWS CDK

TypeScriptベースの完全自動化インフラストラクチャ構築プロジェクト

## 🏗️ アーキテクチャ概要

### 構成要素
1. **フロントエンド ホスティング**: S3 + CloudFront
2. **API インフラ**: API Gateway + Lambda Functions
3. **CI/CD パイプライン**: CodeBuild + GitHub連携
4. **監視・アラート**: CloudWatch + SNS + Sentry

## 🚀 デプロイ方法

### 前提条件
```bash
# Node.js (v18以上)
node --version

# AWS CLI v2
aws --version
aws configure

# AWS CDK
npm install -g aws-cdk
cdk --version
```

### 環境変数設定
```bash
# .envファイルを作成・編集
LINE_NOTIFY_TOKEN=あなたのLINE Notifyトークン
VITE_SENTRY_DSN=あなたのSentry DSN
CDK_DEFAULT_ACCOUNT=あなたのAWSアカウントID
CDK_DEFAULT_REGION=ap-northeast-1
```

### デプロイ実行

#### 方法1: スクリプト実行（推奨）
```bash
# 対話的デプロイ
./scripts/deploy.sh

# 自動デプロイ（確認なし）
./scripts/deploy.sh --auto-approve
```

#### 方法2: 手動実行
```bash
# 依存関係インストール
npm install

# TypeScriptビルド
npm run build

# CDKブートストラップ（初回のみ）
cdk bootstrap

# 差分確認
cdk diff

# デプロイ実行
cdk deploy
```

## 🧪 テスト

```bash
# すべてのテスト実行
npm test

# カバレッジレポート付き
npm run test -- --coverage
```

## 📊 主要メトリクス

- **Lambda関数の実行回数・エラー率**
- **API Gatewayのリクエスト数・レイテンシ**
- **CloudFrontのキャッシュヒット率**
- **S3のデータ転送量**

## 💰 予想月額コスト（東京リージョン）

```
S3 (1GB):               $0.025
CloudFront (10GB):      $1.20
API Gateway (100K):     $0.35
Lambda (100K実行):      $0.20
CodeBuild (10時間):     $1.00
CloudWatch:             $3.00
---------------------------------
月額合計：              約 $6.00
```

## 🔐 セキュリティ対策

- ✅ S3: パブリックアクセス完全ブロック
- ✅ CloudFront: HTTPS強制リダイレクト
- ✅ API Gateway: CORS設定、スロットリング
- ✅ Lambda: 最小権限IAMロール
- ✅ CloudWatch: 詳細ログ記録

## 📋 Useful commands

* `npm run build` - TypeScriptコンパイル
* `npm run watch` - 変更監視・自動コンパイル
* `npm run test` - Jest単体テスト実行
* `cdk deploy` - AWSアカウント/リージョンにデプロイ
* `cdk diff` - 現在のスタックとの差分表示
* `cdk synth` - CloudFormationテンプレート生成
