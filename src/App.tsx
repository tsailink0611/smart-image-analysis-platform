import { useState } from 'react'
import axios from 'axios'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import ColumnMappingLearning from './components/ColumnMappingLearning'
import { saveFormatProfile, getFormatProfile } from './lib/supabase'
import { checkSupabaseConfig } from './lib/debug-supabase'

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

  const keys = Object.keys(data[0]);
  console.log('📊 利用可能な列:', keys);

  // 日付カラムを自動検出（改善版）
  const dateColumns = keys.filter(key => {
    const lowerKey = key.toLowerCase();
    const sample = String(data[0][key]);
    
    // キーワードマッチング
    const keywordMatch = lowerKey.includes('date') || 
      lowerKey.includes('日付') ||
      lowerKey.includes('年月') ||
      lowerKey.includes('日') ||
      lowerKey.includes('月') ||
      lowerKey.includes('期間') ||
      lowerKey.includes('time');
    
    // 日付フォーマットのパターンマッチング
    const datePattern = /^\d{1,4}[\/\-年]\d{1,2}[\/\-月]|\d{1,2}[\/\-日]|^\d{1,2}$/.test(sample);
    
    return keywordMatch || datePattern;
  });
  
  // 売上カラムを自動検出（改善版）
  const salesColumns = keys.filter(key => {
    const lowerKey = key.toLowerCase();
    
    // 日付カラムは除外
    if (dateColumns.includes(key)) {
      return false;
    }
    
    // キーワードマッチング
    const keywordMatch = lowerKey.includes('sales') || 
      lowerKey.includes('売上') ||
      lowerKey.includes('金額') ||
      lowerKey.includes('amount') ||
      lowerKey.includes('実績') ||
      lowerKey.includes('予算') ||
      lowerKey.includes('value') ||
      lowerKey.includes('収益') ||
      lowerKey.includes('合計');
    
    // 数値データチェック（複数行確認）
    let numericCount = 0;
    let hasLargeNumbers = false;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const value = String(data[i][key]).replace(/[,¥円\s]/g, '');
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && value !== '') {
        numericCount++;
        // 100以上の数値があれば売上の可能性が高い
        if (numValue >= 100) {
          hasLargeNumbers = true;
        }
      }
    }
    
    // キーワードがマッチするか、大きな数値を含む数値カラムなら売上カラムとして扱う
    return keywordMatch || (numericCount >= Math.min(3, data.length) && hasLargeNumbers);
  });

  // 商品カラムを自動検出
  const productColumns = keys.filter(key => {
    const lowerKey = key.toLowerCase();
    return lowerKey.includes('product') || 
      lowerKey.includes('商品') ||
      lowerKey.includes('item') ||
      lowerKey.includes('名前') ||
      lowerKey.includes('カテゴリ') ||
      lowerKey.includes('分類');
  });

  console.log('📊 検出結果:', {
    日付列: dateColumns,
    売上列: salesColumns,
    商品列: productColumns
  });

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
  const [forceShowGraphs, setForceShowGraphs] = useState(false)
  const [showDataTable, setShowDataTable] = useState(false)
  const [showColumnMapping, setShowColumnMapping] = useState(false)
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({})

  // 実際のデータからチャート用データを生成
  const generateChartData = () => {
    console.log('🔍 generateChartData開始');
    console.log('🔍 salesData:', salesData);
    console.log('🔍 salesData.length:', salesData?.length);

    if (!salesData || salesData.length === 0) {
      console.log('❌ salesDataが空のため、サンプルデータを使用');
      // サンプルデータを返す
      return {
        monthlyData: [
          { month: 'データなし', sales: 0 },
        ],
        productData: [
          { name: 'データなし', value: 0 },
        ],
        analysis: { totalRecords: 0, dateColumns: [], salesColumns: [], productColumns: [] },
        totalSales: 0
      };
    }

    const analysis = analyzeSalesData(salesData);
    if (!analysis) return null;

    console.log('📊 generateChartData開始');
    console.log('salesData全体:', salesData);
    console.log('salesData最初の3行:', salesData.slice(0, 3));
    console.log('analysis:', analysis);

    // 実データから月別・日別売上を集計
    const monthlyData: any[] = [];
    const productData: any[] = [];
    
    // すべてのキーを取得
    const allKeys = Object.keys(salesData[0]);
    console.log('全カラム名:', allKeys);

    // 各カラムのサンプル値を表示
    allKeys.forEach(key => {
      const sampleValues = salesData.slice(0, 3).map(row => row[key]);
      console.log(`カラム "${key}" のサンプル値:`, sampleValues);
    });

    // 数値カラムを検索
    const numericColumns = allKeys.filter(key => {
      const sampleValues = salesData.slice(0, 10).map(row => row[key]);
      const numericValues = sampleValues.filter(val => {
        const cleanVal = String(val).replace(/[,¥円\s]/g, '');
        const num = Number(cleanVal);
        return !isNaN(num) && num !== 0 && val !== '' && val !== null && val !== undefined;
      });
      console.log(`カラム "${key}": ${numericValues.length}/${sampleValues.length} が数値`);
      return numericValues.length >= Math.floor(sampleValues.length * 0.3); // 30%以上が数値なら数値カラム
    });

    console.log('検出された数値カラム:', numericColumns);

    // 日付と売上のカラムを使用（改善版）
    const dateCol = analysis.dateColumns[0] || allKeys[0];
    
    // 売上カラムの選択を改善（日付カラムを除外）
    let salesCol = analysis.salesColumns[0];
    if (!salesCol || salesCol === dateCol) {
      // 数値カラムから日付カラム以外を選択
      salesCol = numericColumns.find(col => col !== dateCol) || allKeys.find(key => key !== dateCol) || allKeys[1];
    }
    
    const productCol = analysis.productColumns[0] || allKeys.find(key => 
      key !== dateCol && key !== salesCol
    );

    console.log('🎯 選択されたカラム:', { dateCol, salesCol, productCol });

    // 数値変換ヘルパー関数（改善版）
    const parseNumber = (value: any) => {
      if (value === null || value === undefined || value === '') return 0;
      
      // 文字列に変換してクリーンアップ
      let cleanValue = String(value)
        .replace(/[,¥円\s$€£]/g, '') // 通貨記号を削除
        .replace(/[^\d.-]/g, '') // 数字、小数点、マイナス以外を削除
        .trim();
      
      const num = parseFloat(cleanValue);
      const result = isNaN(num) ? 0 : num;
      
      console.log(`数値変換: "${value}" -> "${cleanValue}" -> ${result}`);
      return result;
    };

    // 日付別データを集計（全データを処理）
    const dailyMap = new Map();
    
    // 実際のデータ行をループ（行番号ではなく実データを使用）
    salesData.forEach((row, index) => {
      // 各列の値を確認
      const allValues = Object.entries(row);
      console.log(`行${index} の全データ:`, allValues);
      
      // 日付の取得（曜日列も含む）
      let dateValue = row[dateCol];
      
      // 日付が曜日の場合、インデックスを使用
      const dayOfWeeks = ['日', '月', '火', '水', '木', '金', '土'];
      let displayDate = String(dateValue || `データ${index + 1}`);
      
      if (dayOfWeeks.includes(displayDate)) {
        // 曜日の場合は、曜日名をそのまま使用
        displayDate = displayDate;
      } else if (!isNaN(Number(dateValue)) && Number(dateValue) > 40000 && Number(dateValue) < 50000) {
        // Excel日付シリアル値の処理
        const excelDate = new Date((Number(dateValue) - 25569) * 86400 * 1000);
        displayDate = `${excelDate.getMonth() + 1}/${excelDate.getDate()}`;
      } else if (!isNaN(Number(dateValue)) && Number(dateValue) < 32) {
        // 単純な日付数値（1-31）の場合
        displayDate = `${dateValue}日`;
      }
      
      // 売上値の取得（複数の売上列から適切な値を選択）
      let salesValue = row[salesCol];
      
      // もし売上値が無効な場合、他の数値列を探す
      if (!salesValue || salesValue === '' || parseNumber(salesValue) === 0) {
        // 全ての列から数値を探す
        for (const key of Object.keys(row)) {
          const val = row[key];
          const num = parseNumber(val);
          if (num > 0 && key !== dateCol) {
            salesValue = val;
            console.log(`行${index}: 代替売上列 "${key}" を使用: ${val}`);
            break;
          }
        }
      }
      
      const sales = parseNumber(salesValue);
      
      if (index < 10) {
        console.log(`行${index}:`, { 
          displayDate, 
          salesValue, 
          sales, 
          originalDate: row[dateCol],
          allColumns: Object.keys(row)
        });
      }
      
      const shortDate = displayDate.length > 15 ? displayDate.substring(0, 15) : displayDate;
      
      if (dailyMap.has(shortDate)) {
        dailyMap.set(shortDate, dailyMap.get(shortDate) + sales);
      } else {
        dailyMap.set(shortDate, sales);
      }
    });

    // Map を配列に変換
    dailyMap.forEach((value, key) => {
      monthlyData.push({ 
        month: key,
        sales: value 
      });
    });

    console.log('monthlyData:', monthlyData); // デバッグ用

    // 商品別売上を集計（商品カラムがある場合）
    if (productCol && productCol !== salesCol) {
      const productMap = new Map();
      salesData.forEach(row => {
        const product = String(row[productCol] || '不明');
        const sales = parseNumber(row[salesCol]);
        
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
      // 商品カラムがない場合は、曜日別や日別の集計を表示
      const dayMap = new Map();
      const dayOfWeeks = ['日', '月', '火', '水', '木', '金', '土'];
      
      salesData.forEach(row => {
        // 日付列から曜日を判定
        let dayKey = '不明';
        const dateValue = row[dateCol];
        
        // 曜日列がある場合
        if (dayOfWeeks.includes(String(dateValue))) {
          dayKey = String(dateValue);
        } else if (dateValue) {
          // 日付から曜日を推定（簡易的に日別として扱う）
          dayKey = String(dateValue).substring(0, 10);
        }
        
        const sales = parseNumber(row[salesCol]);
        if (dayMap.has(dayKey)) {
          dayMap.set(dayKey, dayMap.get(dayKey) + sales);
        } else {
          dayMap.set(dayKey, sales);
        }
      });
      
      // 上位5つを取得
      const sortedDays = Array.from(dayMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      sortedDays.forEach(([name, value]) => {
        productData.push({ name, value });
      });
      
      // データがない場合のフォールバック
      if (productData.length === 0) {
        productData.push(
          { name: 'データなし', value: 1 }
        );
      }
    }

    // 総売上を計算
    const totalSales = salesData.reduce((sum, row) => {
      return sum + parseNumber(row[salesCol]);
    }, 0);

    console.log('最終結果:', { monthlyData, productData, totalSales }); // デバッグ用

    return { monthlyData, productData, analysis, totalSales };
  };

  // ファイル処理の共通関数
  const processFile = (file: File) => {
    if (!file) return;

    console.log('🔍 ファイル処理開始:', file.name);

    // ファイル形式の確認
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
      setResponse(`❌ サポートされていないファイル形式です。CSV、Excel形式のファイルをアップロードしてください。`);
      return;
    }

    // Excelファイルの場合
    if (['xlsx', 'xls'].includes(fileExtension)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          // より詳細な読み取りオプションを設定
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            raw: false,     // 値を文字列として取得
            dateNF: 'yyyy/mm/dd',  // 日付フォーマット
            defval: ''      // 空セルのデフォルト値
          });
          
          console.log('📊 Excel解析完了:', jsonData);
          console.log('📊 全シート名:', workbook.SheetNames);
          console.log('📊 使用シート:', sheetName);
          console.log('📊 生データ（最初の5行）:', jsonData.slice(0, 5));
          
          // データが空でないかチェック
          if (!jsonData || jsonData.length === 0) {
            setResponse(`❌ Excelファイルにデータが含まれていません。`);
            return;
          }
          
          // データの最初の数行をチェックして適切なヘッダー行を検出
          console.log('📊 全データ（最初の5行）:');
          jsonData.slice(0, 5).forEach((row, index) => {
            console.log(`  行${index}:`, row);
          });
          
          // 複数行ヘッダーに対応したヘッダー行検出（改善版）
          let headerRowIndex = 0;
          let headers: string[] = [];
          let multiHeaders: string[][] = [];
          
          // マルチヘッダーを検出（最初の行が「売上」のような大項目の可能性）
          let firstRowHasMainHeader = false;
          if (jsonData.length > 1) {
            const firstRow = jsonData[0] as any[];
            const secondRow = jsonData[1] as any[];
            
            // 最初の行に少数の文字列があり、2行目により多くの文字列がある場合
            const firstRowText = firstRow.filter(cell => cell && String(cell).trim() !== '').length;
            const secondRowText = secondRow.filter(cell => cell && String(cell).trim() !== '').length;
            
            if (firstRowText < secondRowText && firstRowText > 0) {
              firstRowHasMainHeader = true;
              multiHeaders.push(firstRow);
              console.log('📊 マルチヘッダー検出: 行0が大項目ヘッダー:', firstRow);
            }
          }
          
          // 実際のヘッダー行を探す（マルチヘッダーの場合は2行目から）
          const startIndex = firstRowHasMainHeader ? 1 : 0;
          
          for (let i = startIndex; i < Math.min(8, jsonData.length); i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;
            
            // 曜日パターンをチェック
            const hasDayOfWeek = row.some(cell => {
              const str = String(cell).trim();
              return ['日', '月', '火', '水', '木', '金', '土', 
                      '日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜',
                      'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].includes(str);
            });
            
            // 数値ではなく文字列が多い行、または曜日を含む行をヘッダーとして選択
            const textCells = row.filter(cell => {
              if (!cell) return false;
              const str = String(cell).trim();
              if (str === '') return false;
              const cleanedStr = str.replace(/[,¥円\s%]/g, '');
              return isNaN(Number(cleanedStr)) || hasDayOfWeek;
            });
            
            console.log(`行${i}: 文字列セル数=${textCells.length}/${row.length}, 曜日含む=${hasDayOfWeek}`, textCells);
            
            // 曜日を含む行、または30%以上が文字列の行をヘッダーとして選択
            if (hasDayOfWeek || (textCells.length >= row.length * 0.3 && textCells.length >= 2)) {
              headers = row.map((cell, colIndex) => {
                if (cell && String(cell).trim() !== '') {
                  return String(cell).trim();
                } else if (firstRowHasMainHeader && multiHeaders[0][colIndex]) {
                  // マルチヘッダーの場合、上の行の値を使う
                  return String(multiHeaders[0][colIndex]).trim();
                } else {
                  return `列${colIndex + 1}`;
                }
              });
              headerRowIndex = i;
              console.log(`📊 ヘッダー行として行${i}を選択:`, headers);
              break;
            }
          }
          
          if (headers.length === 0) {
            console.log('❌ 有効なヘッダー行が見つかりません');
            setResponse(`❌ Excelファイルのヘッダー行が検出できません。`);
            return;
          }
          
          const rows = jsonData.slice(headerRowIndex + 1).filter(row => row && (row as any[]).length > 0);
          console.log('📊 データ行数（フィルター後）:', rows.length);
          console.log('📊 データ行サンプル:', rows.slice(0, 3));
          
          // オブジェクト形式に変換
          const results = rows.map((row, rowIndex) => {
            const obj: SalesData = {};
            headers.forEach((header, index) => {
              const value = (row as any[])[index];
              obj[header] = value !== undefined && value !== null ? String(value) : '';
            });
            
            // 最初の3行の変換結果をログ出力
            if (rowIndex < 3) {
              console.log(`📊 行${rowIndex + 1}変換結果:`, obj);
            }
            
            return obj;
          });
          
          console.log('📊 最終変換結果（最初の3件）:', results.slice(0, 3));

          handleDataProcessing(results, file.name);
        } catch (error) {
          console.error('❌ Excelファイル読み込みエラー:', error);
          setResponse(`❌ Excelファイル読み込みエラー: ${error}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSVファイルの場合
      Papa.parse(file, {
        complete: (results) => {
          console.log('📊 Papa.parse完了:', results);
          handleDataProcessing(results.data as SalesData[], file.name);
        },
        header: true,
        skipEmptyLines: true,
        error: (error) => {
          console.error('❌ Papa.parseエラー:', error);
          setResponse(`❌ ファイル読み込みエラー: ${error.message}`)
        }
      });
    }
  }

  // データ処理の共通関数
  const handleDataProcessing = (data: SalesData[], fileName: string) => {
    console.log('📊 解析されたデータ:', data);
    console.log('📊 データ行数:', data.length);
    console.log('📊 最初の3行:', data.slice(0, 3));

    // データが空でないかチェック
    if (!data || data.length === 0) {
      setResponse(`❌ ファイルにデータが含まれていません。`);
      return;
    }

    // ヘッダー行をチェック
    if (data.length > 0) {
      console.log('📊 ヘッダー（カラム名）:', Object.keys(data[0]));
    }

    // ステートにデータを設定
    console.log('💾 ステート設定前 - salesData:', salesData);
    console.log('💾 設定予定のdata:', data);
    
    setSalesData(data)
    setIsFileUploaded(true)
    setShowCharts(true)
    
    // 設定後の確認（次のレンダリングサイクルで確認）
    setTimeout(() => {
      console.log('💾 ステート設定後 - salesData:', salesData);
      console.log('💾 ステート設定後 - isFileUploaded:', true);
    }, 100);
    
    // データ分析情報を表示
    const analysis = analyzeSalesData(data);
    console.log('🔍 分析結果:', analysis);

    let info = `✅ ${fileName} を正常にアップロードしました。\n`;
    info += `📊 データ行数: ${data.length}行\n`;
    
    // カラム名を全て表示
    const columnNames = Object.keys(data[0] || {});
    info += `📋 カラム名: ${columnNames.join(', ')}\n`;
    
    if (analysis) {
      if (analysis.dateColumns.length > 0) {
        info += `📅 検出された日付カラム: ${analysis.dateColumns.join(', ')}\n`;
      }
      if (analysis.salesColumns.length > 0) {
        info += `💰 検出された売上カラム: ${analysis.salesColumns.join(', ')}\n`;
      }
      if (analysis.productColumns.length > 0) {
        info += `📦 検出された商品カラム: ${analysis.productColumns.join(', ')}\n`;
      }
    }
    
    // サンプルデータを詳細表示
    if (data.length > 0) {
      info += `\n📋 データサンプル（最初の3行）:\n`;
      data.slice(0, 3).forEach((row, index) => {
        info += `\n--- 行${index + 1} ---\n`;
        Object.entries(row).forEach(([key, value]) => {
          const displayValue = value === '' ? '(空)' : String(value);
          const valueType = typeof value;
          info += `  ${key}: ${displayValue} (型: ${valueType})\n`;
        });
      });
      
      // データ型の分析
      info += `\n🔍 カラム型分析:\n`;
      if (data.length > 0) {
        Object.keys(data[0]).forEach(key => {
          const sampleValues = data.slice(0, 5).map(row => row[key]).filter(v => v !== '' && v != null);
          const types = [...new Set(sampleValues.map(v => typeof v))];
          const hasNumbers = sampleValues.some(v => {
            const cleanV = String(v).replace(/[,¥円\s$€£]/g, '');
            return !isNaN(Number(cleanV)) && cleanV !== '';
          });
          info += `  ${key}: 型=[${types.join(', ')}] 数値可=${hasNumbers ? 'Yes' : 'No'}\n`;
        });
      }
    }
    
    info += `\n💡 「グラフを表示して」ボタンをクリックすると、データ可視化が表示されます。`;
    setResponse(info);
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

  // JSON形式テスト用関数
  const handleSubmitJSON = async () => {
    if (!prompt.trim()) return

    setIsLoading(true)
    setResponse('')

    console.log('🧪 JSON形式テスト開始');
    console.log('🧪 prompt:', prompt);
    console.log('🧪 salesData:', salesData);

    try {
      const requestBody = {
        prompt: prompt,
        salesData: salesData,
        dataContext: `データファイル情報: 
- 総行数: ${salesData?.length || 0}行
- 項目: ${salesData && salesData.length > 0 ? Object.keys(salesData[0]).join(', ') : 'なし'}`,
        metadata: {
          columns: salesData && salesData.length > 0 ? Object.keys(salesData[0]) : [],
          totalRows: salesData?.length || 0
        },
        responseFormat: 'json'  // JSON形式を指定
      };

      console.log('🧪 送信データ:', requestBody);

      const response = await axios.post(API_ENDPOINT, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('🧪 JSON形式レスポンス:', response.data);
      
      // 構造化されたJSONレスポンスを表示
      if (response.data.response && typeof response.data.response === 'object') {
        const jsonResponse = response.data.response;
        let displayText = `📋 分析結果 (JSON形式)\n\n`;
        displayText += `【概要】\n${jsonResponse.summary || 'サマリーなし'}\n\n`;
        
        if (jsonResponse.key_insights && jsonResponse.key_insights.length > 0) {
          displayText += `【主な発見】\n${jsonResponse.key_insights.map(insight => `• ${insight}`).join('\n')}\n\n`;
        }
        
        if (jsonResponse.recommendations && jsonResponse.recommendations.length > 0) {
          displayText += `【推奨事項】\n${jsonResponse.recommendations.map(rec => `• ${rec}`).join('\n')}\n\n`;
        }
        
        displayText += `【データ分析情報】\n処理済みレコード数: ${jsonResponse.data_analysis?.total_records || 0}件\n\n`;
        displayText += `詳細は開発者コンソールで確認してください。`;
        
        setResponse(displayText);
      } else {
        setResponse(response.data.response || 'JSON形式での応答がありませんでした');
      }
    } catch (error: any) {
      console.error('❌ JSON形式テストエラー:', error);
      setResponse(`**JSON形式テストエラー:** ${error.response?.data?.message || error.message}`);
    }

    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return

    setIsLoading(true)
    setResponse('')

    // デバッグ情報を出力
    console.log('🚀 handleSubmit開始');
    console.log('🚀 prompt:', prompt);
    console.log('🚀 isFileUploaded:', isFileUploaded);
    console.log('🚀 salesData:', salesData);
    console.log('🚀 salesData.length:', salesData?.length);


    // 「グラフを表示して」の場合は、API呼び出しなしでローカルでグラフを表示
    if (prompt.includes('グラフ') && isFileUploaded) {
      setIsLoading(false)
      setResponse('📊 データを可視化しています...\n\n以下のグラフで売上データを確認できます：\n• 月別売上推移\n• 商品別売上構成')
      return
    }

    try {
      // 売上データの準備と最適化
      let dataToSend = null;
      let dataContext = '';
      
      if (isFileUploaded && salesData.length > 0) {
        // データサイズを制限（最初の50行に増やす）
        const limitedData = salesData.slice(0, 50);
        dataToSend = limitedData;
        
        // データの概要をテキスト形式でも準備
        const columns = Object.keys(salesData[0]);
        dataContext = `データファイル情報:\n`;
        dataContext += `- 総行数: ${salesData.length}行\n`;
        dataContext += `- カラム: ${columns.join(', ')}\n`;
        dataContext += `- サンプルデータ（最初の3行）:\n`;
        
        limitedData.slice(0, 3).forEach((row, index) => {
          dataContext += `  行${index + 1}: `;
          dataContext += Object.entries(row).map(([key, value]) => `${key}=${value}`).join(', ');
          dataContext += `\n`;
        });
        
        console.log('🚀 送信予定データ:', dataToSend);
        console.log('🚀 データコンテキスト:', dataContext);
      }
      
      // プロンプトに実データを直接埋め込み
      let enhancedPrompt = prompt;
      if (isFileUploaded && salesData.length > 0) {
        const columns = Object.keys(salesData[0]);
        
        // 最初の5行の実データを文字列として整理
        let dataTable = '\n【実際のデータ】\n';
        dataTable += columns.join('\t') + '\n';
        dataTable += '─'.repeat(80) + '\n';
        
        salesData.slice(0, Math.min(10, salesData.length)).forEach((row, index) => {
          const rowData = columns.map(col => {
            const value = row[col];
            return value === '' || value == null ? '(空)' : String(value);
          }).join('\t');
          dataTable += `${index + 1}行目: ${rowData}\n`;
        });
        
        if (salesData.length > 10) {
          dataTable += `\n... (残り${salesData.length - 10}行のデータがあります)\n`;
        }
        
        // 数値データの統計も追加
        const numericData = [];
        columns.forEach(col => {
          const values = salesData.map(row => {
            const val = String(row[col] || '').replace(/[,¥円\s]/g, '');
            return isNaN(Number(val)) ? null : Number(val);
          }).filter(v => v !== null && v !== 0);
          
          if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const max = Math.max(...values);
            const min = Math.min(...values);
            numericData.push(`${col}: 合計=${sum.toLocaleString()}, 平均=${Math.round(avg).toLocaleString()}, 最大=${max.toLocaleString()}, 最小=${min.toLocaleString()}`);
          }
        });
        
        if (numericData.length > 0) {
          dataTable += '\n【数値データの統計】\n';
          dataTable += numericData.join('\n') + '\n';
        }

        enhancedPrompt = `【必須】上記の実データを使用して分析してください。架空のデータや仮想的な数値は一切使用禁止です。

${dataTable}

ユーザーの質問: ${prompt}

【分析指示】
- 必ず上記の実際の数値のみを使用してください
- period11やperiod28などの存在しない項目は作成しないでください
- 実際のカラム名（${columns.join(', ')}）のみを使用してください
- 架空の分析結果は絶対に作成しないでください
- 実データに基づいた具体的な数値で分析してください`;
      }

      // より構造化されたリクエストデータ（複数形式で送信）
      const requestData = {
        prompt: enhancedPrompt,
        // 以下の3つの形式でデータを送信
        salesData: dataToSend,  // 元の形式
        data: dataToSend,       // 汎用的な形式
        attachments: dataToSend, // 添付ファイル形式
        dataContext: dataContext,
        metadata: {
          hasData: isFileUploaded,
          totalRows: salesData?.length || 0,
          columns: salesData && salesData.length > 0 ? Object.keys(salesData[0]) : [],
          dataType: 'sales'
        },
        // システムメッセージとして追加
        systemMessage: `データが添付されています。${dataToSend?.length || 0}行のデータを受信しました。このデータを使用して分析を行ってください。`
      };

      console.log('🚀 最終送信データ構造:', {
        prompt: requestData.prompt,
        dataRows: requestData.data?.length,
        contextLength: requestData.dataContext.length,
        metadata: requestData.metadata
      });
      console.log('🚀 API_ENDPOINT:', API_ENDPOINT);
      
      const jsonSize = JSON.stringify(requestData).length;
      console.log('🚀 送信データのJSONサイズ:', jsonSize, 'bytes');
      
      if (jsonSize > 1024 * 1024) { // 1MB制限
        console.warn('⚠️ データサイズが大きすぎます');
        setResponse('⚠️ データサイズが大きすぎるため、データを削減して再試行してください。');
        return;
      }

      const result = await axios.post(API_ENDPOINT, requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000 // 60秒のタイムアウト
      })
      
      console.log('🚀 API応答:', result.data);
      setResponse(result.data.response || result.data.message || JSON.stringify(result.data))
    } catch (error: any) {
      console.error('❌ API Error詳細:', error);
      console.error('❌ Error Config:', error.config);
      console.error('❌ Error Response:', error.response);
      console.error('❌ Error Request:', error.request);
      
      let errorMessage = '🔴 **APIエラーが発生しました:**\n\n';
      
      if (error.response) {
        // サーバーからエラーレスポンスが返された
        errorMessage += `**ステータスコード:** ${error.response.status}\n`;
        errorMessage += `**ステータステキスト:** ${error.response.statusText}\n`;
        
        if (error.response.data) {
          errorMessage += `**サーバーメッセージ:** ${JSON.stringify(error.response.data, null, 2)}\n`;
        }
        
        // 一般的なHTTPステータスコードの説明
        if (error.response.status === 413) {
          errorMessage += '\n💡 **原因:** データサイズが大きすぎます。より少ないデータで試してください。';
        } else if (error.response.status === 500) {
          errorMessage += '\n💡 **原因:** サーバー内部エラー。APIサーバー側の問題です。';
        } else if (error.response.status === 400) {
          errorMessage += '\n💡 **原因:** リクエスト形式に問題があります。';
        }
        
      } else if (error.request) {
        // リクエストは送信されたが、レスポンスがない
        errorMessage += '**問題:** APIサーバーからのレスポンスがありません。\n';
        errorMessage += '**可能な原因:**\n';
        errorMessage += '• ネットワーク接続の問題\n';
        errorMessage += '• CORSポリシーの問題\n';
        errorMessage += '• APIサーバーがダウンしている\n';
        errorMessage += `• タイムアウト（${error.config?.timeout || 60000}ms）\n`;
        
      } else {
        // その他のエラー
        errorMessage += `**エラーメッセージ:** ${error.message}\n`;
      }
      
      errorMessage += `\n🔧 **デバッグ情報:**\n`;
      errorMessage += `• API URL: ${API_ENDPOINT}\n`;
      errorMessage += `• データ送信: ${isFileUploaded ? 'あり' : 'なし'}\n`;
      errorMessage += `• データ行数: ${salesData?.length || 0}\n`;
      
      setResponse(errorMessage);
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
        
        {/* グラフ表示ボタンとプリセット質問 */}
        {isFileUploaded && (
          <div style={{ marginTop: '15px' }}>
            {/* 大きなグラフ表示ボタン */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <button
                onClick={() => {
                  console.log('📊 グラフ表示ボタンがクリックされました');
                  console.log('📊 現在のsalesData:', salesData);
                  console.log('📊 salesData長さ:', salesData?.length);
                  
                  // プロンプトに影響せずにグラフを表示
                  setForceShowGraphs(true);
                  setShowDataTable(false);
                  setShowCharts(true);
                  
                  // データの存在確認
                  if (salesData && salesData.length > 0) {
                    setResponse(`📊 データを可視化しています...\n\n実データ（${salesData.length}行）を使用してグラフを生成します：\n• 期間別売上推移\n• データ構成比較\n• データサマリー`);
                  } else {
                    setResponse('⚠️ データがロードされていません。先にファイルをアップロードしてください。');
                  }
                }}
                style={{
                  flex: 1,
                  padding: '15px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                disabled={isLoading}
              >
                📊 グラフを表示
              </button>
              
              <button
                onClick={() => {
                  console.log('📋 データテーブル表示ボタンがクリックされました');
                  setShowDataTable(!showDataTable);
                  setForceShowGraphs(false);
                  if (salesData && salesData.length > 0) {
                    setResponse(`📋 データテーブルを${showDataTable ? '非表示' : '表示'}にしました`);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '15px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#545b62'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
                disabled={isLoading}
              >
                📋 データテーブル{showDataTable ? '非表示' : '表示'}
              </button>
            </div>

            {/* 学習ボタンを追加 */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => {
                  console.log('📚 データ学習ボタンがクリックされました');
                  checkSupabaseConfig(); // デバッグ情報を出力
                  setShowColumnMapping(true);
                }}
                style={{
                  flex: 1,
                  padding: '15px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
                disabled={isLoading}
              >
                📚 データを学習
              </button>
            </div>
            
            <p style={{ fontSize: '14px', color: '#555', margin: '5px 0' }}>AIに質問する：</p>
            {[
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

      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1 }}>
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
            {isLoading ? '処理中...' : '💬 AIに質問する（テキスト形式）'}
          </button>
          <p style={{ 
            margin: '5px 0 0 0', 
            fontSize: '11px', 
            color: '#666',
            textAlign: 'center'
          }}>
            分析結果を文章で説明してほしいとき
          </p>
        </div>
        
        <div style={{ flex: 1 }}>
          <button
            onClick={handleSubmitJSON}
            disabled={isLoading || !prompt.trim()}
            style={{
              width: '100%',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: isLoading || !prompt.trim() ? '#ccc' : '#28a745',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading || !prompt.trim() ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.3s'
            }}
          >
            📊 AIに質問する（データ形式）
          </button>
          <p style={{ 
            margin: '5px 0 0 0', 
            fontSize: '11px', 
            color: '#666',
            textAlign: 'center'
          }}>
            数値ベースの詳細な分析データが欲しいとき
          </p>
        </div>
      </div>

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

      {/* データテーブル表示セクション */}
      {showDataTable && isFileUploaded && salesData.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>📋 データテーブル表示</h2>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            overflowX: 'auto'
          }}>
            <p style={{ marginBottom: '15px', color: '#666' }}>
              総行数: {salesData.length}行 | 表示: 最初の10行
            </p>
            
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>行番号</th>
                  {salesData.length > 0 && Object.keys(salesData[0]).map(key => (
                    <th key={key} style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salesData.slice(0, 10).map((row, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9' }}>
                    <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold', backgroundColor: '#e9ecef' }}>
                      {index + 1}
                    </td>
                    {Object.entries(row).map(([key, value]) => (
                      <td key={key} style={{ padding: '8px', border: '1px solid #ddd' }}>
                        {value === '' || value === null || value === undefined ? 
                          <span style={{ color: '#999', fontStyle: 'italic' }}>(空)</span> : 
                          String(value)
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {salesData.length > 10 && (
              <p style={{ marginTop: '10px', color: '#666', fontSize: '12px' }}>
                ※ 最初の10行のみ表示しています（全{salesData.length}行）
              </p>
            )}
          </div>
        </div>
      )}

      {/* データ可視化セクション */}
      {showCharts && isFileUploaded && (forceShowGraphs || prompt.includes('グラフ')) && (() => {
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

      {/* カラムマッピング学習モーダル */}
      {showColumnMapping && isFileUploaded && salesData.length > 0 && (
        <ColumnMappingLearning
          columns={Object.keys(salesData[0])}
          onSave={async (mappings) => {
            console.log('📚 学習データ保存:', mappings);
            setColumnMappings(mappings);
            
            // Supabaseに保存
            const tenantId = 'default'; // TODO: 実際のテナントIDを使用
            const headers = Object.keys(salesData[0]);
            
            setResponse('📊 学習データを保存中...');
            const result = await saveFormatProfile(tenantId, headers, mappings);
            
            if (result.success) {
              setResponse(`✅ カラムマッピングを学習・保存しました！\n\n保存内容:\n${JSON.stringify(mappings, null, 2)}`);
              console.log('✅ Supabase保存成功:', result.profile);
            } else {
              setResponse(`⚠️ カラムマッピングは学習しましたが、クラウド保存に失敗しました。\n\nエラー: ${result.error}`);
              console.error('❌ Supabase保存失敗:', result.error);
            }
            
            setShowColumnMapping(false);
          }}
          onCancel={() => {
            console.log('📚 学習をキャンセル');
            setShowColumnMapping(false);
          }}
        />
      )}
    </div>
  )
}

export default App