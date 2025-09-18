import ImageUpload from './components/ImageUpload'
import DocumentAnalysis from './components/DocumentAnalysis'
import ResultDisplay from './components/ResultDisplay'
import Header from './components/Header'
import Footer from './components/Footer'
import { useImageAnalysis } from './hooks/useImageAnalysis'
import { UploadedFile } from './types'

function App() {
  const {
    uploadedFile,
    setUploadedFile,
    result,
    status,
    startAnalysis,
    resetAnalysis
  } = useImageAnalysis()

  const handleFileUploaded = (file: UploadedFile) => {
    setUploadedFile(file)
    resetAnalysis()
  }

  const handleAnalysisStart = async (type: string, instructions: string) => {
    try {
      await startAnalysis(type, instructions)
    } catch (error) {
      alert(error instanceof Error ? error.message : '不明なエラー')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <Header />

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

        <Footer />
      </div>
    </div>
  )
}

export default App