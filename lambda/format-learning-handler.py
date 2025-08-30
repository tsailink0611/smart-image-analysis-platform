import boto3
import json
import logging
import os
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime

# Supabase接続
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logging.warning("Supabase library not available.")

# ログ設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    フォーマット学習データの保存・取得を処理するLambda関数
    """
    
    try:
        # リクエスト解析
        body = json.loads(event.get('body', '{}'))
        action = body.get('action', 'save_format_profile')
        tenant_id = body.get('tenantId', 'default')
        
        logger.info(f"Action: {action}, Tenant: {tenant_id}")
        
        if not SUPABASE_AVAILABLE:
            return response_builder(503, {
                "success": False,
                "error": "フォーマット学習機能は現在利用できません"
            })
        
        # Supabaseクライアント取得
        supabase = get_supabase_client()
        if not supabase:
            return response_builder(500, {
                "success": False,
                "error": "データベース接続に失敗しました"
            })
        
        # アクションに応じた処理
        if action == 'save_format_profile':
            # フォーマットプロファイルの保存
            headers = body.get('headers', [])
            column_mappings = body.get('columnMappings', {})
            
            if not headers:
                return response_builder(400, {
                    "success": False,
                    "error": "ヘッダー情報が必要です"
                })
            
            success = save_format_profile(
                supabase=supabase,
                tenant_id=tenant_id,
                headers=headers,
                column_mappings=column_mappings
            )
            
            if success:
                return response_builder(200, {
                    "success": True,
                    "message": "フォーマットプロファイルを保存しました"
                })
            else:
                return response_builder(500, {
                    "success": False,
                    "error": "保存に失敗しました"
                })
        
        elif action == 'get_format_profile':
            # フォーマットプロファイルの取得
            headers = body.get('headers', [])
            
            if not headers:
                return response_builder(400, {
                    "success": False,
                    "error": "ヘッダー情報が必要です"
                })
            
            profile = get_format_profile(
                supabase=supabase,
                tenant_id=tenant_id,
                headers=headers
            )
            
            return response_builder(200, {
                "success": True,
                "profile": profile
            })
        
        elif action == 'get_usage_summary':
            # AI使用量サマリーの取得
            usage = get_usage_summary(
                supabase=supabase,
                tenant_id=tenant_id
            )
            
            return response_builder(200, {
                "success": True,
                "usage": usage
            })
        
        else:
            return response_builder(400, {
                "success": False,
                "error": f"不明なアクション: {action}"
            })
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {str(e)}")
        return response_builder(400, {
            "success": False,
            "error": "リクエストの解析に失敗しました"
        })
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return response_builder(500, {
            "success": False,
            "error": f"サーバーエラー: {str(e)}"
        })

def get_supabase_client() -> Optional[Client]:
    """Supabaseクライアントを取得"""
    try:
        # deployment-config.json から認証情報を読み込む（開発環境用）
        # 本番環境では環境変数から取得
        supabase_url = os.environ.get('SUPABASE_URL', 'https://fggpltpqtkebkwkqyzkh.supabase.co')
        supabase_key = os.environ.get('SUPABASE_SERVICE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnZ3BsdHBxdGtlYmt3a3F5emtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDM0NjAzNCwiZXhwIjoyMDM5OTIyMDM0fQ.Wv0kBM7x1ggcK9F4zIxTQ-8jU-7dn_VVz_1mD3ycBn8')
        
        if not supabase_url or not supabase_key:
            logger.warning("Supabase credentials not found")
            return None
        
        return create_client(supabase_url, supabase_key)
    except Exception as e:
        logger.error(f"Failed to create Supabase client: {str(e)}")
        return None

def generate_format_signature(headers: List[str]) -> str:
    """ヘッダー構成からフォーマットシグネチャを生成"""
    # ヘッダーを正規化してソート
    normalized_headers = []
    for h in headers:
        if h:
            # 正規化: 小文字化、スペース削除、記号削除
            normalized = h.lower().strip().replace(' ', '').replace('_', '').replace('-', '')
            normalized_headers.append(normalized)
    
    sorted_headers = sorted(normalized_headers)
    signature_string = '|'.join(sorted_headers)
    return hashlib.md5(signature_string.encode()).hexdigest()

def save_format_profile(supabase: Client, tenant_id: str, headers: List[str], 
                        column_mappings: Dict[str, str]) -> bool:
    """フォーマットプロファイルと学習データを保存"""
    try:
        format_signature = generate_format_signature(headers)
        
        # 既存プロファイルをチェック
        existing_result = supabase.table('format_profiles').select('id').eq(
            'tenant_id', tenant_id
        ).eq('format_signature', format_signature).execute()
        
        if existing_result.data:
            # 既存プロファイルが存在する場合は更新
            profile_id = existing_result.data[0]['id']
            logger.info(f"Updating existing profile: {profile_id}")
            
            # 既存のマッピングを削除
            supabase.table('column_mappings').delete().eq(
                'profile_id', profile_id
            ).execute()
        else:
            # 新規プロファイル作成
            profile_data = {
                'tenant_id': tenant_id,
                'format_signature': format_signature,
                'headers': json.dumps(headers, ensure_ascii=False),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            profile_result = supabase.table('format_profiles').insert(profile_data).execute()
            
            if not profile_result.data:
                logger.error("Failed to create format profile")
                return False
                
            profile_id = profile_result.data[0]['id']
            logger.info(f"Created new profile: {profile_id}")
        
        # カラムマッピング保存
        saved_count = 0
        for source, target in column_mappings.items():
            if target and target not in ['unknown', 'ignore', '不明', '無視する']:
                # カスタム入力の処理
                if target.startswith('custom:'):
                    target_field = target.replace('custom:', '').strip()
                else:
                    target_field = target
                
                if target_field:  # 空文字でない場合のみ保存
                    mapping_data = {
                        'profile_id': profile_id,
                        'source_header': source,
                        'target_field': target_field,
                        'confidence': 1.0,
                        'created_at': datetime.utcnow().isoformat()
                    }
                    
                    result = supabase.table('column_mappings').insert(mapping_data).execute()
                    if result.data:
                        saved_count += 1
        
        logger.info(f"Saved {saved_count} column mappings for profile {profile_id}")
        
        # プロファイルメタデータを更新
        meta_data = {
            'profile_id': profile_id,
            'tenant_id': tenant_id,
            'last_used': datetime.utcnow().isoformat(),
            'usage_count': 1,
            'column_count': saved_count
        }
        
        # メタデータのupsert（存在すれば更新、なければ作成）
        supabase.table('profile_meta').upsert(meta_data, on_conflict='profile_id').execute()
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to save format profile: {str(e)}")
        return False

def get_format_profile(supabase: Client, tenant_id: str, headers: List[str]) -> Optional[Dict]:
    """フォーマットプロファイルを取得"""
    try:
        format_signature = generate_format_signature(headers)
        
        # プロファイル検索
        profile_result = supabase.table('format_profiles').select('*').eq(
            'tenant_id', tenant_id
        ).eq('format_signature', format_signature).execute()
        
        if not profile_result.data:
            return None
        
        profile = profile_result.data[0]
        profile_id = profile['id']
        
        # カラムマッピング取得
        mappings_result = supabase.table('column_mappings').select('*').eq(
            'profile_id', profile_id
        ).execute()
        
        column_mappings = {
            m['source_header']: m['target_field'] 
            for m in mappings_result.data
        }
        
        # 使用回数を更新
        supabase.table('profile_meta').upsert({
            'profile_id': profile_id,
            'tenant_id': tenant_id,
            'last_used': datetime.utcnow().isoformat(),
            'usage_count': supabase.rpc('increment_usage_count', {'pid': profile_id})
        }, on_conflict='profile_id').execute()
        
        return {
            'profile_id': profile_id,
            'headers': json.loads(profile.get('headers', '[]')),
            'column_mappings': column_mappings,
            'created_at': profile.get('created_at'),
            'updated_at': profile.get('updated_at')
        }
        
    except Exception as e:
        logger.error(f"Failed to get format profile: {str(e)}")
        return None

def get_usage_summary(supabase: Client, tenant_id: str) -> Dict[str, Any]:
    """AI使用量サマリーを取得"""
    try:
        # 現在の月の使用量を集計
        current_month = datetime.utcnow().strftime('%Y-%m')
        
        # 月次使用量を取得
        usage_result = supabase.table('ai_usage').select('*').eq(
            'tenant_id', tenant_id
        ).gte('created_at', f'{current_month}-01').execute()
        
        total_tokens_in = sum(u.get('tokens_in', 0) for u in usage_result.data)
        total_tokens_out = sum(u.get('tokens_out', 0) for u in usage_result.data)
        total_cost = sum(u.get('cost', 0) for u in usage_result.data)
        request_count = len(usage_result.data)
        
        # 月次制限（仮の値）
        monthly_limit = 100.0  # $100
        usage_percentage = (total_cost / monthly_limit * 100) if monthly_limit > 0 else 0
        
        return {
            'month': current_month,
            'total_tokens_in': total_tokens_in,
            'total_tokens_out': total_tokens_out,
            'total_cost': round(total_cost, 4),
            'request_count': request_count,
            'monthly_limit': monthly_limit,
            'usage_percentage': round(usage_percentage, 2),
            'remaining_budget': round(monthly_limit - total_cost, 2)
        }
        
    except Exception as e:
        logger.error(f"Failed to get usage summary: {str(e)}")
        return {
            'month': datetime.utcnow().strftime('%Y-%m'),
            'total_tokens_in': 0,
            'total_tokens_out': 0,
            'total_cost': 0,
            'request_count': 0,
            'monthly_limit': 100.0,
            'usage_percentage': 0,
            'remaining_budget': 100.0
        }

def response_builder(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """CORS対応レスポンスビルダー"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
        },
        'body': json.dumps(body, ensure_ascii=False, indent=2)
    }