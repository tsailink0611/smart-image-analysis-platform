import { useState, useEffect } from 'react';
import axios from 'axios';

interface UsageData {
  month: string;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
  request_count: number;
  monthly_limit: number;
  usage_percentage: number;
  remaining_budget: number;
}

interface UsageDisplayProps {
  tenantId: string;
  apiEndpoint: string;
}

export const UsageDisplay: React.FC<UsageDisplayProps> = ({ tenantId, apiEndpoint }) => {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // 使用量データを取得
  const fetchUsage = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${apiEndpoint}/format-learning`, {
        action: 'get_usage_summary',
        tenantId: tenantId
      });
      
      if (response.data.success && response.data.usage) {
        setUsage(response.data.usage);
      } else {
        setError('使用量データの取得に失敗しました');
      }
    } catch (err) {
      console.error('使用量取得エラー:', err);
      setError('通信エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // コンポーネントマウント時に使用量を取得
    fetchUsage();
    
    // 5分ごとに自動更新
    const interval = setInterval(fetchUsage, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tenantId]);

  // 使用量に応じた色を決定
  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return '#28a745'; // 緑
    if (percentage < 80) return '#ffc107'; // 黄
    return '#dc3545'; // 赤
  };

  // コスト表示のフォーマット
  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  // トークン数の表示フォーマット
  const formatTokens = (tokens: number) => {
    if (tokens > 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    }
    if (tokens > 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  if (!usage && !isLoading) {
    return null; // データがない場合は何も表示しない
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      minWidth: '250px',
      maxWidth: '350px',
      zIndex: 1000,
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* ヘッダー部分 */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isExpanded ? '12px' : '0',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h4 style={{ 
          margin: 0, 
          fontSize: '14px', 
          fontWeight: 'bold',
          color: '#333'
        }}>
          📊 AI使用量 ({usage?.month || '----'})
        </h4>
        <span style={{ fontSize: '12px', color: '#666' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {/* エラー表示 */}
      {error && (
        <div style={{
          color: '#dc3545',
          fontSize: '12px',
          marginTop: '8px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ローディング表示 */}
      {isLoading && !usage && (
        <div style={{
          textAlign: 'center',
          padding: '10px',
          color: '#666',
          fontSize: '12px'
        }}>
          読み込み中...
        </div>
      )}

      {/* 使用量サマリー（常に表示） */}
      {usage && (
        <>
          <div style={{
            marginTop: '8px',
            marginBottom: '8px'
          }}>
            {/* プログレスバー */}
            <div style={{
              backgroundColor: '#e9ecef',
              borderRadius: '4px',
              height: '20px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                backgroundColor: getUsageColor(usage.usage_percentage),
                height: '100%',
                width: `${Math.min(usage.usage_percentage, 100)}%`,
                transition: 'width 0.3s ease',
                borderRadius: '4px'
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: usage.usage_percentage > 50 ? 'white' : '#333'
              }}>
                {usage.usage_percentage.toFixed(1)}%
              </div>
            </div>

            {/* 使用額 / 制限額 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginTop: '4px',
              color: '#666'
            }}>
              <span>{formatCost(usage.total_cost)}</span>
              <span>{formatCost(usage.monthly_limit)}</span>
            </div>
          </div>

          {/* 詳細情報（展開時のみ） */}
          {isExpanded && (
            <div style={{
              borderTop: '1px solid #e9ecef',
              paddingTop: '12px',
              fontSize: '12px'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>📈 使用状況詳細</strong>
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                color: '#555'
              }}>
                <div>
                  <div style={{ color: '#999', fontSize: '10px' }}>リクエスト数</div>
                  <div style={{ fontWeight: 'bold' }}>{usage.request_count}</div>
                </div>
                
                <div>
                  <div style={{ color: '#999', fontSize: '10px' }}>残り予算</div>
                  <div style={{ fontWeight: 'bold', color: getUsageColor(usage.usage_percentage) }}>
                    {formatCost(usage.remaining_budget)}
                  </div>
                </div>
                
                <div>
                  <div style={{ color: '#999', fontSize: '10px' }}>入力トークン</div>
                  <div>{formatTokens(usage.total_tokens_in)}</div>
                </div>
                
                <div>
                  <div style={{ color: '#999', fontSize: '10px' }}>出力トークン</div>
                  <div>{formatTokens(usage.total_tokens_out)}</div>
                </div>
              </div>

              {/* 警告表示 */}
              {usage.usage_percentage > 80 && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '4px',
                  color: '#856404',
                  fontSize: '11px'
                }}>
                  ⚠️ 月次使用量が{usage.usage_percentage.toFixed(0)}%に達しています。
                  使用量の上限に近づいています。
                </div>
              )}

              {/* 更新ボタン */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchUsage();
                }}
                disabled={isLoading}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '6px',
                  fontSize: '11px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                {isLoading ? '更新中...' : '🔄 使用量を更新'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};