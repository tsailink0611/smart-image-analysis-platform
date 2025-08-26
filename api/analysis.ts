// api/analysis.ts
// BFF (Backend for Frontend) - CORS問題を回避しLambda Function URLへ透過プロキシ
import type { VercelRequest, VercelResponse } from '@vercel/node'

const MAX_BODY_BYTES = 6 * 1024 * 1024 // ~6MB (Vercel制限に準拠)
const TIMEOUT_MS = 60_000 // 60秒タイムアウト

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[BFF] ${req.method} /api/analysis - Start`)

  // サイズ制限チェック（content-lengthベース）
  const contentLength = Number(req.headers['content-length'] || 0)
  if (contentLength > MAX_BODY_BYTES) {
    console.error(`[BFF] Payload too large: ${contentLength} bytes`)
    return res.status(413).json({ 
      error: { 
        code: 'PAYLOAD_TOO_LARGE', 
        message: 'Request body too large (max 6MB)',
        detail: `Size: ${contentLength} bytes`
      } 
    })
  }

  // CORS プリフライト対応（同一オリジンだが念のため）
  if (req.method === 'OPTIONS') {
    console.log('[BFF] OPTIONS preflight response')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
    return res.status(200).json({ ok: true })
  }

  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    console.error(`[BFF] Method not allowed: ${req.method}`)
    return res.status(405).json({ 
      error: { 
        code: 'METHOD_NOT_ALLOWED', 
        message: 'Only POST method is allowed' 
      } 
    })
  }

  // 環境変数チェック
  const lambdaUrl = process.env.LAMBDA_URL
  if (!lambdaUrl) {
    console.error('[BFF] LAMBDA_URL environment variable is not set')
    return res.status(500).json({ 
      error: { 
        code: 'CONFIG_ERROR', 
        message: 'Backend configuration error (LAMBDA_URL not set)',
        detail: 'Please contact administrator'
      } 
    })
  }

  // リクエストボディ検証
  try {
    // JSONボディ必須チェック
    if (!req.body || typeof req.body !== 'object') {
      console.error('[BFF] Invalid body - not an object')
      return res.status(400).json({ 
        error: { 
          code: 'INVALID_BODY', 
          message: 'Request body must be a valid JSON object' 
        } 
      })
    }

    // prompt必須チェック
    const { prompt } = req.body
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      console.error('[BFF] Missing or invalid prompt')
      return res.status(400).json({ 
        error: { 
          code: 'INVALID_PROMPT', 
          message: 'prompt field is required and must be a non-empty string' 
        } 
      })
    }

    // salesData/csvDataの少なくとも一つは必須
    const { salesData, csvData } = req.body
    if (!salesData && !csvData) {
      console.error('[BFF] Missing data - neither salesData nor csvData provided')
      return res.status(400).json({ 
        error: { 
          code: 'MISSING_DATA', 
          message: 'Either salesData (array) or csvData (string) is required' 
        } 
      })
    }

    console.log(`[BFF] Valid request - prompt length: ${prompt.length}, has salesData: ${!!salesData}, has csvData: ${!!csvData}`)
  } catch (err) {
    console.error('[BFF] Failed to parse request body:', err)
    return res.status(400).json({ 
      error: { 
        code: 'INVALID_JSON', 
        message: 'Failed to parse JSON body',
        detail: String(err)
      } 
    })
  }

  // Lambda Function URLへの透過プロキシ
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    console.log(`[BFF] Forwarding to Lambda: ${lambdaUrl}`)
    const startTime = Date.now()
    
    const lambdaResponse = await fetch(lambdaUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // Lambda Function URLではAuthorizationヘッダーは不要（認証:NONE想定）
        // 将来的にIAM認証を使う場合はここにSigV4署名を追加
      },
      body: JSON.stringify(req.body), // 全フィールドを透過転送
      signal: controller.signal
    })

    const elapsed = Date.now() - startTime
    console.log(`[BFF] Lambda response: status=${lambdaResponse.status}, elapsed=${elapsed}ms`)

    // レスポンスボディを取得
    const responseText = await lambdaResponse.text()
    
    // Content-Typeを転送（通常はapplication/json）
    const contentType = lambdaResponse.headers.get('content-type') || 'application/json'
    res.setHeader('Content-Type', contentType)
    
    // CORSヘッダー（念のため）
    res.setHeader('Access-Control-Allow-Origin', '*')
    
    // ステータスコードとボディをそのまま転送
    console.log(`[BFF] Returning response: status=${lambdaResponse.status}, size=${responseText.length} bytes`)
    return res.status(lambdaResponse.status).send(responseText)

  } catch (err: any) {
    // タイムアウトエラー
    if (err?.name === 'AbortError') {
      console.error(`[BFF] Upstream timeout after ${TIMEOUT_MS}ms`)
      return res.status(504).json({ 
        error: { 
          code: 'UPSTREAM_TIMEOUT', 
          message: `Request timeout after ${TIMEOUT_MS / 1000} seconds`,
          detail: 'The backend processing took too long'
        } 
      })
    }
    
    // その他のネットワークエラー
    console.error('[BFF] Upstream error:', err)
    return res.status(502).json({ 
      error: { 
        code: 'UPSTREAM_ERROR', 
        message: 'Failed to connect to backend service',
        detail: String(err)
      } 
    })
  } finally {
    clearTimeout(timeoutId)
    console.log('[BFF] Request completed')
  }
}