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
        # CORS headers - simplified to avoid duplicates
        headers = {
            "Content-Type": "application/json"
        }

        # Function URLの場合はrequestContextからメソッドを取得
        http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method')

        logger.info(f"HTTP Method: {http_method}")

        # OPTIONS リクエスト (CORS preflight)
        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'message': 'CORS preflight'})
            }

        # POST リクエストのみ許可
        if http_method != 'POST':
            return {
                'statusCode': 405,
                'headers': headers,
                'body': json.dumps({'error': f'Method {http_method} not allowed'})
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
                "Content-Type": "application/json"
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

        # 強化されたシステムプロンプト
        system_prompt = """あなたは高精度なビジネス文書・データ分析の専門家です。

**OCR・テキスト抽出タスク:**
- 文字や数値は1文字も見落とさず、完全に正確に読み取る
- 表・グラフ・チャートの数値データは全て漏れなく抽出
- 曖昧な文字は文脈から推測して最も適切な解釈を提示
- レイアウト構造（表の行列関係、見出し階層）を正確に把握

**データ分析タスク:**
1. **構造的データ読み取り**: 表・グラフの全データを体系的に抽出
2. **数値計算**: ROI、増減率、平均値、合計値等を正確に算出
3. **トレンド分析**: 時系列変化、パフォーマンス比較、パターン発見
4. **ビジネス洞察**: 戦略的示唆、改善提案、リスク要因の特定
5. **具体的推奨**: 実行可能なアクションプランの提示

**出力形式:**
- 抽出データは表形式で整理
- 重要な数値は具体的に明記
- 分析結果は論理的な構造で整理
- 日本語で専門的かつ分かりやすく記述

精度と詳細性を最優先とし、推測ではなく画像から確実に読み取れる情報のみを報告してください。"""

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