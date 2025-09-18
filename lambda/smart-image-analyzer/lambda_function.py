#!/usr/bin/env python3
"""
Smart Image Analysis Platform - Lambda Function
High-performance image analysis using Claude Sonnet 4 Vision API
"""

import json
import base64
import boto3
import logging
import os
from typing import Dict, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Smart Image Analysis Lambda Handler
    Processes images with Claude Sonnet 4 for business intelligence
    """
    logger.info(f"Event received: {json.dumps(event, default=str)}")

    try:
        # CORS headers
        headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        }

        # HTTP method detection for Function URLs
        http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method')

        # Handle CORS preflight
        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'message': 'CORS preflight successful'})
            }

        # Only allow POST requests
        if http_method != 'POST':
            return {
                'statusCode': 405,
                'headers': headers,
                'body': json.dumps({'error': f'Method {http_method} not allowed'})
            }

        # Parse request body
        body = event.get('body', '{}')
        if isinstance(body, str):
            data = json.loads(body)
        else:
            data = body

        # Validate required fields
        if 'image_data' not in data:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'image_data is required'})
            }

        # Extract parameters
        prompt = data.get('prompt', 'この画像を詳細に分析してください。')
        image_data = data['image_data']

        # Analyze image with Claude Vision API
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
        logger.error(f"Analysis error: {str(e)}", exc_info=True)
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
    Analyze image using Claude Sonnet 4 Vision API via AWS Bedrock
    """
    # Environment configuration
    model_id = os.environ.get('BEDROCK_MODEL_ID', 'us.anthropic.claude-sonnet-4-20250514-v1:0')
    region = os.environ.get('BEDROCK_REGION', 'us-east-1')
    max_tokens = int(os.environ.get('MAX_TOKENS', '4000'))
    temperature = float(os.environ.get('TEMPERATURE', '0.1'))

    try:
        # Initialize Bedrock client
        bedrock = boto3.client('bedrock-runtime', region_name=region)

        # Enhanced system prompt for business analysis
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

        # Prepare message for Claude Vision API
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

        # Call Bedrock Converse API
        response = bedrock.converse(
            modelId=model_id,
            system=[{"text": system_prompt}],
            messages=messages,
            inferenceConfig={
                "maxTokens": max_tokens,
                "temperature": temperature
            }
        )

        # Extract response text
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