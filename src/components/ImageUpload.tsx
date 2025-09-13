import React, { useState, useRef, DragEvent } from 'react'

interface UploadedFile {
  file: File
  previewUrl: string
  base64Data: string
}

interface ImageUploadProps {
  onFileUploaded: (uploadedFile: UploadedFile) => void
  isAnalyzing: boolean
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onFileUploaded, isAnalyzing }) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('画像ファイルまたはPDFファイルを選択してください')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    
    // Base64エンコード
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsDataURL(file)
    })

    const uploadedFile = {
      file,
      previewUrl,
      base64Data
    }

    setUploadedFile(uploadedFile)
    onFileUploaded(uploadedFile)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = '' // ファイル選択をリセット
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleRemoveFile = () => {
    if (uploadedFile) {
      URL.revokeObjectURL(uploadedFile.previewUrl)
    }
    setUploadedFile(null)
  }

  return (
    <div className="space-y-4">
      {!uploadedFile ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${isAnalyzing ? 'opacity-50 pointer-events-none' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="space-y-4">
            <div className="text-6xl text-gray-400">📁</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                画像・文書をアップロード
              </h3>
              <p className="text-gray-500 text-sm">
                ファイルをドラッグ&ドロップするか、クリックして選択
              </p>
              <p className="text-gray-400 text-xs mt-2">
                対応形式: PNG, JPG, PDF, WebP, BMP, TIFF
              </p>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleInputChange}
            className="hidden"
            disabled={isAnalyzing}
          />
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              {uploadedFile.file.type.startsWith('image/') ? (
                <img
                  src={uploadedFile.previewUrl}
                  alt="アップロード画像"
                  className="w-24 h-24 object-cover rounded-lg"
                />
              ) : (
                <div className="w-24 h-24 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📄</span>
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">
                {uploadedFile.file.name}
              </h4>
              <p className="text-sm text-gray-500">
                {(uploadedFile.file.size / 1024).toFixed(1)} KB
              </p>
              <p className="text-sm text-gray-500">
                {uploadedFile.file.type}
              </p>
            </div>
            
            <button
              onClick={handleRemoveFile}
              disabled={isAnalyzing}
              className="text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              🗑️
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageUpload