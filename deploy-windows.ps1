# Strategic AI Platform - Windows用デプロイスクリプト
# 使用方法: .\deploy-windows.ps1

Write-Host "🚀 Strategic AI Platform - デプロイ開始" -ForegroundColor Green
Write-Host ""

# 現在のディレクトリを保存
$originalPath = Get-Location

try {
    # Lambda関数のパッケージング
    Write-Host "📦 Lambda関数をパッケージング中..." -ForegroundColor Yellow
    Set-Location -Path "lambda"
    
    # メイン関数のZIP作成
    Write-Host "  - sap-claude-handler.zip を作成中..."
    if (Test-Path "sap-claude-handler.zip") {
        Remove-Item "sap-claude-handler.zip"
    }
    Compress-Archive -Path "sap-claude-handler.py", "requirements.txt" -DestinationPath "sap-claude-handler.zip"
    Write-Host "  ✅ メイン関数のパッケージ完了" -ForegroundColor Green
    
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
    Write-Host "  1. AWS CLIでLambda関数をアップロード:"
    Write-Host "     aws lambda update-function-code --function-name sap-claude-handler --zip-file fileb://lambda/sap-claude-handler.zip" -ForegroundColor Gray
    Write-Host "     aws lambda update-function-code --function-name format-learning-handler --zip-file fileb://lambda/format-learning-handler.zip" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. 環境変数を設定（deployment-config.jsonから自動設定）:"
    Write-Host "     aws lambda update-function-configuration --function-name sap-claude-handler --environment Variables=`"{SUPABASE_URL=https://fggpltpqtkebkwkqyzkh.supabase.co,SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnZ3BsdHBxdGtlYmt3a3F5emtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDM0NjAzNCwiZXhwIjoyMDM5OTIyMDM0fQ.Wv0kBM7x1ggcK9F4zIxTQ-8jU-7dn_VVz_1mD3ycBn8}`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Vercelにデプロイ:"
    Write-Host "     vercel --prod" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ エラーが発生しました: $_" -ForegroundColor Red
    Set-Location -Path $originalPath
    exit 1
}