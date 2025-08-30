# Strategic AI Platform - Windows用デプロイスクリプト
# 使用方法: .\deploy-windows.ps1

Write-Host "🚀 Strategic AI Platform - デプロイ開始" -ForegroundColor Green
Write-Host ""

# 現在のディレクトリを保存
$originalPath = Get-Location

try {
    # Lambda関数のパッケージング (SSOT版)
    Write-Host "📦 Lambda関数をパッケージング中..." -ForegroundColor Yellow
    Set-Location -Path "lambda"
    
    # SSOT: sap-claude-handler (統合版) のZIP作成
    Write-Host "  - sap-claude-handler.zip (SSOT版) を作成中..."
    if (Test-Path "sap-claude-handler.zip") {
        Remove-Item "sap-claude-handler.zip"
    }
    Compress-Archive -Path "sap-claude-handler\lambda_function.py", "requirements.txt" -DestinationPath "sap-claude-handler.zip"
    Write-Host "  ✅ SSOT Lambda関数のパッケージ完了" -ForegroundColor Green
    
    # フォーマット学習関数のZIP作成
    Write-Host "  - format-learning-handler.zip を作成中..."
    if (Test-Path "format-learning-handler.zip") {
        Remove-Item "format-learning-handler.zip"
    }
    Compress-Archive -Path "format-learning-handler.py", "requirements.txt" -DestinationPath "format-learning-handler.zip"
    Write-Host "  ✅ フォーマット学習関数のパッケージ完了" -ForegroundColor Green
    
    # 元のディレクトリに戻る
    Set-Location -Path $originalPath
    
    # フロントエンドのビルド
    Write-Host ""
    Write-Host "🔨 フロントエンドをビルド中..." -ForegroundColor Yellow
    npm run build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ フロントエンドのビルド完了" -ForegroundColor Green
        
        # ビルドサイズの確認
        $buildSize = (Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "  📊 ビルドサイズ: $([Math]::Round($buildSize, 2)) MB" -ForegroundColor Cyan
    } else {
        Write-Host "❌ ビルドに失敗しました" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "✅ パッケージング完了！" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # 次のステップを表示
    Write-Host "📝 次のステップ:" -ForegroundColor Yellow
    Write-Host "  1. AWS CLIでLambda関数をアップロード (SSOT版):"
    Write-Host "     aws lambda update-function-code --function-name sap-claude-handler --zip-file fileb://lambda/sap-claude-handler.zip" -ForegroundColor Gray
    Write-Host "     aws lambda update-function-code --function-name format-learning-handler --zip-file fileb://lambda/format-learning-handler.zip" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. 環境変数を設定 (deployment-config.jsonの新構成):"
    Write-Host "     aws lambda update-function-configuration --function-name sap-claude-handler --environment Variables=`"{USE_CLAUDE_API=true,BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0,LAMBDA_DEBUG_ECHO=0,BUILD_ID=ssot-v1}`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Vercelにデプロイ:"
    Write-Host "     vercel --prod" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ エラーが発生しました: $_" -ForegroundColor Red
    Set-Location -Path $originalPath
    exit 1
}