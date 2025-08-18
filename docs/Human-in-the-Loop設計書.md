# Human in the Loop 設計書 【将来機能 - フェーズ2実装予定】

## 🔄 概要

Human in the Loopは、AIシステムに人間の判断と学習を組み込むことで、継続的にシステムの精度を向上させる仕組みです。本システムでは、企業の担当者が分析プロセスの各段階で確認・修正を行い、その結果をAIが学習することで企業特化カスタマイズを実現します。

## 🎯 設計目標

### 主要目標
1. **段階的確認**: データ解釈・分析結果の段階的人間確認
2. **継続学習**: フィードバックを通じたAI精度向上  
3. **企業特化**: 各企業の業界・文化に適応したカスタマイズ
4. **信頼性向上**: 人間の監督による分析結果の信頼性確保

### 成功指標
- AI分析精度: 初期70% → 6ヶ月後90%
- ユーザー信頼度: 4.5/5以上
- 業務効率向上: 分析作業時間50%削減

## 🔧 技術実装設計

### システム構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AI Service    │
│                 │    │                 │    │                 │
│  確認UI         │◄──►│  フィードバック  │◄──►│  学習エンジン    │
│  修正インターフェース │    │  データ管理     │    │  カスタムモデル  │
│  進捗表示       │    │  学習ロジック    │    │  Bedrock+       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### データモデル設計

#### 1. フィードバックセッション

```typescript
interface FeedbackSession {
  sessionId: string;              // セッション識別子
  companyId: string;              // 企業識別子
  userId: string;                 // ユーザー識別子
  moduleType: ModuleType;         // モジュール種別
  createdAt: Date;               // 作成日時
  status: SessionStatus;          // セッション状態
  steps: FeedbackStep[];         // フィードバックステップ
}

type ModuleType = 'sales' | 'reports' | 'customers' | 'projects';
type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
```

#### 2. フィードバックステップ

```typescript
interface FeedbackStep {
  stepId: string;                 // ステップ識別子
  stepType: StepType;            // ステップ種別
  title: string;                 // ステップタイトル
  description: string;           // 説明文
  aiSuggestion: any;             // AI提案内容
  userFeedback?: UserFeedback;   // ユーザーフィードバック
  status: StepStatus;            // ステップ状態
  timestamp: Date;               // タイムスタンプ
}

type StepType = 'data_confirmation' | 'column_mapping' | 'analysis_review' | 'result_validation';
type StepStatus = 'pending' | 'approved' | 'modified' | 'rejected';
```

#### 3. ユーザーフィードバック

```typescript
interface UserFeedback {
  action: FeedbackAction;         // アクション種別
  confidence: number;             // 信頼度 (1-5)
  modifications?: any;            // 修正内容
  comments?: string;              // コメント
  businessContext?: string;       // ビジネス文脈
  timestamp: Date;               // フィードバック時刻
}

type FeedbackAction = 'approve' | 'modify' | 'reject' | 'skip';
```

#### 4. 学習データ

```typescript
interface LearningData {
  dataId: string;                 // データ識別子
  companyId: string;              // 企業識別子
  moduleType: ModuleType;         // モジュール種別
  inputData: any;                 // 入力データ
  aiOutput: any;                  // AI出力
  humanFeedback: UserFeedback;    // 人間フィードバック
  learningWeight: number;         // 学習重み
  createdAt: Date;               // 作成日時
}
```

## 📱 フロントエンド実装

### Human in the Loop UI コンポーネント

#### 1. データ確認画面

```typescript
interface DataConfirmationProps {
  uploadedData: SalesData[];
  detectedSchema: DataSchema;
  onConfirm: (confirmedSchema: DataSchema) => void;
  onModify: (modifications: SchemaModification[]) => void;
}

const DataConfirmationStep: React.FC<DataConfirmationProps> = ({
  uploadedData,
  detectedSchema,
  onConfirm,
  onModify
}) => {
  const [modifications, setModifications] = useState<SchemaModification[]>([]);
  
  return (
    <div className="data-confirmation-step">
      <h3>📊 アップロードされたデータの確認</h3>
      
      {/* データプレビュー */}
      <DataPreview data={uploadedData.slice(0, 10)} />
      
      {/* カラム検出結果 */}
      <DetectedColumnsReview 
        schema={detectedSchema}
        onModify={setModifications}
      />
      
      {/* 確認ボタン */}
      <div className="confirmation-actions">
        <button onClick={() => onConfirm(detectedSchema)}>
          ✅ この解釈で正しいです
        </button>
        <button onClick={() => onModify(modifications)}>
          ✏️ 修正があります
        </button>
      </div>
      
      {/* ビジネス文脈入力 */}
      <BusinessContextInput 
        placeholder="この売上データに関する補足情報があれば入力してください..."
      />
    </div>
  );
};
```

#### 2. 分析結果確認画面

```typescript
interface AnalysisReviewProps {
  analysisResult: AnalysisResult;
  onFeedback: (feedback: AnalysisFeedback) => void;
}

const AnalysisReviewStep: React.FC<AnalysisReviewProps> = ({
  analysisResult,
  onFeedback
}) => {
  const [feedback, setFeedback] = useState<AnalysisFeedback>({
    accuracy: 3,
    relevance: 3,
    actionability: 3,
    comments: ''
  });

  return (
    <div className="analysis-review-step">
      <h3>🔍 AI分析結果の確認</h3>
      
      {/* 分析結果表示 */}
      <AnalysisResultDisplay result={analysisResult} />
      
      {/* フィードバック収集 */}
      <FeedbackForm 
        feedback={feedback}
        onChange={setFeedback}
      />
      
      {/* 評価スライダー */}
      <div className="rating-section">
        <RatingSlider 
          label="分析の正確性"
          value={feedback.accuracy}
          onChange={(value) => setFeedback({...feedback, accuracy: value})}
        />
        <RatingSlider 
          label="ビジネスへの関連性"
          value={feedback.relevance}
          onChange={(value) => setFeedback({...feedback, relevance: value})}
        />
        <RatingSlider 
          label="実行可能性"
          value={feedback.actionability}
          onChange={(value) => setFeedback({...feedback, actionability: value})}
        />
      </div>
      
      {/* コメント入力 */}
      <textarea
        placeholder="この分析について、追加のコメントや修正点があれば入力してください..."
        value={feedback.comments}
        onChange={(e) => setFeedback({...feedback, comments: e.target.value})}
      />
      
      <button onClick={() => onFeedback(feedback)}>
        💾 フィードバックを送信
      </button>
    </div>
  );
};
```

#### 3. 進捗表示コンポーネント

```typescript
const HumanInTheLoopProgress: React.FC<{session: FeedbackSession}> = ({session}) => {
  const completedSteps = session.steps.filter(step => step.status !== 'pending').length;
  const totalSteps = session.steps.length;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <div className="hitl-progress">
      <h4>🔄 Human in the Loop 進捗</h4>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{width: `${progress}%`}}
        />
      </div>
      <p>{completedSteps}/{totalSteps} ステップ完了</p>
      
      <div className="step-list">
        {session.steps.map(step => (
          <div key={step.stepId} className={`step-item ${step.status}`}>
            <span className="step-icon">
              {step.status === 'approved' ? '✅' : 
               step.status === 'modified' ? '✏️' : 
               step.status === 'rejected' ? '❌' : '⏳'}
            </span>
            <span className="step-title">{step.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## ⚙️ バックエンド実装

### Lambda 関数拡張

#### 1. フィードバック処理関数

```python
import boto3
import json
from datetime import datetime
from typing import Dict, Any

def process_feedback_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Human in the Loop フィードバック処理"""
    
    try:
        body = json.loads(event.get('body', '{}'))
        session_id = body.get('sessionId')
        feedback = body.get('feedback')
        
        # DynamoDB接続
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('HumanInTheLoopFeedback')
        
        # フィードバック保存
        feedback_record = {
            'SessionId': session_id,
            'Timestamp': datetime.utcnow().isoformat(),
            'Feedback': feedback,
            'TTL': int((datetime.utcnow().timestamp() + 86400 * 365))  # 1年後削除
        }
        
        table.put_item(Item=feedback_record)
        
        # 学習データとして処理
        learning_result = process_learning_data(feedback)
        
        return response_builder(200, {
            'message': 'フィードバックを受信しました',
            'learningResult': learning_result
        })
        
    except Exception as e:
        return response_builder(500, f'エラー: {str(e)}')

def process_learning_data(feedback: Dict[str, Any]) -> Dict[str, Any]:
    """学習データ処理"""
    
    # ベクトル化とモデル更新ロジック
    learning_weight = calculate_learning_weight(feedback)
    
    # Bedrock Fine-tuning データ準備
    training_data = prepare_training_data(feedback)
    
    # カスタマイズパラメータ更新
    updated_params = update_customization_params(feedback)
    
    return {
        'learningWeight': learning_weight,
        'trainingDataSize': len(training_data),
        'updatedParams': updated_params
    }
```

#### 2. 学習エンジン

```python
def learning_engine_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """継続学習エンジン"""
    
    try:
        company_id = event.get('companyId')
        
        # 累積フィードバックデータ取得
        feedback_history = get_feedback_history(company_id)
        
        # パターン分析
        patterns = analyze_feedback_patterns(feedback_history)
        
        # カスタムプロンプトテンプレート生成
        custom_templates = generate_custom_templates(patterns)
        
        # モデル性能評価
        performance_metrics = evaluate_model_performance(feedback_history)
        
        # 結果保存
        save_learning_results(company_id, {
            'patterns': patterns,
            'customTemplates': custom_templates,
            'performanceMetrics': performance_metrics
        })
        
        return response_builder(200, {
            'message': '学習処理が完了しました',
            'improvementScore': performance_metrics.get('improvementScore', 0),
            'customizationLevel': len(custom_templates)
        })
        
    except Exception as e:
        return response_builder(500, f'学習エラー: {str(e)}')

def analyze_feedback_patterns(feedback_history: list) -> Dict[str, Any]:
    """フィードバックパターン分析"""
    
    patterns = {
        'commonCorrections': {},
        'industrySpecificTerms': {},
        'businessContexts': {},
        'performanceTrends': []
    }
    
    for feedback in feedback_history:
        # よくある修正パターン
        if feedback.get('modifications'):
            for mod in feedback['modifications']:
                key = f"{mod['field']}_{mod['type']}"
                patterns['commonCorrections'][key] = patterns['commonCorrections'].get(key, 0) + 1
        
        # 業界特有用語
        if feedback.get('businessContext'):
            extract_industry_terms(feedback['businessContext'], patterns['industrySpecificTerms'])
        
        # パフォーマンス推移
        patterns['performanceTrends'].append({
            'timestamp': feedback['timestamp'],
            'accuracy': feedback.get('accuracy', 0),
            'satisfaction': feedback.get('satisfaction', 0)
        })
    
    return patterns
```

## 📊 データ蓄積・分析基盤

### DynamoDB テーブル設計

#### 1. フィードバックデータテーブル

```json
{
  "TableName": "HumanInTheLoopFeedback",
  "KeySchema": [
    {
      "AttributeName": "SessionId",
      "KeyType": "HASH"
    },
    {
      "AttributeName": "Timestamp",
      "KeyType": "RANGE"
    }
  ],
  "AttributeDefinitions": [
    {
      "AttributeName": "SessionId",
      "AttributeType": "S"
    },
    {
      "AttributeName": "Timestamp",
      "AttributeType": "S"
    },
    {
      "AttributeName": "CompanyId",
      "AttributeType": "S"
    }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "CompanyIndex",
      "KeySchema": [
        {
          "AttributeName": "CompanyId",
          "KeyType": "HASH"
        },
        {
          "AttributeName": "Timestamp",
          "KeyType": "RANGE"
        }
      ]
    }
  ]
}
```

#### 2. 学習データテーブル

```json
{
  "TableName": "LearningData",
  "KeySchema": [
    {
      "AttributeName": "CompanyId",
      "KeyType": "HASH"
    },
    {
      "AttributeName": "DataId",
      "KeyType": "RANGE"
    }
  ],
  "AttributeDefinitions": [
    {
      "AttributeName": "CompanyId",
      "AttributeType": "S"
    },
    {
      "AttributeName": "DataId",
      "AttributeType": "S"
    }
  ]
}
```

## 🚀 実装フェーズ

### Phase 1: 基本フィードバック機能（1週間）
- [ ] データ確認画面UI実装
- [ ] 基本フィードバック収集
- [ ] DynamoDB保存機能

### Phase 2: 分析結果フィードバック（1週間）  
- [ ] 分析結果確認画面
- [ ] 評価スライダー実装
- [ ] コメント機能

### Phase 3: 学習エンジン基礎（2週間）
- [ ] フィードバックパターン分析
- [ ] 基本学習ロジック
- [ ] パフォーマンス測定

### Phase 4: 高度な学習機能（2週間）
- [ ] カスタムプロンプト生成
- [ ] 企業特化パラメータ
- [ ] 継続的モデル改善

## 📈 効果測定・KPI

### 技術的KPI
- **フィードバック率**: >80%
- **分析精度向上**: 月次+5%
- **レスポンス時間**: <2秒

### ビジネスKPI  
- **ユーザー満足度**: >4.5/5
- **継続利用率**: >90%
- **業務効率向上**: >50%

### 学習効果KPI
- **カスタマイズ度**: 企業別差別化指標
- **予測精度**: 継続的向上トレンド
- **人間介入頻度**: 時間経過とともに減少

---

**作成日**: 2025年8月18日  
**最終更新**: 2025年8月18日  
**バージョン**: 1.0  
**ステータス**: 設計書・実装準備完了