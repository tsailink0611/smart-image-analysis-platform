export interface UploadedFile {
  file: File
  previewUrl: string
  base64Data: string
}

export interface ImageAnalysisResult {
  extractedText: string
  confidence: number
  analysis: string
  metadata: {
    fileSize?: number
    fileType?: string
    dimensions?: {
      width: number
      height: number
    }
    processingTime?: number
  }
}

export type AnalysisStatus = 'idle' | 'processing' | 'completed' | 'error'