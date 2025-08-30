import boto3
import json
import logging
import os
import hashlib
import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from decimal import Decimal

# Supabase接続
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logging.warning("Supabase library not available. Format learning disabled.")

# ログ設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ============================================================
# JSON型定義（SalesAnalysisInput/Output v1）
# ============================================================

def build_sales_analysis_input(
    sales_data: List[Dict],
    tenant_id: str,
    user_query: str,
    metadata: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    SalesAnalysisInput v1 形式のJSONを構築
    """
    if not sales_data:
        return {
            "meta": {
                "tenant_id": tenant_id,
                "dataset_id": str(uuid.uuid4()),
                "rows": 0,
                "locale": "ja-JP"
            },
            "user_query": user_query,
            "constraints": {
                "only_use_provided_data": True
            }
        }
    
    # カラム情報の収集
    columns = list(sales_data[0].keys()) if sales_data else []
    
    # 数値カラムと日付カラムの検出
    numeric_columns = []
    date_columns = []
    
    for col in columns:
        # サンプル値から型を推定
        sample_values = [row.get(col) for row in sales_data[:10] if row.get(col)]
        
        # 日付カラムの検出
        if any(keyword in col.lower() for keyword in ['date', '日付', '年月', '日', '月', '期間']):
            date_columns.append(col)
        
        # 数値カラムの検出
        numeric_count = 0
        for val in sample_values[:5]:
            try:
                # 文字列をクリーンアップして数値変換を試みる
                clean_val = str(val).replace(',', '').replace('¥', '').replace('円', '').strip()
                float(clean_val)
                numeric_count += 1
            except:
                pass
        
        if numeric_count >= len(sample_values) * 0.5:  # 50%以上が数値
            numeric_columns.append(col)
    
    # カラムマッピング（カノニカル名への変換）
    mapped_columns = {}
    canonical_mappings = {
        '売上': ['売上', '売り上げ', '金額', 'sales', 'amount', '売上金額', '売上高'],
        '日付': ['日付', '日', 'date', '年月日', '受注日', '販売日'],
        '商品': ['商品', '商品名', 'product', 'item', '品名', 'アイテム'],
        '数量': ['数量', '個数', 'quantity', 'qty', '販売数'],
        '顧客': ['顧客', '顧客名', 'customer', 'client', '取引先']
    }
    
    for col in columns:
        col_lower = col.lower()
        for canonical, patterns in canonical_mappings.items():
            if any(pattern in col_lower for pattern in patterns):
                mapped_columns[canonical] = col
                break
    
    # 集計値の計算
    totals = {}
    if '売上' in mapped_columns:
        sales_col = mapped_columns['売上']
        total_sales = sum(
            float(str(row.get(sales_col, 0)).replace(',', '').replace('¥', '').replace('円', '').strip() or 0)
            for row in sales_data
        )
        totals['sales'] = total_sales
    
    # サンプルデータ（最大10行）
    sample_rows = []
    for row in sales_data[:10]:
        clean_row = {}
        for key, value in row.items():
            # 値のクリーンアップ
            if value is None or value == '':
                clean_row[key] = None
            elif isinstance(value, (int, float)):
                clean_row[key] = value
            else:
                # 文字列の場合、数値変換を試みる
                str_val = str(value).strip()
                try:
                    clean_val = str_val.replace(',', '').replace('¥', '').replace('円', '')
                    clean_row[key] = float(clean_val)
                except:
                    clean_row[key] = str_val
        sample_rows.append(clean_row)
    
    return {
        "meta": {
            "tenant_id": tenant_id,
            "dataset_id": str(uuid.uuid4()),
            "date_range": {},  # 必要に応じて計算
            "currency": "JPY",
            "locale": "ja-JP"
        },
        "columns": {
            "mapped": mapped_columns,
            "all": columns
        },
        "summary": {
            "rows": len(sales_data),
            "fields": {
                "numeric": numeric_columns,
                "date": date_columns
            },
            "totals": totals
        },
        "samples": {
            "rows": sample_rows,
            "limit": 10
        },
        "user_query": user_query,
        "constraints": {
            "only_use_provided_data": True
        }
    }

def validate_sales_analysis_output(output: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    SalesAnalysisOutput v1 の検証
    """
    required_fields = ["overview", "insights"]
    
    # 必須フィールドのチェック
    for field in required_fields:
        if field not in output:
            return False, f"必須フィールド '{field}' が見つかりません"
    
    # overview は文字列である必要がある
    if not isinstance(output.get("overview"), str):
        return False, "overview は文字列である必要があります"
    
    # insights は配列である必要がある
    if not isinstance(output.get("insights"), list):
        return False, "insights は配列である必要があります"
    
    # insights の各要素をチェック
    for i, insight in enumerate(output.get("insights", [])):
        if not isinstance(insight, dict):
            return False, f"insights[{i}] は辞書である必要があります"
        if "title" not in insight or "detail" not in insight:
            return False, f"insights[{i}] に title または detail がありません"
    
    return True, None

def generate_fallback_response(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    LLMが失敗した場合のフォールバック応答を生成
    """
    rows = input_data.get("summary", {}).get("rows", 0)
    totals = input_data.get("summary", {}).get("totals", {})
    total_sales = totals.get("sales", 0)
    
    return {
        "overview": f"データ分析を実行しました。{rows}行のデータを処理しました。",
        "kpis": {
            "total_sales": total_sales,
            "avg_order": total_sales / rows if rows > 0 else None,
            "top_product": None,
            "yoy": None
        },
        "insights": [
            {
                "title": "データ概要",
                "detail": f"合計{rows}行のデータを分析しました。総売上は{total_sales:,.0f}円です。"
            }
        ],
        "timeseries": [],
        "warnings": ["自動分析に失敗したため、基本的な集計結果のみを表示しています。"]
    }

# ============================================================
# メイン処理
# ============================================================

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Enhanced Lambda関数 - JSON型入出力対応版
    """
    request_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    try:
        # リクエスト解析
        body = json.loads(event.get('body', '{}'))
        prompt = body.get('prompt', '')
        tenant_id = body.get('tenantId', 'default')
        
        # 複数フィールドからデータを取得
        sales_data = (
            body.get('salesData') or 
            body.get('data') or 
            body.get('attachments') or
            []
        )
        
        metadata = body.get('metadata', {})
        
        logger.info(json.dumps({
            "request_id": request_id,
            "tenant_id": tenant_id,
            "action": "analyze_sales",
            "data_rows": len(sales_data) if sales_data else 0
        }))
        
        # 入力バリデーション
        if not prompt:
            return response_builder(400, {"error": "プロンプトが必要です"})
        
        # SalesAnalysisInput v1 形式に変換
        analysis_input = build_sales_analysis_input(
            sales_data=sales_data,
            tenant_id=tenant_id,
            user_query=prompt,
            metadata=metadata
        )
        
        # フォーマット学習の処理
        learned_data = None
        if SUPABASE_AVAILABLE and sales_data:
            try:
                learned_data = process_format_learning(tenant_id, sales_data, metadata)
                # 学習結果をanalysis_inputに反映
                if learned_data and learned_data.get('learned_mappings'):
                    analysis_input['columns']['learned'] = learned_data['learned_mappings']
            except Exception as e:
                logger.warning(f"Format learning failed: {str(e)}")
        
        # Bedrock クライアント初期化
        try:
            bedrock = boto3.client(
                service_name='bedrock-runtime',
                region_name='us-east-1'
            )
        except Exception as e:
            logger.error(f"Bedrock client initialization failed: {str(e)}")
            return response_builder(500, {"error": "AI サービスの初期化に失敗しました"})
        
        # LLM用プロンプト構築
        system_prompt = """あなたは売上データ分析の専門家です。
入力はSalesAnalysisInput v1 JSON形式で提供されます。
外部知識や推測は使用せず、提供されたデータのみを使用してください。
出力は必ずSalesAnalysisOutput v1 JSON形式で返してください。

SalesAnalysisOutput v1 の形式:
{
    "overview": "分析の概要（文字列）",
    "kpis": {
        "total_sales": 数値またはnull,
        "avg_order": 数値またはnull,
        "top_product": {"name": "商品名", "value": 数値} またはnull,
        "yoy": 前年比（数値）またはnull
    },
    "insights": [
        {"title": "洞察タイトル", "detail": "詳細説明"}
    ],
    "timeseries": [
        {"date": "日付", "sales": 数値}
    ],
    "warnings": ["警告メッセージ（省略可能）"]
}

重要: 応答は必ず有効なJSONである必要があります。"""

        user_prompt = f"""以下のデータを分析してください:

{json.dumps(analysis_input, ensure_ascii=False, indent=2)}

ユーザーの質問: {prompt}

必ずSalesAnalysisOutput v1形式のJSONで応答してください。"""

        # Claude API 呼び出し
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 3000,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "user",
                    "content": f"{system_prompt}\n\n{user_prompt}"
                }
            ]
        }
        
        # トークン数の概算（使用量計測用）
        estimated_tokens_in = len(json.dumps(request_body)) // 4
        
        try:
            response = bedrock.invoke_model(
                modelId='anthropic.claude-3-sonnet-20240229-v1:0',
                body=json.dumps(request_body)
            )
            
            response_body = json.loads(response['body'].read())
            ai_response_text = response_body['content'][0]['text']
            
            # トークン数の記録
            estimated_tokens_out = len(ai_response_text) // 4
            
        except Exception as e:
            logger.error(f"Bedrock API call failed: {str(e)}")
            # フォールバック応答を使用
            ai_response = generate_fallback_response(analysis_input)
            return response_builder(200, {
                "response": ai_response,
                "message": "AI分析に失敗したため、基本的な集計結果を表示しています",
                "dataProcessed": len(sales_data) if sales_data else 0
            })
        
        # JSON応答の解析と検証
        ai_response = None
        validation_error = None
        
        try:
            # JSONとして解析を試みる
            ai_response = json.loads(ai_response_text)
            
            # 出力の検証
            is_valid, error_msg = validate_sales_analysis_output(ai_response)
            if not is_valid:
                validation_error = error_msg
                raise ValueError(error_msg)
                
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"First attempt failed: {str(e)}")
            
            # 再試行: JSONブロックを抽出
            import re
            json_match = re.search(r'\{[\s\S]*\}', ai_response_text)
            if json_match:
                try:
                    ai_response = json.loads(json_match.group())
                    is_valid, error_msg = validate_sales_analysis_output(ai_response)
                    if not is_valid:
                        raise ValueError(error_msg)
                except:
                    pass
            
            # それでも失敗した場合はフォールバック
            if not ai_response:
                logger.error(f"JSON parsing failed completely. Using fallback.")
                ai_response = generate_fallback_response(analysis_input)
        
        # 使用量の記録（Supabaseが利用可能な場合）
        if SUPABASE_AVAILABLE:
            try:
                record_ai_usage(
                    tenant_id=tenant_id,
                    action="sales_analysis",
                    tokens_in=estimated_tokens_in,
                    tokens_out=estimated_tokens_out,
                    request_id=request_id
                )
            except Exception as e:
                logger.warning(f"Failed to record usage: {str(e)}")
        
        # 処理時間の計算
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        # ログ記録
        logger.info(json.dumps({
            "request_id": request_id,
            "tenant_id": tenant_id,
            "action": "analyze_sales",
            "duration_ms": duration_ms,
            "tokens_in": estimated_tokens_in,
            "tokens_out": estimated_tokens_out,
            "outcome": "success"
        }))
        
        # 成功レスポンス
        result = {
            "response": ai_response,
            "message": "分析が完了しました",
            "dataProcessed": len(sales_data) if sales_data else 0,
            "requestId": request_id
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
        return response_builder(400, {"error": f"JSONデータの解析に失敗しました: {str(e)}"})
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return response_builder(500, {"error": f"サーバー内部エラー: {str(e)}"})

# ============================================================
# Supabase関連の関数
# ============================================================

def get_supabase_client() -> Optional[Client]:
    """Supabaseクライアントを取得"""
    if not SUPABASE_AVAILABLE:
        return None
    
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_KEY')
    
    if not supabase_url or not supabase_key:
        logger.warning("Supabase credentials not found")
        return None
    
    return create_client(supabase_url, supabase_key)

def process_format_learning(tenant_id: str, sales_data: List[Dict], metadata: Dict) -> Dict:
    """フォーマット学習の処理"""
    if not SUPABASE_AVAILABLE or not sales_data:
        return {}
    
    try:
        supabase = get_supabase_client()
        if not supabase:
            return {}
        
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
            
            # カラムマッピングを取得
            mappings_result = supabase.table('column_mappings').select('*').eq(
                'profile_id', profile_id
            ).execute()
            
            learned_mappings = {m['source_header']: m['target_field'] for m in mappings_result.data}
            
            return {
                'profile_found': True,
                'profile_id': profile_id,
                'learned_mappings': learned_mappings,
                'columns_learned': len(learned_mappings)
            }
        else:
            return {
                'profile_found': False,
                'format_signature': format_signature,
                'headers': headers
            }
    
    except Exception as e:
        logger.error(f"Format learning error: {str(e)}")
        return {}

def save_format_profile(tenant_id: str, format_signature: str, headers: List[str], 
                        column_mappings: Dict[str, str]) -> bool:
    """新規フォーマットプロファイルと学習データを保存"""
    try:
        supabase = get_supabase_client()
        if not supabase:
            return False
        
        # フォーマットプロファイル作成
        profile_data = {
            'tenant_id': tenant_id,
            'format_signature': format_signature,
            'headers': json.dumps(headers, ensure_ascii=False),
            'created_at': datetime.utcnow().isoformat()
        }
        profile_result = supabase.table('format_profiles').insert(profile_data).execute()
        
        if not profile_result.data:
            return False
            
        profile_id = profile_result.data[0]['id']
        
        # カラムマッピング保存
        for source, target in column_mappings.items():
            if target and target != 'unknown' and target != 'ignore':
                mapping_data = {
                    'profile_id': profile_id,
                    'source_header': source,
                    'target_field': target.replace('custom:', '') if target.startswith('custom:') else target,
                    'confidence': 1.0,
                    'created_at': datetime.utcnow().isoformat()
                }
                supabase.table('column_mappings').insert(mapping_data).execute()
        
        logger.info(f"Format profile saved: {profile_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to save format profile: {str(e)}")
        return False

def record_ai_usage(tenant_id: str, action: str, tokens_in: int, tokens_out: int, request_id: str) -> bool:
    """AI使用量を記録"""
    try:
        supabase = get_supabase_client()
        if not supabase:
            return False
        
        # コスト計算（Claude 3 Sonnetの料金: $0.003/1K input, $0.015/1K output）
        cost_input = (tokens_in / 1000) * 0.003
        cost_output = (tokens_out / 1000) * 0.015
        total_cost = cost_input + cost_output
        
        usage_data = {
            'tenant_id': tenant_id,
            'action': action,
            'tokens_in': tokens_in,
            'tokens_out': tokens_out,
            'cost': total_cost,
            'request_id': request_id,
            'created_at': datetime.utcnow().isoformat()
        }
        
        supabase.table('ai_usage').insert(usage_data).execute()
        return True
        
    except Exception as e:
        logger.error(f"Failed to record AI usage: {str(e)}")
        return False

def generate_format_signature(headers: List[str]) -> str:
    """ヘッダー構成からフォーマットシグネチャを生成"""
    sorted_headers = sorted([h.lower().strip() for h in headers if h])
    signature_string = '|'.join(sorted_headers)
    return hashlib.md5(signature_string.encode()).hexdigest()

def response_builder(status_code: int, body: Any) -> Dict[str, Any]:
    """CORS対応レスポンスビルダー"""
    if isinstance(body, dict):
        response_body = body
    else:
        response_body = {"message": body}
    
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