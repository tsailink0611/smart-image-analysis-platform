import { createClient } from '@supabase/supabase-js'

// 環境変数から接続情報を取得
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabaseクライアントの作成
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// テーブル名の定義（タイポ防止）
export const TABLES = {
  FORMAT_PROFILES: 'format_profiles',
  COLUMN_MAPPINGS: 'column_mappings',
  PROFILE_META: 'profile_meta',
  AI_USAGE: 'ai_usage'
} as const

// カラムマッピング保存用の型定義
export interface ColumnMapping {
  source_header: string
  target_field: string
  confidence?: number
}

export interface FormatProfile {
  id?: string
  tenant_id: string
  format_signature: string
  headers: string[]
  created_at?: string
  updated_at?: string
}

// フォーマットプロファイルを保存
export async function saveFormatProfile(
  tenantId: string,
  headers: string[],
  mappings: Record<string, string>
) {
  try {
    // フォーマットシグネチャを生成（日本語対応）
    const headerString = headers.sort().join('|')
    const signature = btoa(unescape(encodeURIComponent(headerString)))
    
    // 1. フォーマットプロファイルを保存/更新
    const { data: profile, error: profileError } = await supabase
      .from(TABLES.FORMAT_PROFILES)
      .upsert({
        tenant_id: tenantId,
        format_signature: signature,
        headers: headers
      }, {
        onConflict: 'tenant_id,format_signature'
      })
      .select()
      .single()

    if (profileError) {
      console.error('プロファイル保存エラー:', profileError)
      return { success: false, error: profileError }
    }

    // 2. カラムマッピングを保存
    const mappingData = Object.entries(mappings).map(([source, target]) => ({
      profile_id: profile.id,
      source_header: source,
      target_field: target,
      confidence: 1.0
    }))

    const { error: mappingError } = await supabase
      .from(TABLES.COLUMN_MAPPINGS)
      .upsert(mappingData, {
        onConflict: 'profile_id,source_header'
      })

    if (mappingError) {
      console.error('マッピング保存エラー:', mappingError)
      return { success: false, error: mappingError }
    }

    return { success: true, profile }
  } catch (error) {
    console.error('保存処理エラー:', error)
    return { success: false, error }
  }
}

// 既存のフォーマットプロファイルを取得
export async function getFormatProfile(
  tenantId: string,
  headers: string[]
) {
  try {
    const headerString = headers.sort().join('|')
    const signature = btoa(unescape(encodeURIComponent(headerString)))
    
    const { data, error } = await supabase
      .from(TABLES.FORMAT_PROFILES)
      .select(`
        *,
        column_mappings (
          source_header,
          target_field,
          confidence
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('format_signature', signature)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // データが見つからない場合
        return { exists: false }
      }
      throw error
    }

    return { exists: true, data }
  } catch (error) {
    console.error('プロファイル取得エラー:', error)
    return { exists: false, error }
  }
}