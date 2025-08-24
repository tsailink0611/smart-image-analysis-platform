// Supabase接続のデバッグ用ユーティリティ

export function checkSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  
  console.log('🔍 Supabase設定チェック:')
  console.log('URL:', url ? '設定済み ✅' : '未設定 ❌')
  console.log('Anon Key:', anonKey ? '設定済み ✅' : '未設定 ❌')
  
  if (url) {
    console.log('URL値:', url)
  }
  
  if (anonKey) {
    console.log('Anon Key（最初10文字）:', anonKey.substring(0, 10) + '...')
  }
  
  return { url, anonKey, valid: !!(url && anonKey) }
}