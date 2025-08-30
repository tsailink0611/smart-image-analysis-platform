@echo off
REM Strategic AI Platform - AWS Lambda デプロイスクリプト
REM 使用前に AWS CLI の設定が必要です: aws configure

echo ======================================
echo Strategic AI Platform - AWS Deploy
echo ======================================
echo.

REM 環境変数（必要に応じて変更）
set AWS_REGION=us-east-1
set FUNCTION_NAME_MAIN=sap-claude-handler-v2
set FUNCTION_NAME_FORMAT=format-learning-handler
set SUPABASE_URL=https://fggpltpqtkebkwkqyzkh.supabase.co
set SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnZ3BsdHBxdGtlYmt3a3F5emtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDM0NjAzNCwiZXhwIjoyMDM5OTIyMDM0fQ.Wv0kBM7x1ggcK9F4zIxTQ-8jU-7dn_VVz_1mD3ycBn8

echo [1/5] Lambda関数の存在確認...
aws lambda get-function --function-name %FUNCTION_NAME_MAIN% --region %AWS_REGION% >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo 警告: %FUNCTION_NAME_MAIN% が存在しません。
    echo AWS Consoleで新規作成してください:
    echo   - Runtime: Python 3.12
    echo   - Memory: 1024 MB
    echo   - Timeout: 60 seconds
    echo.
    pause
    exit /b 1
)

aws lambda get-function --function-name %FUNCTION_NAME_FORMAT% --region %AWS_REGION% >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo 警告: %FUNCTION_NAME_FORMAT% が存在しません。
    echo AWS Consoleで新規作成してください:
    echo   - Runtime: Python 3.12
    echo   - Memory: 512 MB
    echo   - Timeout: 30 seconds
    echo.
    pause
    exit /b 1
)

echo OK - 両方の関数が存在します
echo.

echo [2/5] メイン関数のコードをアップロード...
aws lambda update-function-code ^
    --function-name %FUNCTION_NAME_MAIN% ^
    --zip-file fileb://lambda/sap-claude-handler-v2.zip ^
    --region %AWS_REGION% >nul

if %errorlevel% equ 0 (
    echo OK - %FUNCTION_NAME_MAIN% のコードを更新しました
) else (
    echo エラー: コードのアップロードに失敗しました
    pause
    exit /b 1
)

echo.
echo [3/5] フォーマット学習関数のコードをアップロード...
aws lambda update-function-code ^
    --function-name %FUNCTION_NAME_FORMAT% ^
    --zip-file fileb://lambda/format-learning-handler.zip ^
    --region %AWS_REGION% >nul

if %errorlevel% equ 0 (
    echo OK - %FUNCTION_NAME_FORMAT% のコードを更新しました
) else (
    echo エラー: コードのアップロードに失敗しました
    pause
    exit /b 1
)

echo.
echo [4/5] メイン関数の環境変数を設定...
aws lambda update-function-configuration ^
    --function-name %FUNCTION_NAME_MAIN% ^
    --environment Variables="{\"SUPABASE_URL\":\"%SUPABASE_URL%\",\"SUPABASE_SERVICE_KEY\":\"%SUPABASE_KEY%\"}" ^
    --region %AWS_REGION% >nul

if %errorlevel% equ 0 (
    echo OK - 環境変数を設定しました
) else (
    echo エラー: 環境変数の設定に失敗しました
    pause
    exit /b 1
)

echo.
echo [5/5] フォーマット学習関数の環境変数を設定...
aws lambda update-function-configuration ^
    --function-name %FUNCTION_NAME_FORMAT% ^
    --environment Variables="{\"SUPABASE_URL\":\"%SUPABASE_URL%\",\"SUPABASE_SERVICE_KEY\":\"%SUPABASE_KEY%\"}" ^
    --region %AWS_REGION% >nul

if %errorlevel% equ 0 (
    echo OK - 環境変数を設定しました
) else (
    echo エラー: 環境変数の設定に失敗しました
    pause
    exit /b 1
)

echo.
echo ======================================
echo デプロイ完了！
echo ======================================
echo.
echo 次のステップ:
echo 1. API Gatewayで新しいエンドポイントを設定
echo    - POST /format-learning (format-learning-handler)
echo 2. フロントエンドをVercelにデプロイ
echo    - vercel --prod
echo 3. 動作テストを実施
echo.
pause