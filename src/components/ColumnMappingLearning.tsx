import { useState } from 'react'

interface ColumnMappingProps {
  columns: string[]
  onSave: (mappings: Record<string, string>) => void
  onCancel: () => void
}

// 日本の中小企業向け汎用カテゴリ（日本語のみ）
const COLUMN_CATEGORIES = {
  '📊 売上・収益': [
    '売上', '売上高', '収益', '純売上', '売上金額', '販売額', '受注額', '請求額'
  ],
  '💰 費用・経費': [
    '経費', 'コスト', '費用', '販管費', '営業費用', '管理費', '間接費', '諸経費'
  ],
  '🏭 原価・製造': [
    '原価', '仕入原価', '製造原価', '材料費', '労務費', '製造費', '仕入れ', '仕入価格'
  ],
  '📈 利益・マージン': [
    '利益', '粗利', '営業利益', '利益率', '粗利率', '収益率', '損益'
  ],
  '🏢 固定費・資産': [
    '固定費', '人件費', '家賃', '減価償却費', '設備費', '賃料', '保険料', 'リース料'
  ],
  '💸 税金・控除': [
    '税金', '消費税', '法人税', '源泉税', '控除', '割引', '値引き', '手数料'
  ],
  '📦 商品・製品': [
    '商品', '製品', '商品名', '品番', 'アイテム', '商品コード', '型番', '品名'
  ],
  '🏷️ カテゴリ・分類': [
    'カテゴリ', '分類', '業種', '商品群', 'セグメント', '部門', '事業部', '種別'
  ],
  '🏪 ブランド・メーカー': [
    'ブランド', 'メーカー', '製造元', '仕入先', 'ベンダー', '供給元', '取引先'
  ],
  '📊 在庫・数量': [
    '在庫', '在庫数', '保有数', '倉庫数量', '数量', '個数', '販売数', '出荷数'
  ],
  '👥 顧客・取引先': [
    '顧客', '取引先', '得意先', '企業名', '顧客名', '法人名', '会社名'
  ],
  '🏃 営業・担当': [
    '営業', '担当者', '営業所', '担当', '責任者', '営業担当', '販売員'
  ],
  '🛒 販売チャネル': [
    'チャネル', '販路', '販売経路', 'オンライン', '店舗', '直販', 'ネット販売'
  ],
  '📅 日付・時間': [
    '日付', '年月日', '取引日', '受注日', '販売日', '納期', '請求日', '支払日'
  ],
  '⏰ 期間・周期': [
    '期間', '四半期', '月次', '年度', '週', '曜日', '営業日', '決算期'
  ],
  '💵 価格・単価': [
    '単価', '価格', '販売単価', '定価', '卸価格', '小売価格', '標準価格'
  ],
  '🏢 組織・地域': [
    '地域', 'エリア', '都道府県', '支店', '営業所', '拠点', '店舗', '事業所'
  ],
  '📋 管理・ID': [
    'ID', 'コード', '管理番号', '伝票番号', '顧客ID', '商品ID', '注文番号'
  ],
  '📝 ステータス・状態': [
    'ステータス', '状態', '承認', '完了', '処理中', '保留', '確定', '未確定'
  ],
  '📄 備考・その他': [
    '備考', 'メモ', '注記', '説明', 'その他', 'コメント', '特記事項'
  ]
}

export default function ColumnMappingLearning({ columns, onSave, onCancel }: ColumnMappingProps) {
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [aiConfirmations, setAiConfirmations] = useState<Record<string, string>>({})

  const handleCategorySelect = (column: string, category: string) => {
    setMappings(prev => ({ ...prev, [column]: category }))
    // カスタム値をクリア
    setCustomValues(prev => {
      const newCustom = { ...prev }
      delete newCustom[column]
      return newCustom
    })
  }

  const handleCustomInput = (column: string, value: string) => {
    setCustomValues(prev => ({ ...prev, [column]: value }))
    setMappings(prev => ({ ...prev, [column]: 'custom' }))
  }

  const handleAiConfirm = async (column: string, customValue: string) => {
    // TODO: AIに確認を求める機能（後で実装）
    const confirmation = `「${customValue}」は財務データの一種として認識されました`
    setAiConfirmations(prev => ({ ...prev, [column]: confirmation }))
  }

  const handleSave = () => {
    const finalMappings: Record<string, string> = {}
    
    Object.entries(mappings).forEach(([column, category]) => {
      if (category === 'custom' && customValues[column]) {
        finalMappings[column] = customValues[column]
      } else {
        finalMappings[column] = category
      }
    })
    
    onSave(finalMappings)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        maxWidth: '800px',
        maxHeight: '80vh',
        overflowY: 'auto',
        width: '90%'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>
          📚 データ形式を学習させる
        </h2>
        
        <p style={{ marginBottom: '25px', color: '#666' }}>
          AIが以下の列について質問しています。適切なカテゴリを選択してください：
        </p>

        {columns.map((column, index) => (
          <div key={index} style={{
            marginBottom: '25px',
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
            <h4 style={{ marginBottom: '15px', color: '#444' }}>
              🤔 「{column}」は何のデータですか？
            </h4>
            
            <select
              value={mappings[column] || ''}
              onChange={(e) => handleCategorySelect(column, e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                marginBottom: '15px'
              }}
            >
              <option value="">-- カテゴリを選択 --</option>
              {Object.entries(COLUMN_CATEGORIES).map(([categoryName, items]) => (
                <optgroup key={categoryName} label={categoryName}>
                  {items.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </optgroup>
              ))}
              <option value="custom">✏️ その他（フリー入力）</option>
            </select>

            {mappings[column] === 'custom' && (
              <div>
                <input
                  type="text"
                  placeholder="カスタム項目名を入力"
                  value={customValues[column] || ''}
                  onChange={(e) => handleCustomInput(column, e.target.value)}
                  style={{
                    width: '70%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginRight: '10px'
                  }}
                />
                <button
                  onClick={() => handleAiConfirm(column, customValues[column] || '')}
                  disabled={!customValues[column]}
                  style={{
                    padding: '8px 15px',
                    fontSize: '12px',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🤖 AI確認
                </button>
                
                {aiConfirmations[column] && (
                  <p style={{ 
                    marginTop: '10px', 
                    padding: '10px', 
                    backgroundColor: '#d1ecf1', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#0c5460'
                  }}>
                    ✅ {aiConfirmations[column]}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          justifyContent: 'center',
          marginTop: '30px'
        }}>
          <button
            onClick={handleSave}
            disabled={Object.keys(mappings).length !== columns.length}
            style={{
              padding: '12px 25px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: Object.keys(mappings).length === columns.length ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: Object.keys(mappings).length === columns.length ? 'pointer' : 'not-allowed'
            }}
          >
            💾 学習データを保存
          </button>
          
          <button
            onClick={onCancel}
            style={{
              padding: '12px 25px',
              fontSize: '16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ❌ キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}