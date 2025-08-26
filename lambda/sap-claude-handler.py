import json
import boto3
import os
import logging
from typing import Dict, List, Any, Optional
import pandas as pd
from io import StringIO

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize Bedrock client
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')

def response_builder(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """Build API Gateway response with proper CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,PUT,DELETE'
        },
        'body': json.dumps(body, ensure_ascii=False)
    }

def parse_csv_data(csv_content: str) -> pd.DataFrame:
    """Parse CSV content into a pandas DataFrame"""
    try:
        # Try different encodings and delimiters
        csv_file = StringIO(csv_content)
        df = pd.read_csv(csv_file)
        return df
    except Exception as e:
        logger.error(f"Error parsing CSV: {str(e)}")
        raise

def analyze_data_structure(df: pd.DataFrame) -> Dict[str, Any]:
    """Analyze the structure and basic statistics of the data"""
    analysis = {
        'row_count': len(df),
        'column_count': len(df.columns),
        'columns': list(df.columns),
        'data_types': df.dtypes.to_dict(),
        'null_counts': df.isnull().sum().to_dict(),
        'summary_stats': {}
    }
    
    # Add summary statistics for numeric columns
    numeric_columns = df.select_dtypes(include=['number']).columns
    for col in numeric_columns:
        analysis['summary_stats'][col] = {
            'mean': float(df[col].mean()) if not df[col].isna().all() else None,
            'median': float(df[col].median()) if not df[col].isna().all() else None,
            'std': float(df[col].std()) if not df[col].isna().all() else None,
            'min': float(df[col].min()) if not df[col].isna().all() else None,
            'max': float(df[col].max()) if not df[col].isna().all() else None
        }
    
    return analysis

def build_analysis_prompt(df: pd.DataFrame, data_analysis: Dict[str, Any]) -> str:
    """Build a comprehensive prompt for Claude analysis"""
    
    # Get sample data (first 5 rows)
    sample_data = df.head(5).to_string(index=False)
    
    # Build the prompt
    prompt = f"""以下のCSVデータを分析し、売上分析レポートを作成してください。

データの基本情報:
- 行数: {data_analysis['row_count']}
- 列数: {data_analysis['column_count']}
- 列名: {', '.join(data_analysis['columns'])}

サンプルデータ (最初の5行):
{sample_data}

データの統計情報:
{json.dumps(data_analysis['summary_stats'], indent=2, ensure_ascii=False)}

以下の観点から包括的な分析を行ってください:

1. **データ概要**
   - データの性質と特徴
   - データ品質の評価（欠損値、異常値など）

2. **売上トレンド分析**
   - 時系列での売上推移
   - 季節性やパターンの特定
   - 成長率の分析

3. **セグメント別分析**
   - 製品別、地域別、顧客別などの売上分析
   - 最も収益性の高いセグメントの特定

4. **パフォーマンス指標**
   - KPI（売上成長率、利益率など）の計算
   - ベンチマークとの比較

5. **インサイトと提案**
   - データから読み取れる重要なインサイト
   - ビジネス改善のための具体的な提案
   - リスクファクターの特定

6. **次のアクション**
   - 優先すべき改善領域
   - 推奨される戦略的アクション

回答は日本語で、ビジネス関係者にとって理解しやすい形で提供してください。
具体的な数値やデータポイントを含めて説明し、実用的なビジネスインサイトを提供してください。"""

    return prompt

def call_claude_api(prompt: str) -> str:
    """Call Claude API via AWS Bedrock"""
    try:
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4000,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        response = bedrock_runtime.invoke_model(
            modelId="anthropic.claude-3-sonnet-20240229-v1:0",
            body=json.dumps(body)
        )
        
        response_body = json.loads(response['body'].read())
        return response_body['content'][0]['text']
        
    except Exception as e:
        logger.error(f"Error calling Claude API: {str(e)}")
        raise

def generate_mock_insights() -> Dict[str, Any]:
    """Generate mock insights for testing purposes"""
    return {
        "overview": "データ分析が完了しました。売上データから重要なトレンドとインサイトを特定しました。",
        "key_metrics": {
            "total_revenue": "¥15,234,567",
            "growth_rate": "+12.5%",
            "avg_order_value": "¥4,521",
            "conversion_rate": "3.2%"
        },
        "insights": [
            "第3四半期に売上が20%増加しており、季節要因が強く影響している",
            "プレミアム製品カテゴリが全体の売上の45%を占めている",
            "東京エリアの売上成長率が他地域より15%高い",
            "リピート顧客の平均購入金額が新規顧客の2.3倍"
        ],
        "recommendations": [
            "第3四半期の成功要因を分析し、他四半期にも適用する",
            "プレミアム製品の在庫管理とマーケティングを強化する",
            "東京エリアの成功事例を他地域に展開する",
            "リピート顧客向けのロイヤリティプログラムを導入する"
        ]
    }

def lambda_handler(event, context):
    """Main Lambda handler"""
    try:
        # Handle OPTIONS request for CORS (support both v1 and v2 API Gateway formats)
        http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method')
        if http_method == 'OPTIONS':
            logger.info("Handling OPTIONS preflight request")
            return response_builder(200, {'message': 'CORS preflight successful'})
        
        # Log the event for debugging
        logger.info(f"Received event: {json.dumps(event, default=str)}")
        
        # Parse request body
        if 'body' not in event or not event['body']:
            return response_builder(400, {'error': 'Request body is required'})
        
        try:
            body = json.loads(event['body'])
        except json.JSONDecodeError:
            return response_builder(400, {'error': 'Invalid JSON in request body'})
        
        # Validate required fields - accept both csvData and data field
        csv_data = None
        if 'csvData' in body:
            csv_data = body['csvData']
        elif 'data' in body or 'salesData' in body:
            # Convert array data to CSV format
            array_data = body.get('data') or body.get('salesData')
            if isinstance(array_data, list) and len(array_data) > 0:
                # Convert array of objects to CSV
                import pandas as pd
                df = pd.DataFrame(array_data)
                csv_data = df.to_csv(index=False)
            else:
                return response_builder(400, {'error': 'Data field must be a non-empty array'})
        else:
            return response_builder(400, {'error': 'csvData, data, or salesData field is required'})
        
        csv_content = csv_data
        response_format = body.get('format', 'json')  # 'json' or 'text'
        
        # Parse CSV data
        try:
            df = parse_csv_data(csv_content)
            logger.info(f"Successfully parsed CSV with {len(df)} rows and {len(df.columns)} columns")
        except Exception as e:
            return response_builder(400, {'error': f'Failed to parse CSV data: {str(e)}'})
        
        # Analyze data structure
        data_analysis = analyze_data_structure(df)
        
        # Check if we should use real Claude API or mock data
        use_claude = os.environ.get('USE_CLAUDE_API', 'true').lower() == 'true'
        
        if use_claude:
            try:
                # Build prompt and call Claude API
                prompt = build_analysis_prompt(df, data_analysis)
                claude_response = call_claude_api(prompt)
                
                if response_format == 'text':
                    return response_builder(200, {
                        'analysis': claude_response,
                        'data_info': data_analysis
                    })
                else:
                    # For JSON format, we need to structure the response
                    # In a real implementation, you might want to parse Claude's response
                    # into structured JSON, but for now we'll return it as text
                    return response_builder(200, {
                        'overview': claude_response[:200] + '...',
                        'full_analysis': claude_response,
                        'data_info': data_analysis,
                        'insights': ['Claude analysis completed successfully'],
                        'recommendations': ['詳細な分析結果を確認してください']
                    })
                    
            except Exception as e:
                logger.error(f"Error calling Claude API: {str(e)}")
                return response_builder(500, {'error': f'AI analysis failed: {str(e)}'})
        else:
            # Use mock data for testing
            mock_insights = generate_mock_insights()
            mock_insights['data_info'] = data_analysis
            return response_builder(200, mock_insights)
            
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return response_builder(500, {'error': f'Internal server error: {str(e)}'})