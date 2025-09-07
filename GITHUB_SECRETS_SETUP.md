# 🔐 GitHub Secrets 設定ガイド（本番用）

## 1. GitHub Secretsページにアクセス
https://github.com/tsailink0611/sap-project-frontend/settings/secrets/actions

## 2. 以下の値をコピーして設定

### Secret 1:
```
Name: AWS_ACCESS_KEY_ID
Secret: AKIAWF34YX5DYXCIPBPE
```

### Secret 2: 
```
Name: AWS_SECRET_ACCESS_KEY
Secret: [以下のコマンドで取得した値を貼り付け]
```

## 3. AWS Secret Access Keyの取得方法
ローカルターミナルで実行:
```bash
aws configure get aws_secret_access_key
```

## 4. 設定確認
両方のSecretsが追加されたら、「Repository secrets」に2つ表示されることを確認

## 完了後の効果
- ✅ CDK Infrastructure Diff が自動実行
- ✅ AWS へのデプロイが自動化
- ✅ インフラの変更が自動チェック
- ✅ 本番環境への自動デプロイ可能