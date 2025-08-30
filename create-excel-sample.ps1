# Excel形式のサンプルファイルを作成するPowerShellスクリプト

Write-Host "📊 Excel形式のサンプルファイルを作成中..." -ForegroundColor Yellow

try {
    # Excelアプリケーションを起動
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    
    # 新しいワークブックを作成
    $workbook = $excel.Workbooks.Add()
    $worksheet = $workbook.Worksheets.Item(1)
    $worksheet.Name = "売上データ"
    
    # ヘッダー行の設定
    $headers = @("日付", "商品名", "売上金額", "数量", "顧客名", "地域")
    for ($i = 0; $i -lt $headers.Length; $i++) {
        $worksheet.Cells.Item(1, $i + 1) = $headers[$i]
        $worksheet.Cells.Item(1, $i + 1).Font.Bold = $true
        $worksheet.Cells.Item(1, $i + 1).Interior.Color = 15773696  # 薄いグレー
    }
    
    # データ行の追加
    $data = @(
        @("2025-01-01", "ノートPC", 250000, 2, "株式会社A", "東京"),
        @("2025-01-02", "マウス", 3500, 5, "株式会社B", "大阪"),
        @("2025-01-03", "キーボード", 8000, 3, "株式会社C", "名古屋"),
        @("2025-01-04", "モニター", 45000, 1, "株式会社D", "福岡"),
        @("2025-01-05", "USBメモリ", 2500, 10, "株式会社E", "札幌"),
        @("2025-01-06", "ノートPC", 125000, 1, "株式会社F", "仙台"),
        @("2025-01-07", "プリンター", 68000, 2, "株式会社G", "広島"),
        @("2025-01-08", "マウス", 7000, 10, "株式会社H", "京都"),
        @("2025-01-09", "キーボード", 16000, 6, "株式会社I", "神戸"),
        @("2025-01-10", "モニター", 90000, 2, "株式会社J", "横浜"),
        @("2025-01-11", "ノートPC", 375000, 3, "株式会社K", "千葉"),
        @("2025-01-12", "USBメモリ", 5000, 20, "株式会社L", "埼玉"),
        @("2025-01-13", "プリンター", 34000, 1, "株式会社M", "東京"),
        @("2025-01-14", "マウス", 10500, 15, "株式会社N", "大阪"),
        @("2025-01-15", "キーボード", 24000, 9, "株式会社O", "名古屋")
    )
    
    for ($row = 0; $row -lt $data.Length; $row++) {
        for ($col = 0; $col -lt $data[$row].Length; $col++) {
            $worksheet.Cells.Item($row + 2, $col + 1) = $data[$row][$col]
        }
    }
    
    # 日付列の書式設定
    $dateColumn = $worksheet.Columns.Item(1)
    $dateColumn.NumberFormat = "yyyy-mm-dd"
    
    # 金額列の書式設定（カンマ区切り）
    $amountColumn = $worksheet.Columns.Item(3)
    $amountColumn.NumberFormat = "#,##0"
    
    # 列幅の自動調整
    $worksheet.Columns.AutoFit() | Out-Null
    
    # ファイル保存
    $filePath = "$PSScriptRoot\test-data\sample-sales.xlsx"
    $workbook.SaveAs($filePath, 51)  # 51 = xlOpenXMLWorkbook (.xlsx)
    
    Write-Host "✅ Excelファイルを作成しました: $filePath" -ForegroundColor Green
    
    # クリーンアップ
    $workbook.Close()
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    
} catch {
    Write-Host "❌ エラー: $_" -ForegroundColor Red
    Write-Host "手動でExcelファイルを作成してください" -ForegroundColor Yellow
} finally {
    if ($excel) {
        try {
            $excel.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        } catch {}
    }
}

Write-Host ""
Write-Host "📝 推奨テスト用ファイル:" -ForegroundColor Cyan
Write-Host "  1. sample-sales.xlsx (Excel形式) - 推奨"
Write-Host "  2. 既存の売上データファイル"
Write-Host "  3. 手動で作成したCSVファイル"