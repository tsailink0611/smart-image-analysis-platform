// SalesAnalysisOutput v1 型定義

export interface SalesAnalysisOutput {
  overview: string;
  kpis?: {
    total_sales?: number | null;
    avg_order?: number | null;
    top_product?: {
      name: string;
      value: number;
    } | null;
    yoy?: number | null;
  };
  insights: Array<{
    title: string;
    detail: string;
  }>;
  timeseries?: Array<{
    date: string;
    sales: number;
  }>;
  warnings?: string[];
}

export interface APIResponse {
  response: SalesAnalysisOutput | string;  // JSON形式またはフォールバック時の文字列
  message?: string;
  dataProcessed?: number;
  requestId?: string;
  formatLearning?: {
    profileFound: boolean;
    columnsLearned: number;
    suggestions?: any[];
  };
}

export interface FormatProfile {
  tenant_id: string;
  format_signature: string;
  headers: string[];
  column_mappings: Record<string, string>;
}

export interface AIUsageData {
  tenant_id: string;
  month: string;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
  request_count: number;
}