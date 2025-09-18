import { useState } from 'react'
import { UploadedFile, ImageAnalysisResult, AnalysisStatus } from '../types'
import { logger } from '../utils/logger'
import { validateTextInput, sanitizeTextInput, checkRateLimit } from '../utils/security'
import { createError, handleError } from '../utils/errorHandler'

const API_ENDPOINT = 'https://rzddt4m5k6mllt2kkl7xa7rokm0urcjs.lambda-url.us-east-1.on.aws/'

export function useImageAnalysis() {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [result, setResult] = useState<ImageAnalysisResult | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('idle')

  const startAnalysis = async (type: string, instructions: string) => {
    if (!uploadedFile) {
      throw createError.validation('画像ファイルをアップロードしてください')
    }

    // Security validations
    if (!validateTextInput(instructions, 500)) {
      throw createError.validation('指示文に不正な文字が含まれているか、長すぎます')
    }

    // Rate limiting (simple client-side check)
    const userIdentifier = 'user-session' // In production, use actual user ID
    if (!checkRateLimit(userIdentifier, 5, 60000)) {
      throw createError.permission('リクエスト回数が上限を超えました。しばらく時間をおいてからお試しください')
    }

    setStatus('processing')
    setResult(null)

    const sanitizedInstructions = sanitizeTextInput(instructions || 'この画像・文書を詳細に分析してください。')

    const requestBody = {
      prompt: sanitizedInstructions,
      image_data: uploadedFile.base64Data.split(',')[1] || uploadedFile.base64Data,
      analysisType: type,
      customInstructions: sanitizedInstructions,
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
      const errorMessage = handleError(
        error instanceof Error ? error : new Error(String(error)),
        'useImageAnalysis',
        'startAnalysis'
      )
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