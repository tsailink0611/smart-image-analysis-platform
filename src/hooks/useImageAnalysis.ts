import { useState } from 'react'
import { UploadedFile, ImageAnalysisResult, AnalysisStatus } from '../types'
import { logger } from '../utils/logger'

const API_ENDPOINT = 'https://rzddt4m5k6mllt2kkl7xa7rokm0urcjs.lambda-url.us-east-1.on.aws/'

export function useImageAnalysis() {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [result, setResult] = useState<ImageAnalysisResult | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('idle')

  const startAnalysis = async (type: string, instructions: string) => {
    if (!uploadedFile) {
      throw new Error('画像ファイルをアップロードしてください')
    }

    setStatus('processing')
    setResult(null)

    const requestBody = {
      prompt: instructions || 'この画像・文書を詳細に分析してください。',
      image_data: uploadedFile.base64Data.split(',')[1] || uploadedFile.base64Data,
      analysisType: type,
      customInstructions: instructions,
      filename: uploadedFile.file.name,
      fileSize: uploadedFile.file.size,
      fileType: 'image',
      mimeType: uploadedFile.file.type,
    }

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const analysisResult = await response.json()

      setResult({
        extractedText: analysisResult.result || analysisResult.extractedText || '',
        confidence: analysisResult.confidence || 95,
        analysis: analysisResult.result || analysisResult.analysis || '',
        metadata: {
          fileSize: uploadedFile.file.size,
          fileType: uploadedFile.file.type,
          dimensions: analysisResult.dimensions,
          processingTime: analysisResult.processingTime,
        },
      })
      setStatus('completed')
    } catch (error) {
      logger.error('Image analysis failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'useImageAnalysis',
        operation: 'startAnalysis',
        fileType: uploadedFile?.file.type,
        fileSize: uploadedFile?.file.size
      })
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

  const resetAnalysis = () => {
    setResult(null)
    setStatus('idle')
  }

  return {
    uploadedFile,
    setUploadedFile,
    result,
    status,
    startAnalysis,
    resetAnalysis
  }
}