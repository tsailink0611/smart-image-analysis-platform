import boto3
import json
import logging
import os
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime

# Supabase接続のためのライブラリ（新規追加）
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logging.warning("Supabase library not available. Format learning disabled.")

# ログ設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Strategic AI Platform - Enhanced Lambda関数
    Human-in-the-Loop フォーマット学習機能付き
    """
    
    try:
        # 1. リクエスト解析
        body = json.loads(event.get('body', '{}'))
        prompt = body.get('prompt', '')
        tenant_id = body.get('tenantId', 'default')  # 新規追加：テナントID
        
        # 複数フィールドからデータを取得
        sales_data = (
            body.get('salesData') or 
            body.get('data') or 
            body.get('attachments') or
            []
        )
        
        data_context = body.get('dataContext', '')
        metadata = body.get('metadata', {})
        system_message = body.get('systemMessage', '')
        
        logger.info(f"Received prompt: {prompt[:100]}...")
        logger.info(f"Sales data rows: {len(sales_data) if sales_data else 0}")
        logger.info(f"Tenant ID: {tenant_id}")
        
        # 2. 入力バリデーション
        if not prompt:
            return response_builder(400, "プロンプトが必要です")
        
        # 3. フォーマット学習の実行（新機能）
        learned_data = None
        if SUPABASE_AVAILABLE and sales_data:
            try:
                learned_data = process_format_learning(tenant_id, sales_data, metadata)
                logger.info(f"Format learning result: {learned_data}")
            except Exception as e:
                logger.warning(f"Format learning failed: {str(e)}")
                # フォーマット学習が失敗しても、分析は続行
        
        # 4. Bedrock クライアント初期化
        try:
            bedrock = boto3.client(
                service_name='bedrock-runtime',
                region_name='us-east-1'
            )
        except Exception as e:
            logger.error(f"Bedrock client initialization failed: {str(e)}")
            return response_builder(500, f"Bedrockクライアント初期化エラー: {str(e)}")
        
        # 5. 強化プロンプト構築（学習結果を含む）
        enhanced_prompt = build_analysis_prompt(
            prompt, sales_data, data_context, metadata, learned_data
        )
        
        logger.info(f"Enhanced prompt length: {len(enhanced_prompt)}")
        
        # 6. Claude 3 API 呼び出し
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2000,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "user",
                    "content": enhanced_prompt
                }
            ]
        }
        
        try:
            response = bedrock.invoke_model(
                modelId='anthropic.claude-3-sonnet-20240229-v1:0',
                body=json.dumps(request_body)
            )
        except Exception as e:
            logger.error(f"Bedrock API call failed: {str(e)}")
            return response_builder(500, f"Bedrock API呼び出しエラー: {str(e)}")
        
        # 7. レスポンス解析
        try:
            response_body = json.loads(response['body'].read())
            ai_response = response_body['content'][0]['text']
        except Exception as e:
            logger.error(f"Response parsing failed: {str(e)}")
            return response_builder(500, f"レスポンス解析エラー: {str(e)}")
        
        logger.info("Bedrock response received successfully")
        
        # 8. 成功レスポンス（学習情報を含む）
        result = {
            'response': ai_response,
            'message': '分析が完了しました',
            'dataProcessed': len(sales_data) if sales_data else 0
        }
        
        # 学習結果があれば追加
        if learned_data:
            result['formatLearning'] = {
                'profileFound': learned_data.get('profile_found', False),
                'columnsLearned': learned_data.get('columns_learned', 0),
                'suggestions': learned_data.get('suggestions', [])
            }
        
        return response_builder(200, result)
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {str(e)}")
        return response_builder(400, f"JSONデータの解析に失敗しました: {str(e)}")
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return response_builder(500, f"サーバー内部エラー: {str(e)}")

def process_format_learning(tenant_id: str, sales_data: List[Dict], metadata: Dict) -> Dict:
    """
    フォーマット学習の処理
    """
    if not SUPABASE_AVAILABLE or not sales_data:
        return {}
    
    try:
        # Supabase接続（本番環境用）
        supabase_url = os.environ.get('SUPABASE_URL', 'https://fggpltpqtkebkwkqyzkh.supabase.co')
        supabase_key = os.environ.get('SUPABASE_SERVICE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnZ3BsdHBxdGtlYmt3a3F5emtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDM0NjAzNCwiZXhwIjoyMDM5OTIyMDM0fQ.Wv0kBM7x1ggcK9F4zIxTQ-8jU-7dn_VVz_1mD3ycBn8')
        
        if not supabase_url or not supabase_key:
            logger.warning("Supabase credentials not found in environment")
            return {}
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # フォーマットシグネチャ生成
        headers = list(sales_data[0].keys()) if sales_data else []
        format_signature = generate_format_signature(headers)
        
        # 既存プロファイルの検索
        profile_result = supabase.table('format_profiles').select('*').eq(
            'tenant_id', tenant_id
        ).eq('format_signature', format_signature).execute()
        
        profile_found = len(profile_result.data) > 0
        
        if profile_found:
            profile_id = profile_result.data[0]['id']
            logger.info(f"Existing profile found: {profile_id}")
            
            # 既存のカラムマッピングを取得
            mappings_result = supabase.table('column_mappings').select('*').eq(
                'profile_id', profile_id
            ).execute()
            
            # 学習済みマッピングを適用
            learned_mappings = {m['source_header']: m['target_field'] for m in mappings_result.data}
            
            return {
                'profile_found': True,
                'profile_id': profile_id,
                'learned_mappings': learned_mappings,
                'columns_learned': len(learned_mappings),
                'suggestions': generate_mapping_suggestions(headers, learned_mappings)
            }
        else:
            # 新しいプロファイル作成の準備
            return {
                'profile_found': False,
                'format_signature': format_signature,
                'headers': headers,
                'suggestions': generate_mapping_suggestions(headers, {})
            }
    
    except Exception as e:
        logger.error(f"Format learning error: {str(e)}")
        return {}

def generate_format_signature(headers: List[str]) -> str:
    """
    ヘッダー構成からフォーマットシグネチャを生成
    """
    # ヘッダーをソートして一意の文字列を作成
    sorted_headers = sorted([h.lower().strip() for h in headers if h])
    signature_string = '|'.join(sorted_headers)
    return hashlib.md5(signature_string.encode()).hexdigest()

def generate_mapping_suggestions(headers: List[str], learned_mappings: Dict[str, str]) -> List[Dict]:
    """
    カラムマッピングの提案を生成
    """
    suggestions = []
    
    # 標準的なマッピングルール
    standard_mappings = {
        '売上': 'sales',
        '売り上げ': 'sales', 
        '金額': 'amount',
        '日付': 'date',
        '日': 'date',
        '月': 'month',
        '商品': 'product',
        '商品名': 'product_name',
        '数量': 'quantity',
        '単価': 'unit_price'
    }
    
    for header in headers:
        if header in learned_mappings:
            # 学習済み
            suggestions.append({
                'source': header,
                'target': learned_mappings[header],
                'confidence': 'learned',
                'type': 'confirmed'
            })
        else:
            # 推測
            suggested_target = None
            for pattern, target in standard_mappings.items():
                if pattern in header.lower():
                    suggested_target = target
                    break
            
            suggestions.append({
                'source': header,
                'target': suggested_target or 'unknown',
                'confidence': 'suggested' if suggested_target else 'unknown',
                'type': 'suggestion'
            })
    
    return suggestions

def build_analysis_prompt(user_prompt: str, sales_data: List[Dict], data_context: str, 
                         metadata: Dict, learned_data: Optional[Dict] = None) -> str:
    """
    分析用プロンプトの構築（フォーマット学習結果を含む）
    """
    
    base_prompt = f"""あなたは売上データ分析の専門家です。以下の売上データを分析し、ユーザーの質問に回答してください。

【重要な指示】
- 提供されたデータのみを使用して分析してください
- 架空のデータやサンプルデータは絶対に作成しないでください
- 実際のデータに基づいた具体的な数値で分析してください

【ユーザーの質問】
{user_prompt}

"""
    
    # 学習情報があれば追加
    if learned_data and learned_data.get('profile_found'):
        base_prompt += f"""【フォーマット学習情報】
このデータ形式は過去に学習済みです。
- 学習済み列数: {learned_data.get('columns_learned', 0)}
- 推奨マッピング: {len(learned_data.get('suggestions', []))}件

"""
    
    # データが提供されている場合
    if sales_data and len(sales_data) > 0:
        base_prompt += f"【実際の売上データ】\n"
        base_prompt += f"データ行数: {len(sales_data)}行\n"
        
        # メタデータ情報を追加
        if metadata:
            if metadata.get('columns'):
                base_prompt += f"データ項目: {', '.join(metadata['columns'])}\n"
        
        base_prompt += "\n【データ内容（テーブル形式）】\n"
        
        # データをテーブル形式で整形
        if len(sales_data) > 0:
            headers = list(sales_data[0].keys())
            base_prompt += "| " + " | ".join(headers) + " |\n"
            base_prompt += "|" + "|".join([" --- " for _ in headers]) + "|\n"
            
            # 最初の10行を表示
            display_rows = min(10, len(sales_data))
            for i in range(display_rows):
                row_data = []
                for header in headers:
                    value = sales_data[i].get(header, '')
                    str_value = str(value).replace('|', '\\|') if value is not None else ''
                    row_data.append(str_value)
                base_prompt += "| " + " | ".join(row_data) + " |\n"
            
            if len(sales_data) > display_rows:
                base_prompt += f"\n... （他 {len(sales_data) - display_rows} 行）\n"
        
        base_prompt += """
【分析要件】
1. 提供された実データの特徴と傾向を分析してください
2. 具体的な数値と根拠を示してください
3. ビジネスへの影響を評価してください
4. 実用的な改善提案を含めてください
5. 日本語で分かりやすく回答してください

【厳重注意】
- 上記のテーブルデータのみを使用してください
- period11, period28 などの架空のデータは絶対に使用しないでください
"""
    else:
        base_prompt += """【データ状況】
データが提供されていません。一般的な売上分析のアドバイスを提供します。
"""
    
    return base_prompt

def response_builder(status_code: int, body: Any) -> Dict[str, Any]:
    """
    CORS対応レスポンスビルダー
    """
    if isinstance(body, str):
        response_body = {"message": body}
    else:
        response_body = body
    
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
        },
        'body': json.dumps(response_body, ensure_ascii=False, indent=2)
    }