# AWS Lambda デプロイ手順

## 1. AWS CLIのインストール
```bash
# Windowsの場合
# https://aws.amazon.com/cli/ からダウンロード
```

## 2. Lambda関数の作成

### AWS Consoleで実行：

1. **AWS Lambda**にアクセス
2. **「関数の作成」**をクリック
3. 設定：
   - 関数名: `sap-claude-handler`
   - ランタイム: Python 3.11
   - アーキテクチャ: x86_64

## 3. コードのアップロード

1. `lambda/sap-claude-handler.py`をコピー
2. Lambda関数のコードエディタに貼り付け
3. **「Deploy」**をクリック

## 4. 環境変数の設定

設定 → 環境変数：
- なし（Bedrockは自動認証）

## 5. IAMロールの設定

Lambda実行ロールに以下を追加：
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "*"
    }
  ]
}
```

## 6. API Gatewayの作成

1. **API Gateway**にアクセス
2. **REST API**を作成
3. **新しいリソース**を作成: `/analysis`
4. **POSTメソッド**を追加
5. Lambda関数と統合
6. **CORS**を有効化

## 7. デプロイ

1. API Gatewayで**「デプロイ」**
2. ステージ名: `prod`
3. **エンドポイントURL**をコピー

## 8. Vercelの環境変数を更新

```
VITE_API_ENDPOINT = [API GatewayのURL]/analysis
```