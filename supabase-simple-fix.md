# Supabase Edge Function 簡易修正

## smart-processorを更新

Supabaseダッシュボードで、以下のコードに置き換え：

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, salesData, format } = await req.json()
    
    // データの簡易分析（Claude API不要）
    const dataCount = salesData?.length || 0
    const columns = salesData && salesData.length > 0 ? Object.keys(salesData[0]) : []
    
    // 売上列を検出
    const salesColumn = columns.find(col => 
      col.toLowerCase().includes('売上') || 
      col.toLowerCase().includes('sales') ||
      col.toLowerCase().includes('金額')
    )
    
    // 日付列を検出
    const dateColumn = columns.find(col => 
      col.toLowerCase().includes('日付') || 
      col.toLowerCase().includes('date') ||
      col.toLowerCase().includes('月')
    )
    
    // 簡易的な分析結果を生成
    let summary = `データセットには${dataCount}件のレコードと${columns.length}個の列が含まれています。`
    
    if (salesColumn && salesData) {
      const salesValues = salesData.map(row => {
        const val = String(row[salesColumn] || '0').replace(/[,¥円\s]/g, '')
        return isNaN(Number(val)) ? 0 : Number(val)
      })
      const totalSales = salesValues.reduce((a, b) => a + b, 0)
      const avgSales = totalSales / salesValues.length
      
      summary += ` 売上の合計は${totalSales.toLocaleString()}円、平均は${Math.round(avgSales).toLocaleString()}円です。`
    }
    
    const response = {
      summary,
      key_insights: [
        `${dataCount}件のデータを分析しました`,
        salesColumn ? `売上データが「${salesColumn}」列に含まれています` : `売上データの列が特定できませんでした`,
        dateColumn ? `期間データが「${dateColumn}」列に含まれています` : `日付データの列が特定できませんでした`
      ],
      recommendations: [
        `データの可視化にはグラフ機能をご利用ください`,
        `より詳細な分析にはClaude APIの設定が必要です`,
        `CSVファイルのフォーマットを統一することで精度が向上します`
      ],
      data_analysis: {
        total_records: dataCount,
        columns: columns,
        detected_sales_column: salesColumn || 'not_found',
        detected_date_column: dateColumn || 'not_found'
      }
    }
    
    // フォーマットに応じて返却
    if (format === 'json') {
      return new Response(
        JSON.stringify({ response }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // マークダウン形式
      const markdown = `
## 📊 売上データ分析結果

### 概要
${summary}

### 主な発見
${response.key_insights.map(insight => `- ${insight}`).join('\n')}

### 推奨事項
${response.recommendations.map(rec => `- ${rec}`).join('\n')}

### データ詳細
- レコード数: ${dataCount}件
- カラム数: ${columns.length}個
- 売上列: ${salesColumn || '未検出'}
- 日付列: ${dateColumn || '未検出'}
      `
      
      return new Response(
        JSON.stringify({ response: markdown }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
```

これで基本的な分析が可能になります！
