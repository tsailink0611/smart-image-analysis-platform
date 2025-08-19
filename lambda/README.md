# Lambda Function Deployment Guide

## 📋 概要

Strategic AI Platform のバックエンド処理を担うAWS Lambda関数です。
フロントエンドから送信された売上データを Amazon Bedrock (Claude 3) で分析します。

## 🛠️ 主要な修正内容

### 問題の解決
- **修正前**: `prompt` フィールドのみ処理、AIが偽データを生成
- **修正後**: 複数データフィールド対応、実データ分析の実装

### 新機能
1. **複数フィールド対応**: `salesData`, `data`, `attachments` から自動検出
2. **テーブル形式データ変換**: AIが理解しやすいMarkdownテーブル形式
3. **偽データ防止**: 明示的指示による架空データ生成の防止
4. **強化エラーハンドリング**: 詳細なログとエラー分類
5. **後方互換性**: 既存API構造の維持

## 📁 ファイル構成

```
lambda/
├── sap-claude-handler.py    # メインLambda関数（修正版）
├── requirements.txt         # Python依存関係（作成予定）
└── README.md               # このファイル
```

## 🚀 デプロイ手順

### 1. 現在のLambda関数の確認
```bash
aws lambda get-function --function-name sap-claude-handler
```

### 2. 関数コードの更新
```bash
# ZIPファイルを作成
zip function.zip sap-claude-handler.py

# Lambda関数を更新
aws lambda update-function-code \
    --function-name sap-claude-handler \
    --zip-file fileb://function.zip
```

### 3. 環境変数の確認
```bash
aws lambda get-function-configuration --function-name sap-claude-handler
```

必要な環境変数:
- `AWS_REGION=us-east-1`

## 🔧 技術仕様

### Lambda設定
- **Runtime**: Python 3.12
- **Memory**: 1024 MB  
- **Timeout**: 30 seconds
- **Region**: us-east-1

### 処理フロー
```
1. フロントエンドからJSON受信
   ├── prompt (必須)
   ├── salesData/data/attachments (オプション)
   ├── dataContext (オプション)
   └── metadata (オプション)

2. データ検証・抽出
   ├── 複数フィールドからデータ自動検出
   ├── データ形式の検証
   └── ログ出力

3. プロンプト強化
   ├── 実データをテーブル形式に変換
   ├── 偽データ防止指示を追加
   └── メタデータ情報を統合

4. Bedrock API呼び出し
   ├── Claude 3 Sonnet モデル
   ├── Temperature: 0.1
   └── Max Tokens: 2000

5. レスポンス処理
   ├── 結果の解析
   ├── CORS ヘッダー設定
   └── エラーハンドリング
```

## 🔍 デバッグ情報

### CloudWatch ログ確認
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/sap-claude-handler"
```

### 主要ログメッセージ
- `Received prompt: ...` - プロンプト受信確認
- `Sales data rows: N` - データ行数確認  
- `Enhanced prompt length: N` - 強化プロンプトサイズ
- `Bedrock response received successfully` - AI分析完了

## 📊 API仕様

### リクエスト形式
```json
{
  "prompt": "売上トレンドを分析して",
  "salesData": [...],  // メインデータフィールド
  "data": [...],       // 互換性フィールド
  "attachments": [...], // 添付ファイル形式
  "dataContext": "月次売上データ",
  "metadata": {
    "hasData": true,
    "totalRows": 100,
    "columns": ["date", "sales", "product"],
    "dataType": "sales"
  },
  "systemMessage": "データが添付されています..."
}
```

### レスポンス形式  
```json
{
  "response": "AI分析結果テキスト",
  "message": "分析が完了しました", 
  "dataProcessed": 50
}
```

## ⚠️ 注意事項

### セキュリティ
- IAM権限: `bedrock:InvokeModel` のみ必要
- データ永続化なし（一時処理のみ）
- 個人情報のログ出力回避

### パフォーマンス
- データ制限: フロントエンド側で50行まで
- テーブル表示: 最初の10行のみ（残りはサマリー）
- タイムアウト対策: 30秒制限内での処理

### 互換性
- 既存フロントエンドとの完全互換性
- 段階的デプロイメント対応
- ロールバック可能な構成

## 🔄 バックエンドAIとの連携

このファイルをバックエンド担当AIと共有し、以下の作業を依頼してください：

1. **コードレビュー**: 実装内容の確認
2. **デプロイメント**: AWS Lambda への適用
3. **テスト実行**: 修正版の動作確認
4. **パフォーマンス検証**: レスポンス時間とエラー率の確認

## 📝 テスト計画

### 1. 基本機能テスト
- データなしでの動作確認
- 小規模データでの分析テスト
- 大規模データでの制限動作確認

### 2. エラーハンドリングテスト
- 不正JSONリクエスト
- Bedrockタイムアウト
- メモリ不足状況

### 3. パフォーマンステスト
- レスポンス時間測定
- 同時リクエスト処理
- リソース使用量監視

---

**作成日**: 2025年8月19日  
**作成者**: フロントエンド担当AI  
**対象**: sap-claude-handler Lambda関数