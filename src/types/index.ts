/**
 * Central type definitions for Smart Image Analysis Platform
 * Provides comprehensive type safety across all components
 */

// Core Application Types
export interface UploadedFile {
  readonly file: File
  readonly previewUrl: string
  readonly base64Data: string
}

export interface ImageAnalysisResult {
  readonly extractedText: string
  readonly confidence: number
  readonly analysis: string
  readonly metadata: {
    readonly fileSize: number
    readonly fileType: string
    readonly dimensions?: {
      readonly width: number
      readonly height: number
    }
    readonly processingTime?: number
  }
}

export type AnalysisStatus = 'idle' | 'processing' | 'completed' | 'error'

// API Types
export interface APIResponse<T = unknown> {
  readonly status: 'success' | 'error'
  readonly result?: T
  readonly error?: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface AnalysisRequest {
  readonly prompt: string
  readonly image_data: string
  readonly analysisType?: string
  readonly customInstructions?: string
  readonly filename?: string
  readonly fileSize?: number
  readonly fileType?: string
  readonly mimeType?: string
}

// Component Props Types
export interface BaseComponentProps {
  readonly className?: string
  readonly 'data-testid'?: string
}

export interface FileUploadProps extends BaseComponentProps {
  readonly onFileUploaded: (file: UploadedFile) => void
  readonly isAnalyzing: boolean
  readonly accept?: string
  readonly maxSize?: number
}

export interface AnalysisProps extends BaseComponentProps {
  readonly onStartAnalysis: (type: string, instructions: string) => void
  readonly isAnalyzing: boolean
  readonly hasFile: boolean
}

export interface ResultDisplayProps extends BaseComponentProps {
  readonly result: ImageAnalysisResult | null
  readonly isLoading: boolean
}

// Utility Types
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

export type NonNullable<T> = T extends null | undefined ? never : T

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Environment Configuration
export interface AppEnvironment {
  readonly NODE_ENV: 'development' | 'production' | 'test'
  readonly API_ENDPOINT?: string
  readonly DEBUG?: boolean
}

// Error Types (re-exported for convenience)
export type { ErrorType, AppError, SmartImageError } from '../utils/errorHandler'