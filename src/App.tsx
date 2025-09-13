import { useState } from 'react'
import ImageUpload from './components/ImageUpload'
import DocumentAnalysis from './components/DocumentAnalysis'
import ResultDisplay from './components/ResultDisplay'
import { UploadedFile, ImageAnalysisResult, AnalysisStatus } from './types'

const API_ENDPOINT = '/api/analysis'

function App() {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [analysisType, setAnalysisType] = useState<string>('')
  const [customInstructions, setCustomInstructions] = useState<string>('')
  const [result, setResult] = useState<ImageAnalysisResult | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('idle')

  const handleFileUploaded = (file: UploadedFile) => {
    setUploadedFile(file)
    setResult(null)
    setStatus('idle')
  }

  const handleAnalysisStart = async (type: string, instructions: string) => {
    if (!uploadedFile) return

    setAnalysisType(type)
    setCustomInstructions(instructions)
    setStatus('processing')
    setResult(null)

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: uploadedFile.base64Data,
          analysisType: type,
          customInstructions: instructions,
          filename: uploadedFile.file.name,
          fileSize: uploadedFile.file.size,
          fileType: uploadedFile.file.type,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const analysisResult = await response.json()
      
      setResult({
        extractedText: analysisResult.extractedText || '',
        confidence: analysisResult.confidence || 0,
        analysis: analysisResult.analysis || '',
        metadata: {
          fileSize: uploadedFile.file.size,
          fileType: uploadedFile.file.type,
          dimensions: analysisResult.dimensions,
          processingTime: analysisResult.processingTime,
        },
      })
      setStatus('completed')
    } catch (error) {
      console.error('Analysis failed:', error)
      setResult({
        extractedText: '',
        confidence: 0,
        analysis: `分析に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        metadata: {
          fileSize: uploadedFile.file.size,
          fileType: uploadedFile.file.type,
        },
      })
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-2xl text-white mr-4">
              🤖
            </div>
            <h1 className="text-4xl font-bold text-gray-800">
              Smart Image Analysis Platform
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Claude 4 Sonnetを活用した高精度画像・文書分析システム
          </p>
          <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-800 text-sm font-medium">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
            Powered by Claude 4 Sonnet
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto space-y-8">
          {/* File Upload Section */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="text-2xl mr-3">📁</span>
              ファイルアップロード
            </h2>
            <ImageUpload 
              onFileUploaded={handleFileUploaded} 
              isAnalyzing={status === 'processing'}
            />
          </div>

          {/* Analysis Configuration */}
          {uploadedFile && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <span className="text-2xl mr-3">⚙️</span>
                分析設定
              </h2>
              <DocumentAnalysis 
                onStartAnalysis={(instruction) => handleAnalysisStart('custom', instruction)}
                isAnalyzing={status === 'processing'}
                hasFile={!!uploadedFile}
              />
            </div>
          )}

          {/* Results Section */}
          {(status === 'processing' || result) && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <span className="text-2xl mr-3">📊</span>
                分析結果
              </h2>
              <ResultDisplay 
                result={result} 
                isLoading={status === 'processing'}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <div className="border-t border-gray-200 pt-8">
            <p>© 2024 Smart Image Analysis Platform. Powered by Claude 4 Sonnet.</p>
            <p className="mt-2">OCR + AI分析による次世代文書解析システム</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App