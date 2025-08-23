import boto3
import json
import logging
from typing import Dict, Any, List, Optional

# ログ設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Strategic AI Platform - Lambda関数
    フロントエンドから送信されたデータを処理し、Amazon BedrockのClaude 3で分析
    """
    
    try:
        # 1. リクエスト解析
        body = json.loads(event.get('body', '{}'))
        prompt = body.get('prompt', '')
        
        # 複数フィールドからデータを取得（フロントエンド互換性のため）
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
        logger.info(f"Has metadata: {bool(metadata)}")
        logger.info(f"Data context length: {len(data_context) if data_context else 0}")
        
        # 2. 入力バリデーション
        if not prompt:
            return response_builder(400, "プロンプトが必要です")
        
        # 3. Bedrock クライアント初期化
        try:
            bedrock = boto3.client(
                service_name='bedrock-runtime',
                region_name='us-east-1'
            )
        except Exception as e:
            logger.error(f"Bedrock client initialization failed: {str(e)}")
            return response_builder(500, f"Bedrockクライアント初期化エラー: {str(e)}")
        
        # 4. 強化プロンプト構築
        enhanced_prompt = build_analysis_prompt(prompt, sales_data, data_context, metadata)
        
        logger.info(f"Enhanced prompt length: {len(enhanced_prompt)}")
        logger.info(f"Enhanced prompt preview: {enhanced_prompt[:300]}...")
        
        # 5. Claude 3 API 呼び出し
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
        
        # 6. レスポンス解析
        try:
            response_body = json.loads(response['body'].read())
            ai_response = response_body['content'][0]['text']
        except Exception as e:
            logger.error(f"Response parsing failed: {str(e)}")
            return response_builder(500, f"レスポンス解析エラー: {str(e)}")
        
        logger.info("Bedrock response received successfully")
        
        # 7. レスポンス形式判定（JSON または Markdown）
        response_format = body.get('responseFormat', 'markdown')  # デフォルトはmarkdown
        
        if response_format == 'json':
            # JSON形式での構造化レスポンス
            structured_response = parse_ai_response_to_json(ai_response, sales_data)
            return response_builder(200, {
                'response': structured_response,
                'message': '分析が完了しました（JSON形式）',
                'dataProcessed': len(sales_data) if sales_data else 0,
                'format': 'json'
            })
        else:
            # 従来のMarkdown形式レスポンス
            return response_builder(200, {
                'response': ai_response,
                'message': '分析が完了しました',
                'dataProcessed': len(sales_data) if sales_data else 0,
                'format': 'markdown'
            })
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {str(e)}")
        return response_builder(400, f"JSONデータの解析に失敗しました: {str(e)}")
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return response_builder(500, f"サーバー内部エラー: {str(e)}")


def build_analysis_prompt(user_prompt: str, sales_data: List[Dict], data_context: str, metadata: Dict) -> str:
    """
    分析用プロンプトの構築
    実データを使用し、偽データ生成を防止する明示的指示を含む
    """
    
    base_prompt = f"""あなたは売上データ分析の専門家です。以下の売上データを分析し、ユーザーの質問に回答してください。

【重要な指示】
- 提供されたデータのみを使用して分析してください
- 架空のデータやサンプルデータは絶対に作成しないでください
- 実際のデータに基づいた具体的な数値で分析してください
- データがない場合は「データが提供されていません」と明記してください

【ユーザーの質問】
{user_prompt}

"""
    
    # データが提供されている場合
    if sales_data and len(sales_data) > 0:
        base_prompt += f"【実際の売上データ】\n"
        base_prompt += f"データ行数: {len(sales_data)}行\n"
        
        # メタデータ情報を追加
        if metadata:
            if metadata.get('columns'):
                base_prompt += f"データ項目: {', '.join(metadata['columns'])}\n"
            if metadata.get('totalRows'):
                base_prompt += f"総行数: {metadata['totalRows']}行（送信制限により{len(sales_data)}行を分析対象とします）\n"
        
        base_prompt += "\n【データ内容（テーブル形式）】\n"
        
        # データをテーブル形式で整形
        if len(sales_data) > 0:
            # ヘッダー行を作成
            headers = list(sales_data[0].keys())
            base_prompt += "| " + " | ".join(headers) + " |\n"
            base_prompt += "|" + "|".join([" --- " for _ in headers]) + "|\n"
            
            # データ行を追加（最初の10行のみ表示、残りはサマリー）
            display_rows = min(10, len(sales_data))
            for i in range(display_rows):
                row_data = []
                for header in headers:
                    value = sales_data[i].get(header, '')
                    # 値を文字列として処理し、パイプ文字をエスケープ
                    str_value = str(value).replace('|', '\\|') if value is not None else ''
                    row_data.append(str_value)
                base_prompt += "| " + " | ".join(row_data) + " |\n"
            
            # 残りのデータがある場合はサマリーを追加
            if len(sales_data) > display_rows:
                base_prompt += f"\n... （他 {len(sales_data) - display_rows} 行のデータがあります）\n"
        
        # データコンテキストがある場合は追加
        if data_context:
            base_prompt += f"\n【データの特徴】\n{data_context}\n"
        
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
- データにない情報は推測や創作をしないでください
"""
    
    else:
        # データが提供されていない場合
        base_prompt += """【データ状況】
データが提供されていません。一般的な売上分析のアドバイスを提供します。

【対応内容】
1. 売上分析の基本的な手法をご説明します
2. データ収集の重要性について
3. 分析に必要な項目について
4. 一般的な改善提案について

【重要】
具体的な数値分析はデータが必要です。CSVファイルやExcelファイルをアップロードしてください。
"""
    
    base_prompt += "\n【分析結果】\n"
    
    return base_prompt


def parse_ai_response_to_json(ai_response: str, sales_data: List[Dict]) -> Dict[str, Any]:
    """
    AI応答をJSON形式に構造化
    """
    try:
        # 基本的な構造化情報
        structured = {
            'summary': '',
            'key_insights': [],
            'recommendations': [],
            'data_analysis': {
                'total_records': len(sales_data) if sales_data else 0,
                'metrics': {}
            },
            'raw_response': ai_response
        }
        
        # シンプルな解析（改行で分割して構造化）
        lines = ai_response.split('\n')
        current_section = 'summary'
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # セクションの判定
            if '分析結果' in line or 'まとめ' in line:
                current_section = 'summary'
            elif '提案' in line or '改善' in line or 'おすすめ' in line:
                current_section = 'recommendations'
            elif '特徴' in line or 'ポイント' in line or '傾向' in line:
                current_section = 'key_insights'
            elif line.startswith('- ') or line.startswith('• '):
                # リスト項目の処理
                clean_line = line[2:].strip()
                if current_section == 'key_insights':
                    structured['key_insights'].append(clean_line)
                elif current_section == 'recommendations':
                    structured['recommendations'].append(clean_line)
            elif len(line) > 20 and current_section == 'summary' and not structured['summary']:
                structured['summary'] = line
        
        # サマリーが空の場合、最初の段落を使用
        if not structured['summary'] and ai_response:
            first_paragraph = ai_response.split('\n\n')[0] if '\n\n' in ai_response else ai_response[:200]
            structured['summary'] = first_paragraph.strip()
        
        return structured
        
    except Exception as e:
        logger.error(f"JSON parsing error: {str(e)}")
        # エラー時は基本構造だけ返す
        return {
            'summary': 'AI応答の構造化処理でエラーが発生しました',
            'key_insights': [],
            'recommendations': [],
            'data_analysis': {
                'total_records': len(sales_data) if sales_data else 0,
                'metrics': {}
            },
            'raw_response': ai_response
        }


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


def handle_options() -> Dict[str, Any]:
    """
    CORS preflight リクエスト処理
    """
    return response_builder(200, {"message": "CORS preflight OK"})