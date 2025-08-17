import { useState } from 'react'
import axios from 'axios'

// 開発環境ではプロキシ経由でアクセス
const API_ENDPOINT = import.meta.env.DEV ? "/api" : "https://ylgrnwffx6.execute-api.us-east-1.amazonaws.com";

function App() {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!prompt.trim()) return

    setIsLoading(true)
    setResponse('')

    try {
      const result = await axios.post(API_ENDPOINT, {
        prompt: prompt
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      setResponse(result.data.response || result.data.message || JSON.stringify(result.data))
    } catch (error: any) {
      console.error('API Error:', error)
      
      if (error.response) {
        // サーバーからのエラーレスポンス
        setResponse(`サーバーエラー: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`)
      } else if (error.request) {
        // リクエストは送信されたが、レスポンスなし
        setResponse('APIからレスポンスがありません。CORSエラーの可能性があります。\n\nCORS問題の解決方法:\n1. API Gateway側でCORSを有効にする\n2. またはプロキシサーバーを使用する')
      } else {
        // その他のエラー
        setResponse(`エラー: ${error.message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{
        color: '#333',
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        Strategic AI Platform
      </h1>

      <div style={{
        marginBottom: '20px'
      }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="AIに質問を入力してください..."
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '12px',
            fontSize: '16px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
          disabled={isLoading}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading || !prompt.trim()}
        style={{
          width: '100%',
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: isLoading || !prompt.trim() ? '#ccc' : '#007bff',
          border: 'none',
          borderRadius: '8px',
          cursor: isLoading || !prompt.trim() ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.3s'
        }}
      >
        {isLoading ? '処理中...' : '送信'}
      </button>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        minHeight: '100px',
        whiteSpace: 'pre-wrap'
      }}>
        {isLoading ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            AIが応答を生成しています...
          </div>
        ) : response ? (
          <div style={{ color: '#333', lineHeight: '1.6' }}>
            {response}
          </div>
        ) : (
          <div style={{ color: '#999', fontStyle: 'italic' }}>
            AIの応答がここに表示されます
          </div>
        )}
      </div>
    </div>
  )
}

export default App