# 多段階LLM構成設計書 【最終形態 - フェーズ3実装予定】

## 🎯 構想概要

本システムでは、処理の複雑度とコスト効率を考慮し、3つの異なる性能レベルのLLMを使い分ける多段階処理構成を実現します。企業のニーズと予算に応じてLLMを選択できるカスタマイズ機能も提供します。

## 📊 3段階LLM分類

### 🚀 Level 1: 高度分析LLM (Premium Tier)
**用途**: 複雑な戦略分析・高度な推奨事項

**処理内容**:
- 売上予測・将来戦略立案
- 市場トレンド分析・競合分析  
- 複雑なビジネス判断・意思決定支援
- カスタム業界分析・専門的アドバイス

**推奨モデル**:
- `Claude 3.5 Sonnet` (最高性能)
- `GPT-4 Turbo` (OpenAI)
- `Gemini Ultra` (Google)

**コスト**: 高 ($0.02-0.06/1K tokens)

### ⚡ Level 2: 中度分析LLM (Standard Tier)  
**用途**: 標準的なデータ分析・トレンド解析

**処理内容**:
- 売上データの傾向分析
- グラフ解釈・数値サマリー
- 基本的な改善提案
- 一般的なビジネスアドバイス

**推奨モデル**:
- `Claude 3 Sonnet` (バランス型)
- `GPT-3.5 Turbo` (OpenAI)
- `Gemini Pro` (Google)

**コスト**: 中 ($0.003-0.015/1K tokens)

### 💡 Level 3: 基本処理LLM (Economy Tier)
**用途**: データ抽出・振り分け・簡単な処理

**処理内容**:
- CSVデータの読み取り・解釈
- カラム名の意味理解
- 基本的な数値抽出・集計
- 簡単な質問応答・案内

**推奨モデル**:
- `Claude 3 Haiku` (高速・安価)
- `GPT-3.5 Turbo Mini` (OpenAI)
- `Gemini Flash` (Google)

**コスト**: 低 ($0.0003-0.002/1K tokens)

## 🏗️ システム構成

### 現在のシステム (単一LLM)

```
[React Frontend] 
    ↓ 
[API Gateway] 
    ↓ 
[Lambda Function]
    ↓ 
[Bedrock - Claude 3 Sonnet (固定)]
    ↓
[単一レスポンス]
```

### 理想的な多段階LLMシステム

```
[React Frontend] 
    ↓ (リクエスト + 複雑度指定)
[API Gateway] 
    ↓ 
[Lambda Router Function]
    ↓ (判定・振り分け)
┌─────────────────────────────────────────────────────────┐
│                    LLM Selection Engine                 │
├─────────────────────┬─────────────────────┬─────────────────────┤
│   High Complexity   │  Medium Complexity  │   Low Complexity    │
│                     │                     │                     │
│ [Bedrock]           │ [Bedrock]           │ [Bedrock]           │
│ Claude 3.5 Sonnet   │ Claude 3 Sonnet     │ Claude 3 Haiku      │
│                     │                     │                     │
│ 戦略分析・予測       │ データ分析・傾向     │ データ抽出・振り分け │
└─────────────────────┴─────────────────────┴─────────────────────┘
    ↓                     ↓                     ↓
[高度分析結果]          [標準分析結果]          [基本処理結果]
    ↓                     ↓                     ↓
[統合レスポンス] ← [Response Aggregator] → [React Frontend]
```

## 🔧 技術実装設計

### Lambda Router Function

```python
import boto3
import json
from typing import Dict, Any, Tuple

class LLMRouter:
    def __init__(self):
        self.bedrock = boto3.client('bedrock-runtime')
        
        # 企業別LLM設定
        self.company_configs = {
            "default": {
                "high": "anthropic.claude-3-5-sonnet-20240620-v1:0",
                "medium": "anthropic.claude-3-sonnet-20240229-v1:0", 
                "low": "anthropic.claude-3-haiku-20240307-v1:0"
            }
        }
    
    def analyze_complexity(self, prompt: str, sales_data: list) -> str:
        """リクエストの複雑度を判定"""
        
        complexity_keywords = {
            "high": [
                "予測", "将来", "戦略", "競合", "市場分析", "ROI", 
                "投資", "リスク", "機会", "最適化", "予算配分"
            ],
            "medium": [
                "分析", "傾向", "トレンド", "比較", "推移", "成長率",
                "季節性", "パターン", "相関", "要因"
            ],
            "low": [
                "表示", "抽出", "集計", "一覧", "確認", "データ",
                "グラフ", "合計", "平均", "最大", "最小"
            ]
        }
        
        prompt_lower = prompt.lower()
        
        # キーワードマッチングによる判定
        for level, keywords in complexity_keywords.items():
            if any(keyword in prompt_lower for keyword in keywords):
                return level
        
        # データサイズによる判定
        if sales_data and len(sales_data) > 1000:
            return "high"
        elif sales_data and len(sales_data) > 100:
            return "medium"
        
        return "low"
    
    def get_model_config(self, company_id: str, complexity: str) -> Dict[str, Any]:
        """企業・複雑度に応じたモデル設定取得"""
        
        config = self.company_configs.get(company_id, self.company_configs["default"])
        model_id = config[complexity]
        
        # 複雑度別パラメータ設定
        params = {
            "high": {
                "max_tokens": 4000,
                "temperature": 0.1,
                "top_p": 0.9
            },
            "medium": {
                "max_tokens": 2000,
                "temperature": 0.1,
                "top_p": 0.8
            },
            "low": {
                "max_tokens": 1000,
                "temperature": 0.0,
                "top_p": 0.7
            }
        }
        
        return {
            "model_id": model_id,
            "parameters": params[complexity]
        }
    
    def invoke_llm(self, model_config: Dict[str, Any], prompt: str) -> str:
        """指定されたLLMを呼び出し"""
        
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": model_config["parameters"]["max_tokens"],
            "temperature": model_config["parameters"]["temperature"],
            "top_p": model_config["parameters"]["top_p"],
            "messages": [
                {"role": "user", "content": prompt}
            ]
        }
        
        response = self.bedrock.invoke_model(
            modelId=model_config["model_id"],
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(response['body'].read())
        return response_body['content'][0]['text']

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """メインのルーター関数"""
    
    try:
        body = json.loads(event.get('body', '{}'))
        prompt = body.get('prompt', '')
        sales_data = body.get('salesData', [])
        company_id = body.get('companyId', 'default')
        
        router = LLMRouter()
        
        # 1. 複雑度判定
        complexity = router.analyze_complexity(prompt, sales_data)
        
        # 2. モデル設定取得
        model_config = router.get_model_config(company_id, complexity)
        
        # 3. プロンプト構築
        enhanced_prompt = build_specialized_prompt(prompt, sales_data, complexity)
        
        # 4. LLM実行
        ai_response = router.invoke_llm(model_config, enhanced_prompt)
        
        # 5. レスポンス構築
        return response_builder(200, {
            'response': ai_response,
            'metadata': {
                'complexity': complexity,
                'model_used': model_config['model_id'],
                'processing_tier': get_tier_name(complexity)
            }
        })
        
    except Exception as e:
        return response_builder(500, f'エラー: {str(e)}')

def build_specialized_prompt(user_prompt: str, sales_data: list, complexity: str) -> str:
    """複雑度に応じた専用プロンプト構築"""
    
    base_prompts = {
        "high": """
あなたは経営戦略コンサルタントです。高度な分析と戦略的提案を行ってください。

【分析要件】
1. 深層的なトレンド分析
2. 将来予測とシナリオ分析  
3. 具体的な戦略提案
4. リスクと機会の評価
5. ROI・投資効果の検討

【データ】
{data_summary}

【質問】
{user_prompt}

【高度な戦略分析】
""",
        "medium": """
あなたは売上データ分析の専門家です。標準的な分析と改善提案を行ってください。

【分析要件】
1. データの傾向とパターン分析
2. 主要な要因の特定
3. 実用的な改善提案
4. 数値根拠の明示

【データ】
{data_summary}

【質問】
{user_prompt}

【標準分析】
""",
        "low": """
あなたはデータ処理アシスタントです。シンプルで明確な情報整理を行ってください。

【処理要件】
1. データの基本情報抽出
2. 簡潔な集計・要約
3. 分かりやすい説明
4. 必要に応じた基本的なアドバイス

【データ】
{data_summary}

【質問】
{user_prompt}

【基本処理】
"""
    }
    
    # データサマリー作成
    data_summary = create_data_summary(sales_data, complexity)
    
    return base_prompts[complexity].format(
        data_summary=data_summary,
        user_prompt=user_prompt
    )

def get_tier_name(complexity: str) -> str:
    """ティア名称取得"""
    tier_names = {
        "high": "Premium Tier (高度分析)",
        "medium": "Standard Tier (標準分析)", 
        "low": "Economy Tier (基本処理)"
    }
    return tier_names.get(complexity, "Unknown")
```

## 🎛️ 企業別カスタマイズ設定

### 設定管理テーブル (DynamoDB)

```json
{
  "TableName": "CompanyLLMConfigs",
  "Schema": {
    "CompanyId": "string",
    "ConfigType": "string", // "llm_settings"
    "Settings": {
      "high_complexity": {
        "model_id": "anthropic.claude-3-5-sonnet-20240620-v1:0",
        "max_tokens": 4000,
        "temperature": 0.1,
        "cost_limit_monthly": 1000
      },
      "medium_complexity": {
        "model_id": "anthropic.claude-3-sonnet-20240229-v1:0", 
        "max_tokens": 2000,
        "temperature": 0.1,
        "cost_limit_monthly": 500
      },
      "low_complexity": {
        "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
        "max_tokens": 1000,
        "temperature": 0.0,
        "cost_limit_monthly": 100
      },
      "total_monthly_budget": 1600,
      "auto_downgrade": true
    }
  }
}
```

### フロントエンド設定UI

```typescript
interface LLMConfig {
  complexity: 'high' | 'medium' | 'low';
  modelId: string;
  monthlyBudget: number;
  autoDowngrade: boolean;
}

const LLMConfigPanel: React.FC = () => {
  const [configs, setConfigs] = useState<Record<string, LLMConfig>>({});
  
  return (
    <div className="llm-config-panel">
      <h3>🤖 LLM設定カスタマイズ</h3>
      
      {['high', 'medium', 'low'].map(complexity => (
        <div key={complexity} className="config-section">
          <h4>{getTierName(complexity)}</h4>
          
          <select 
            value={configs[complexity]?.modelId}
            onChange={(e) => updateConfig(complexity, 'modelId', e.target.value)}
          >
            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (¥2,400/月)</option>
            <option value="claude-3-sonnet">Claude 3 Sonnet (¥1,200/月)</option>
            <option value="claude-3-haiku">Claude 3 Haiku (¥240/月)</option>
          </select>
          
          <input
            type="number"
            placeholder="月間予算 (円)"
            value={configs[complexity]?.monthlyBudget}
            onChange={(e) => updateConfig(complexity, 'monthlyBudget', Number(e.target.value))}
          />
        </div>
      ))}
      
      <div className="total-budget">
        <strong>月間総予算: ¥{calculateTotalBudget(configs).toLocaleString()}</strong>
      </div>
      
      <button onClick={saveConfigs}>設定を保存</button>
    </div>
  );
};
```

## 💰 コスト最適化機能

### 自動ダウングレード機能

```python
def cost_optimizer_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """コスト最適化・自動ダウングレード"""
    
    company_id = event.get('companyId')
    
    # 月間使用量取得
    monthly_usage = get_monthly_usage(company_id)
    budget_config = get_budget_config(company_id)
    
    # 予算超過チェック
    if monthly_usage['total_cost'] > budget_config['total_monthly_budget'] * 0.8:
        
        # 自動ダウングレード実行
        downgrade_recommendations = []
        
        for complexity in ['high', 'medium', 'low']:
            tier_usage = monthly_usage[f'{complexity}_usage']
            tier_budget = budget_config[f'{complexity}_budget']
            
            if tier_usage > tier_budget * 0.9:
                # より安価なモデルに自動変更
                cheaper_model = get_cheaper_alternative(
                    budget_config[f'{complexity}_model']
                )
                
                if cheaper_model:
                    update_company_config(company_id, complexity, cheaper_model)
                    downgrade_recommendations.append({
                        'tier': complexity,
                        'from': budget_config[f'{complexity}_model'],
                        'to': cheaper_model['model_id'],
                        'savings': cheaper_model['cost_reduction']
                    })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'monthly_usage': monthly_usage,
            'budget_status': 'warning' if monthly_usage['total_cost'] > budget_config['total_monthly_budget'] * 0.8 else 'ok',
            'downgrades': downgrade_recommendations
        })
    }
```

## 🚀 実装フェーズ

### Phase 1: 基本ルーティング実装 (1週間)
- [ ] 複雑度判定ロジック
- [ ] 基本的な3段階LLM振り分け
- [ ] レスポンス統合機能

### Phase 2: 企業別カスタマイズ (1週間)
- [ ] 設定管理システム
- [ ] フロントエンド設定UI
- [ ] 動的モデル選択

### Phase 3: コスト最適化 (1週間)
- [ ] 使用量トラッキング
- [ ] 予算管理・アラート
- [ ] 自動ダウングレード機能

### Phase 4: 高度な最適化 (1週間)
- [ ] AI-based複雑度判定
- [ ] パフォーマンス分析
- [ ] 企業特化チューニング

## 📊 期待される効果

### コスト削減
- **基本処理**: 従来比80%削減
- **標準分析**: 従来比50%削減  
- **高度分析**: 従来比20%削減
- **全体**: 平均60%のコスト削減

### パフォーマンス向上
- **応答速度**: 基本処理で3倍高速化
- **精度**: 複雑度に応じた最適化により向上
- **ユーザー満足度**: カスタマイズにより向上

---

**作成日**: 2025年8月18日  
**最終更新**: 2025年8月18日  
**バージョン**: 1.0  
**ステータス**: 設計完了・実装準備中