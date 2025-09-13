import React from 'react'

interface DocumentAnalysisProps {
  onStartAnalysis: (instruction: string) => void
  isAnalyzing: boolean
  hasFile: boolean
}

const ANALYSIS_PROMPTS = [
  {
    id: 'general',
    title: '📋 一般的な分析',
    description: '画像・文書の内容を包括的に分析',
    prompt: 'この画像・文書を日本語で分析し、内容を要約してください。重要なポイントを整理して教えてください。'
  },
  {
    id: 'business',
    title: '💼 ビジネス文書分析',
    description: '契約書、請求書、報告書などの分析',
    prompt: 'このビジネス文書を分析し、重要な情報（金額、日付、当事者、条件など）を抽出して整理してください。'
  },
  {
    id: 'data',
    title: '📊 データ・表分析',
    description: '表、グラフ、データの構造化',
    prompt: 'この画像に含まれるデータや表を分析し、数値やトレンド、重要な洞察を日本語で説明してください。'
  },
  {
    id: 'technical',
    title: '🔧 技術文書分析',
    description: 'エラー画面、ログ、技術的内容の分析',
    prompt: 'この技術的な内容を分析し、問題の特定、原因の推測、解決策の提案を日本語で行ってください。'
  },
  {
    id: 'custom',
    title: '✏️ カスタム分析',
    description: '独自の指示で分析実行',
    prompt: ''
  }
]

const DocumentAnalysis: React.FC<DocumentAnalysisProps> = ({ 
  onStartAnalysis, 
  isAnalyzing, 
  hasFile 
}) => {
  const [selectedPrompt, setSelectedPrompt] = React.useState('general')
  const [customInstruction, setCustomInstruction] = React.useState('')

  const handleAnalysisStart = () => {
    const selectedPromptData = ANALYSIS_PROMPTS.find(p => p.id === selectedPrompt)
    if (!selectedPromptData) return

    let instruction = selectedPromptData.prompt
    if (selectedPrompt === 'custom' && customInstruction) {
      instruction = customInstruction
    }

    if (!instruction.trim()) {
      alert('分析指示を入力してください')
      return
    }

    onStartAnalysis(instruction)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🤖 AI分析タイプを選択
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ANALYSIS_PROMPTS.map((prompt) => (
            <div
              key={prompt.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedPrompt === prompt.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedPrompt(prompt.id)}
            >
              <div className="flex items-start space-x-3">
                <input
                  type="radio"
                  checked={selectedPrompt === prompt.id}
                  onChange={() => setSelectedPrompt(prompt.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {prompt.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {prompt.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedPrompt === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            カスタム分析指示
          </label>
          <textarea
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="どのような分析を行いたいか、具体的に指示してください..."
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={handleAnalysisStart}
          disabled={!hasFile || isAnalyzing}
          className={`px-8 py-3 rounded-lg font-medium transition-colors ${
            !hasFile || isAnalyzing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isAnalyzing ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>Claude 4 Sonnet 分析中...</span>
            </div>
          ) : (
            '🚀 AI分析を開始'
          )}
        </button>
      </div>
    </div>
  )
}

export default DocumentAnalysis