import json
import base64
import boto3
import logging
from typing import Dict, Any

# ログ設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    画像分析専用Lambda関数
    Claude Vision APIを使用して画像を分析
    """
    logger.info(f"Event: {json.dumps(event, default=str)}")

    try:
        # CORS headers
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        }

        # OPTIONS リクエスト (CORS preflight)
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'message': 'CORS preflight'})
            }

        # POST リクエストのみ許可
        if event.get('httpMethod') != 'POST':
            return {
                'statusCode': 405,
                'headers': headers,
                'body': json.dumps({'error': 'Method not allowed'})
            }

        # リクエストボディを解析
        body = event.get('body', '{}')
        if isinstance(body, str):
            data = json.loads(body)
        else:
            data = body

        logger.info(f"Parsed data keys: {list(data.keys())}")

        # 必須フィールドの確認
        if 'image_data' not in data:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'image_data is required'})
            }

        # 画像分析を実行
        prompt = data.get('prompt', 'この画像を詳細に分析してください。')
        image_data = data['image_data']

        # Claude APIで画像分析
        result = analyze_image_with_claude(image_data, prompt)

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'result': result,
                'status': 'success'
            }, ensure_ascii=False)
        }

    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            'body': json.dumps({
                'error': str(e),
                'status': 'error'
            })
        }

def analyze_image_with_claude(image_data: str, prompt: str) -> str:
    """
    Claude Vision APIで画像を分析
    """
    import os

    # 環境変数から設定を取得
    model_id = os.environ.get('BEDROCK_MODEL_ID', 'anthropic.claude-3-sonnet-20240229-v1:0')
    region = os.environ.get('BEDROCK_REGION', 'us-east-1')

    try:
        # Bedrock Runtime クライアント
        bedrock = boto3.client('bedrock-runtime', region_name=region)

        # システムプロンプト
        system_prompt = """あなたは画像分析の専門家です。
画像の内容を詳細に分析し、以下の観点から説明してください：

1. 画像の基本情報（種類、主要な要素）
2. テキストがある場合は正確に読み取り
3. 数値データやグラフがある場合は内容を分析
4. ビジネス上の意味や示唆があれば説明
5. 実用的な洞察や提案

日本語で分かりやすく、具体的に回答してください。"""

        # Claude API用のメッセージ形式（Bedrock Converse API）
        messages = [{
            "role": "user",
            "content": [
                {"text": prompt},
                {
                    "image": {
                        "format": "png",
                        "source": {
                            "bytes": base64.b64decode(image_data)
                        }
                    }
                }
            ]
        }]

        # Bedrock Converse APIでリクエスト
        response = bedrock.converse(
            modelId=model_id,
            system=[{"text": system_prompt}],
            messages=messages,
            inferenceConfig={
                "maxTokens": int(os.environ.get('MAX_TOKENS', '1500')),
                "temperature": float(os.environ.get('TEMPERATURE', '0.2'))
            }
        )

        # レスポンスからテキストを抽出
        if 'output' in response and 'message' in response['output']:
            content = response['output']['message'].get('content', [])
            result_text = ""
            for item in content:
                if item.get('text'):
                    result_text += item['text']
            return result_text.strip()
        else:
            return "画像分析が完了しましたが、結果の取得に失敗しました。"

    except Exception as e:
        logger.error(f"Claude API error: {str(e)}")
        raise Exception(f"画像分析エラー: {str(e)}")