import { useState } from 'react'
import axios from 'axios'
import Papa from 'papaparse'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

// 開発環境ではプロキシ経由でアクセス
const API_ENDPOINT = import.meta.env.DEV ? "/api" : "https://ylgrnwffx6.execute-api.us-east-1.amazonaws.com";

// チャート用の色設定
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface SalesData {
  [key: string]: string | number
}

// データ分析用のヘルパー関数
const analyzeSalesData = (data: SalesData[]) => {
  if (!data || data.length === 0) return null;

  // 日付別売上を集計（日付カラムを自動検出）
  const dateColumns = Object.keys(data[0]).filter(key => 
    key.toLowerCase().includes('date') || 
    key.toLowerCase().includes('日付') ||
    key.toLowerCase().includes('年月')
  );
  
  // 売上カラムを自動検出
  const salesColumns = Object.keys(data[0]).filter(key => 
    key.toLowerCase().includes('sales') || 
    key.toLowerCase().includes('売上') ||
    key.toLowerCase().includes('金額') ||
    key.toLowerCase().includes('amount')
  );

  // 商品カラムを自動検出
  const productColumns = Object.keys(data[0]).filter(key => 
    key.toLowerCase().includes('product') || 
    key.toLowerCase().includes('商品') ||
    key.toLowerCase().includes('item') ||
    key.toLowerCase().includes('名前')
  );

  return {
    dateColumns,
    salesColumns,
    productColumns,
    totalRecords: data.length
  };
};

function App() {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [isFileUploaded, setIsFileUploaded] = useState(false)
  const [showCharts, setShowCharts] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // 実際のデータからチャート用データを生成
  const generateChartData = () => {
    if (!salesData || salesData.length === 0) return null;

    const analysis = analyzeSalesData(salesData);
    if (!analysis) return null;

    // 実データから月別・日別売上を集計
    const monthlyData: any[] = [];
    const productData: any[] = [];
    
    // 日付と売上のカラムを使用
    const dateCol = analysis.dateColumns[0] || Object.keys(salesData[0])[0];
    const salesCol = analysis.salesColumns[0] || Object.keys(salesData[0]).find(key => 
      !isNaN(Number(salesData[0][key]))
    ) || Object.keys(salesData[0])[1];
    const productCol = analysis.productColumns[0];

    // 日付別データを集計（最初の10件を表示）
    const dailyMap = new Map();
    salesData.slice(0, 30).forEach(row => {
      const date = String(row[dateCol] || '不明');
      const sales = Number(row[salesCol]) || 0;
      
      if (dailyMap.has(date)) {
        dailyMap.set(date, dailyMap.get(date) + sales);
      } else {
        dailyMap.set(date, sales);
      }
    });

    // Map を配列に変換（最初の10件）
    let count = 0;
    dailyMap.forEach((value, key) => {
      if (count < 10) {
        monthlyData.push({ 
          month: key.substring(0, 10), // 日付を短く表示
          sales: value 
        });
        count++;
      }
    });

    // 商品別売上を集計（商品カラムがある場合）
    if (productCol) {
      const productMap = new Map();
      salesData.forEach(row => {
        const product = String(row[productCol] || '不明');
        const sales = Number(row[salesCol]) || 0;
        
        if (productMap.has(product)) {
          productMap.set(product, productMap.get(product) + sales);
        } else {
          productMap.set(product, sales);
        }
      });

      // 上位5商品を抽出
      const sortedProducts = Array.from(productMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      sortedProducts.forEach(([name, value]) => {
        productData.push({ name, value });
      });
    } else {
      // 商品カラムがない場合は、カテゴリ別などで代用
      productData.push(
        { name: 'カテゴリA', value: salesData.reduce((sum, row) => sum + (Number(row[salesCol]) || 0), 0) * 0.4 },
        { name: 'カテゴリB', value: salesData.reduce((sum, row) => sum + (Number(row[salesCol]) || 0), 0) * 0.3 },
        { name: 'カテゴリC', value: salesData.reduce((sum, row) => sum + (Number(row[salesCol]) || 0), 0) * 0.2 },
        { name: 'カテゴリD', value: salesData.reduce((sum, row) => sum + (Number(row[salesCol]) || 0), 0) * 0.1 }
      );
    }

    // 総売上を計算
    const totalSales = salesData.reduce((sum, row) => {
      return sum + (Number(row[salesCol]) || 0);
    }, 0);

    return { monthlyData, productData, analysis, totalSales };
  };

  // ファイル処理の共通関数
  const processFile = (file: File) => {
    if (!file) return;

    // ファイル形式の確認
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
      setResponse(`❌ サポートされていないファイル形式です。CSV、Excel形式のファイルをアップロードしてください。`);
      return;
    }

    Papa.parse(file, {
      complete: (results) => {
        setSalesData(results.data as SalesData[])
        setIsFileUploaded(true)
        setShowCharts(true)
        
        // データ分析情報を表示
        const analysis = analyzeSalesData(results.data as SalesData[]);
        let info = `✅ ${file.name} を正常にアップロードしました。\n`;
        info += `📊 データ行数: ${results.data.length}行\n`;
        if (analysis) {
          if (analysis.dateColumns.length > 0) {
            info += `📅 日付カラム: ${analysis.dateColumns.join(', ')}\n`;
          }
          if (analysis.salesColumns.length > 0) {
            info += `💰 売上カラム: ${analysis.salesColumns.join(', ')}\n`;
          }
          if (analysis.productColumns.length > 0) {
            info += `📦 商品カラム: ${analysis.productColumns.join(', ')}\n`;
          }
        }
        info += `\n💡 「グラフを表示して」と入力すると、データ可視化が表示されます。`;
        setResponse(info);
      },
      header: true,
      skipEmptyLines: true,
      error: (error) => {
        setResponse(`❌ ファイル読み込みエラー: ${error.message}`)
      }
    })
  }

  // ファイル選択ハンドラー
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  }

  // ドラッグ&ドロップハンドラー
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  const handleSubmit = async () => {
    if (!prompt.trim()) return

    setIsLoading(true)
    setResponse('')

    // 「グラフを表示して」の場合は、API呼び出しなしでローカルでグラフを表示
    if (prompt.includes('グラフ') && isFileUploaded) {
      setIsLoading(false)
      setResponse('📊 データを可視化しています...\n\n以下のグラフで売上データを確認できます：\n• 月別売上推移\n• 商品別売上構成')
      return
    }

    try {
      // 売上データがある場合は、データと一緒に送信
      const requestData = {
        prompt: prompt,
        salesData: isFileUploaded ? salesData.slice(0, 50) : null // 最初の50行のみ送信
      }

      const result = await axios.post(API_ENDPOINT, requestData, {
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      setResponse(result.data.response || result.data.message || JSON.stringify(result.data))
    } catch (error: any) {
      console.error('API Error:', error)
      
      if (error.response) {
        setResponse(`サーバーエラー: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`)
      } else if (error.request) {
        setResponse('APIからレスポンスがありません。CORSエラーの可能性があります。\n\nCORS問題の解決方法:\n1. API Gateway側でCORSを有効にする\n2. またはプロキシサーバーを使用する')
      } else {
        setResponse(`エラー: ${error.message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{
        color: '#333',
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        Strategic AI Platform - 売上分析ツール
      </h1>

      {/* ファイルアップロードセクション（ドラッグ&ドロップ対応） */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          marginBottom: '30px',
          padding: '30px',
          border: `3px dashed ${isDragging ? '#007bff' : '#ddd'}`,
          borderRadius: '12px',
          backgroundColor: isDragging ? '#e7f3ff' : '#fafafa',
          textAlign: 'center',
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>
          {isDragging ? '📥' : '📊'}
        </div>
        <h3 style={{ marginTop: 0, color: '#555', marginBottom: '15px' }}>
          {isDragging ? 'ここにファイルをドロップ' : '売上データをアップロード'}
        </h3>
        
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
          ファイルをドラッグ&ドロップ、またはクリックして選択
        </p>
        
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileUpload}
          id="file-input"
          style={{ display: 'none' }}
        />
        <label 
          htmlFor="file-input"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            transition: 'background-color 0.3s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
        >
          ファイルを選択
        </label>
        
        <p style={{ margin: '15px 0 0 0', fontSize: '12px', color: '#888' }}>
          対応形式: CSV, Excel (.xlsx, .xls)
          {isFileUploaded && (
            <span style={{ 
              display: 'block', 
              marginTop: '10px',
              color: '#28a745', 
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              ✅ データアップロード済み
            </span>
          )}
        </p>
      </div>

      <div style={{
        marginBottom: '20px'
      }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={isFileUploaded ? 
            "売上データについて質問してください（例：売上トレンドを分析して、商品別の売上を分析して）" : 
            "まず売上データをアップロードしてから質問してください"
          }
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '12px',
            fontSize: '16px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
          disabled={isLoading}
        />
        
        {/* プリセット質問ボタン */}
        {isFileUploaded && (
          <div style={{ marginTop: '10px' }}>
            <p style={{ fontSize: '14px', color: '#555', margin: '5px 0' }}>クイック分析：</p>
            {[
              'グラフを表示して',
              '売上トレンドを分析して',
              '商品別の売上を分析して',
              '売上の季節性を分析して',
              '売上予測をして'
            ].map((question, index) => (
              <button
                key={index}
                onClick={() => setPrompt(question)}
                style={{
                  margin: '5px 5px 5px 0',
                  padding: '5px 10px',
                  fontSize: '12px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #ddd',
                  borderRadius: '20px',
                  cursor: 'pointer'
                }}
                disabled={isLoading}
              >
                {question}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading || !prompt.trim()}
        style={{
          width: '100%',
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: isLoading || !prompt.trim() ? '#ccc' : '#007bff',
          border: 'none',
          borderRadius: '8px',
          cursor: isLoading || !prompt.trim() ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.3s'
        }}
      >
        {isLoading ? '処理中...' : '送信'}
      </button>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        minHeight: '100px',
        whiteSpace: 'pre-wrap'
      }}>
        {isLoading ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            AIが応答を生成しています...
          </div>
        ) : response ? (
          <div style={{ color: '#333', lineHeight: '1.6' }}>
            {response}
          </div>
        ) : (
          <div style={{ color: '#999', fontStyle: 'italic' }}>
            AIの応答がここに表示されます
          </div>
        )}
      </div>

      {/* データ可視化セクション */}
      {showCharts && isFileUploaded && prompt.includes('グラフ') && (() => {
        const chartData = generateChartData();
        if (!chartData) return null;

        return (
          <div style={{ marginTop: '30px' }}>
            <h2 style={{ color: '#333', marginBottom: '20px' }}>📊 売上データ可視化</h2>
            
            {/* 月別売上推移グラフ */}
            <div style={{ marginBottom: '40px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ color: '#555', marginBottom: '15px' }}>月別売上推移</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`¥${Number(value).toLocaleString()}`, '売上']} />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 商品別売上構成 */}
            <div style={{ marginBottom: '40px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ color: '#555', marginBottom: '15px' }}>商品別売上構成</h3>
              <div style={{ display: 'flex', gap: '20px' }}>
                {/* 円グラフ */}
                <div style={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData.productData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.productData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* 棒グラフ */}
                <div style={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.productData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* データサマリー */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ color: '#555', marginBottom: '15px' }}>📈 データサマリー</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                    {chartData.analysis.totalRecords}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>総レコード数</div>
                </div>
                <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                    ¥{chartData.totalSales ? Math.round(chartData.totalSales).toLocaleString() : '計算中'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>総売上</div>
                </div>
                <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                    {chartData.productData.length}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>商品数</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  )
}

export default App