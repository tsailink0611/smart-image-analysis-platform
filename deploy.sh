#!/bin/bash

# Strategic AI Platform - デプロイスクリプト
# 使用方法: ./deploy.sh [dev|prod]

set -e  # エラーが発生したら停止

# 環境変数の確認
ENV=${1:-dev}
echo "🚀 デプロイ環境: $ENV"

# カラー出力用の設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 成功/エラーメッセージ関数
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 必要なツールの確認
echo "📋 必要なツールを確認中..."

command -v aws >/dev/null 2>&1 || error "AWS CLIがインストールされていません"
command -v npm >/dev/null 2>&1 || error "npmがインストールされていません"
command -v zip >/dev/null 2>&1 || error "zipがインストールされていません"

success "必要なツールが全て利用可能です"

# 1. Lambda関数のデプロイ (SSOT版)
echo ""
echo "📦 Lambda関数をパッケージング中..."

cd lambda

# SSOT: sap-claude-handler (統合版)
echo "  - sap-claude-handler (SSOT版) をパッケージング..."
cd sap-claude-handler
zip -q ../sap-claude-handler.zip lambda_function.py ../requirements.txt
cd ..
success "SSOT Lambda関数のパッケージ完了"

# フォーマット学習関数のパッケージング
echo "  - format-learning-handlerをパッケージング..."
zip -q function-format.zip format-learning-handler.py requirements.txt
success "フォーマット学習関数のパッケージ完了"

# Lambda関数の更新または作成
echo ""
echo "☁️  Lambda関数をAWSにデプロイ中..."

# SSOT: sap-claude-handler (統合版)
FUNCTION_NAME="sap-claude-handler"
if aws lambda get-function --function-name $FUNCTION_NAME 2>/dev/null; then
    echo "  - 既存の関数 $FUNCTION_NAME を更新中..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://sap-claude-handler.zip \
        --no-cli-pager > /dev/null
    success "$FUNCTION_NAME の更新完了"
else
    warning "$FUNCTION_NAME が存在しません。手動で作成してください"
fi

# フォーマット学習関数のデプロイ
FUNCTION_NAME="format-learning-handler"
if aws lambda get-function --function-name $FUNCTION_NAME 2>/dev/null; then
    echo "  - 既存の関数 $FUNCTION_NAME を更新中..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://function-format.zip \
        --no-cli-pager > /dev/null
    success "$FUNCTION_NAME の更新完了"
else
    warning "$FUNCTION_NAME が存在しません。手動で作成してください"
fi

# クリーンアップ
rm -f sap-claude-handler.zip function-format.zip
cd ..

# 2. フロントエンドのビルド
echo ""
echo "🔨 フロントエンドをビルド中..."

npm run build > /dev/null 2>&1 || error "ビルドに失敗しました"
success "フロントエンドのビルド完了"

# ビルドサイズの確認
BUILD_SIZE=$(du -sh dist | cut -f1)
echo "  📊 ビルドサイズ: $BUILD_SIZE"

# 3. デプロイ完了メッセージ
echo ""
echo "========================================="
success "デプロイが完了しました！"
echo "========================================="
echo ""
echo "📝 次のステップ:"
echo "  1. Supabaseダッシュボードでテーブルを作成"
echo "  2. Lambda関数の環境変数を設定"
echo "  3. API Gatewayでエンドポイントを設定"
echo "  4. Vercelにフロントエンドをデプロイ"
echo ""
echo "詳細な手順は DEPLOYMENT.md を参照してください"

# オプション: 自動テストの実行
if [ "$ENV" = "dev" ]; then
    echo ""
    read -p "🧪 テストを実行しますか? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm test
    fi
fi