import React, { useState } from 'react'
import { ImageAnalysisResult } from '../types'

interface ResultDisplayProps {
  result: ImageAnalysisResult | null
  isLoading: boolean
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'analysis' | 'metadata'>('text')

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">分析処理中...</span>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <div className="text-4xl mb-4 text-gray-400">📊</div>
        <p className="text-gray-500">分析結果がここに表示されます</p>
      </div>
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('クリップボードにコピーしました'))
      .catch(() => alert('コピーに失敗しました'))
  }

  const downloadAsText = () => {
    const content = `抽出テキスト:\n${result.extractedText}\n\n分析結果:\n${result.analysis}`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-result-${new Date().toISOString().slice(0, 19)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Tab Header */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'text'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📄 抽出テキスト
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'analysis'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🤖 Claude 4 分析
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'metadata'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ℹ️ メタデータ
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'text' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">抽出されたテキスト</h3>
              <div className="flex space-x-2">
                <span className="text-sm text-gray-500">
                  信頼度: {result.confidence.toFixed(1)}%
                </span>
                <button
                  onClick={() => copyToClipboard(result.extractedText)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  📋 コピー
                </button>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-700">
                {result.extractedText || 'テキストが検出されませんでした'}
              </pre>
            </div>

            <div className="text-sm text-gray-500">
              文字数: {result.extractedText.length}文字
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">🤖 Claude 4 Sonnet 分析結果</h3>
              <button
                onClick={() => copyToClipboard(result.analysis)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                📋 コピー
              </button>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border-l-4 border-blue-500">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {result.analysis}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded text-xs text-gray-600 flex items-center">
              <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              この分析はClaude 4 Sonnetによる高精度AI分析結果です
            </div>
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800">ファイル情報</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <dt className="font-medium text-gray-600">ファイルサイズ</dt>
                <dd className="text-gray-800">{(result.metadata.fileSize / 1024).toFixed(1)} KB</dd>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <dt className="font-medium text-gray-600">ファイル形式</dt>
                <dd className="text-gray-800">{result.metadata.fileType}</dd>
              </div>

              {result.metadata.dimensions && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <dt className="font-medium text-gray-600">画像サイズ</dt>
                  <dd className="text-gray-800">
                    {result.metadata.dimensions.width} × {result.metadata.dimensions.height} px
                  </dd>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg">
                <dt className="font-medium text-gray-600">処理日時</dt>
                <dd className="text-gray-800">{new Date().toLocaleString('ja-JP')}</dd>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex space-x-3">
          <button
            onClick={downloadAsText}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            💾 結果をダウンロード
          </button>
          
          <button
            onClick={() => copyToClipboard(`抽出テキスト:\n${result.extractedText}\n\n分析結果:\n${result.analysis}`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            📋 全体をコピー
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResultDisplay