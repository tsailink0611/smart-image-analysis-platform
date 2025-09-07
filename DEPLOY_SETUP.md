# 🚀 フルデプロイメント設定ガイド

## GitHub Secrets 設定手順

フルデプロイメント機能を有効化するため、以下の手順でGitHub Secretsを設定してください：

### 1. GitHubリポジトリのSettings → Secrets and variables → Actions に移動

### 2. 以下のSecretsを追加：

```
Secret名: AWS_ACCESS_KEY_ID
Secret値: [ローカル環境から `aws configure get aws_access_key_id` で取得]

Secret名: AWS_SECRET_ACCESS_KEY  
Secret値: [ローカル環境から `aws configure get aws_secret_access_key` で取得]
```

### 認証情報取得コマンド
```bash
# ローカルで実行して値を取得
aws configure get aws_access_key_id
aws configure get aws_secret_access_key
```

### ✅ 確認済み動作環境
- **CDK Bootstrap**: 成功
- **CDK Synthesis**: 成功  
- **CDK Deploy**: 成功
- **AWS認証**: 設定済み

### 🔧 実際の設定値 (参考)
```
AWS_ACCESS_KEY_ID: AKIAWF34YX5DYXCIPBPE
AWS_SECRET_ACCESS_KEY: [aws configure get aws_secret_access_key で取得]
```

### 3. 設定完了後の動作

- ✅ **Code Quality Check**: ESLint, Build, Test チェック
- ✅ **CDK Infrastructure Diff**: インフラ変更の差分確認  
- ✅ **Deploy to AWS**: 実際のAWSリソースデプロイ
- ✅ **Deployment Notification**: 結果通知

### 4. 現在の状態

**AWS認証情報設定前**:
- ✅ Code Quality Check のみ実行
- ⏭️ CDK/Deploy ステップはスキップ
- ✅ 基本的なCI/CDパイプライン動作

**AWS認証情報設定後**:
- ✅ 完全なCI/CDパイプライン
- ✅ AWS インフラデプロイメント
- ✅ 環境別デプロイ (develop/staging/main)

## セキュリティ注意事項

- AWS認証情報は**絶対にコードにコミットしない**
- GitHub Secretsのみで管理
- 本番環境には最小権限のIAMロールを使用推奨

## 動作確認

設定後、develop ブランチにプッシュして全ステップが✅になることを確認してください。