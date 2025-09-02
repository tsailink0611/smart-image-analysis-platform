# GitHub連携セットアップガイド

## 🚀 GitHubリポジトリ作成・連携手順

### Step 1: GitHubでリポジトリ作成
1. **GitHub.com**にアクセス
2. **「New repository」**をクリック
3. **Repository name**: `sap-project-frontend`
4. **Description**: `SAP Strategic AI Platform - TypeScript/React Frontend with AWS CDK Infrastructure`
5. **Public/Private**を選択
6. **「Create repository」**をクリック

### Step 2: ローカルとリモートを連携
```bash
# 現在のディレクトリで実行
cd "C:\Users\tsail\Desktop\sap-project-frontend"

# リモートリポジトリを追加
git remote add origin https://github.com/tsailink0611/sap-project-frontend.git

# メインブランチをpush
git branch -M main
git push -u origin main
```

### Step 3: GitHub ActionsでCI/CD設定（オプション）
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      
    - name: Deploy CDK
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      run: |
        cd cdk
        npm run build
        npx cdk deploy --require-approval never
```

## 📊 現在のプロジェクト状況

### ✅ 完成済み機能
1. **Reactフロントエンド**（SPA、TypeScript）
2. **Sentryエラー監視**（ErrorBoundary、パフォーマンス監視）
3. **LINE Notify連携**（Webhook、自動通知）
4. **AWS CDK インフラ**（S3、CloudFront、Lambda、API Gateway）
5. **CI/CDパイプライン**（CodeBuild、自動デプロイ）
6. **監視・アラート**（CloudWatch、SNS）

### 📁 ファイル構成
```
sap-project-frontend/
├── src/                    ← フロントエンドアプリ
│   ├── components/        ← React コンポーネント
│   ├── hooks/             ← カスタムフック
│   ├── lib/               ← ライブラリ（Sentry等）
│   └── App.tsx           ← メインアプリ
├── cdk/                   ← AWS CDK インフラ
│   ├── lib/              ← CDK スタック
│   ├── test/             ← インフラテスト
│   └── scripts/          ← デプロイスクリプト
├── .env.local            ← 環境変数
└── package.json          ← プロジェクト設定
```

## 🔄 継続的な管理方法

### 日常の開発フロー
```bash
# 1. 変更を開発
# 2. テスト実行
npm test

# 3. ビルドテスト  
npm run build

# 4. コミット
git add .
git commit -m "feat: 新機能追加"

# 5. プッシュ
git push origin main

# 6. インフラ変更がある場合
cd cdk
./scripts/deploy.sh
```

### バックアップ戦略
1. **GitHub**：コード＋履歴
2. **AWS S3**：ビルド成果物
3. **ローカル**：開発環境

## 🎯 次のアクション

### 今すぐ実行すべき
1. **GitHubリポジトリ作成**
2. **git push origin main**
3. **README.md更新**

### 運用開始時
1. **AWS CDKデプロイ**（`cd cdk && ./scripts/deploy.sh`）
2. **ドメイン設定**（必要に応じて）
3. **監視設定確認**

これで完全に管理・記録された状態になります！