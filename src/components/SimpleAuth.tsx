import { useState } from 'react'

interface User {
  id: string
  name: string
  company: string
  usageCount: number
  usageLimit: number
  plan: 'basic' | 'standard' | 'premium' | 'enterprise'
  allowedAnalysisTypes: string[]
}

interface SimpleAuthProps {
  onLogin: (user: User) => void
}

// デモ用アカウント（料金プラン別権限設定）
const DEMO_ACCOUNTS: Record<string, { password: string; user: User }> = {
  "demo": {
    password: "demo123",
    user: {
      id: "demo",
      name: "デモ ユーザー",
      company: "デモ会社",
      usageCount: 0,
      usageLimit: 10,
      plan: "basic",
      allowedAnalysisTypes: ["sales"] // 3万円プラン：売上分析のみ
    }
  },
  "client_abc": {
    password: "abc2024", 
    user: {
      id: "client_abc",
      name: "田中 太郎",
      company: "ABC商事株式会社",
      usageCount: 0,
      usageLimit: 50,
      plan: "premium",
      allowedAnalysisTypes: ["sales", "hr", "marketing"] // 8万円プラン：3機能
    }
  },
  "admin": {
    password: "admin999",
    user: {
      id: "admin", 
      name: "管理者",
      company: "システム管理",
      usageCount: 0,
      usageLimit: 999,
      plan: "enterprise",
      allowedAnalysisTypes: ["sales", "hr", "marketing", "strategic"] // 10万円プラン：全機能
    }
  },
  "basic_user": {
    password: "basic2024",
    user: {
      id: "basic_user",
      name: "ベーシック ユーザー", 
      company: "スタートアップ企業",
      usageCount: 0,
      usageLimit: 20,
      plan: "basic",
      allowedAnalysisTypes: ["sales"] // 3万円プラン：1機能のみ
    }
  },
  "standard_user": {
    password: "standard2024",
    user: {
      id: "standard_user",
      name: "スタンダード ユーザー",
      company: "中小企業A",
      usageCount: 0,
      usageLimit: 100,
      plan: "standard", 
      allowedAnalysisTypes: ["sales", "hr"] // 5万円プラン：2機能
    }
  }
}

export default function SimpleAuth({ onLogin }: SimpleAuthProps) {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // デモ認証（0.5秒待機でリアル感演出）
    await new Promise(resolve => setTimeout(resolve, 500))

    const account = DEMO_ACCOUNTS[loginId.toLowerCase()]
    if (account && account.password === password) {
      onLogin(account.user)
      localStorage.setItem('auth_user', JSON.stringify(account.user))
    } else {
      setError('ログインIDまたはパスワードが正しくありません')
    }
    
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#f5f5f5',
      padding: '20px',
      boxSizing: 'border-box',
      position: 'fixed',
      top: 0,
      left: 0
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: 'clamp(1.5rem, 4vw, 3rem)',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        width: '100%',
        maxWidth: '500px',
        minWidth: 'min(300px, 90vw)'
      }}>
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: 'clamp(1.5rem, 3vw, 2.5rem)', 
          color: '#333',
          fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
          fontWeight: '600'
        }}>
          🎯 Strategic AI Platform
        </h2>
        <p style={{
          textAlign: 'center',
          color: '#666',
          marginBottom: 'clamp(1rem, 2vw, 2rem)',
          fontSize: 'clamp(1rem, 2vw, 1.1rem)'
        }}>
          統合分析コンサルティングシステム
        </p>
        
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              ログインID:
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="ログインIDを入力してください"
              required
              style={{
                width: '100%',
                padding: 'clamp(0.75rem, 2vw, 1rem)',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: 'clamp(1rem, 2vw, 1.1rem)',
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              パスワード:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力してください"
              required
              style={{
                width: '100%',
                padding: 'clamp(0.75rem, 2vw, 1rem)',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: 'clamp(1rem, 2vw, 1.1rem)',
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fee',
              color: '#c33',
              padding: '0.75rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 'clamp(1rem, 2.5vw, 1.2rem)',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
              fontWeight: '600',
              cursor: loading ? 'default' : 'pointer',
              transition: 'background-color 0.2s',
              boxShadow: '0 2px 4px rgba(0, 123, 255, 0.3)',
              boxSizing: 'border-box'
            }}
            onMouseOver={(e) => !loading && ((e.target as HTMLButtonElement).style.backgroundColor = '#0056b3')}
            onMouseOut={(e) => !loading && ((e.target as HTMLButtonElement).style.backgroundColor = '#007bff')}
          >
            {loading ? '🔄 ログイン中...' : '🚀 ログイン'}
          </button>
        </form>

      </div>
    </div>
  )
}