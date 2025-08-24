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
    console.log('📊 保存データ:', { tenantId, headers, mappings });
    
    // フォーマットシグネチャを生成（日本語対応）
    const headerString = headers.sort().join('|')
    const signature = btoa(unescape(encodeURIComponent(headerString)))
    
    // シンプルな1テーブル構造で保存
    const { data, error } = await supabase
      .from('format_profiles')
      .upsert({
        tenant_id: tenantId,
        format_signature: signature,
        column_mappings: mappings  // JSONBフィールドに直接保存
      }, {
        onConflict: 'tenant_id,format_signature'
      })

    if (error) {
      console.error('❌ Supabase保存失敗:', error);
      throw error;
    }

    console.log('✅ Supabase保存成功:', data);
    return { success: true, profile: data };
  } catch (error) {
    console.error('❌ プロファイル保存エラー:', error);
    return { success: false, error: String(error) };
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