# lambda_function.py
# Stable, no external deps. Reads salesData (array) or csv (string). Bedrock converse. CORS/OPTIONS ready.

import json, os, base64, logging, boto3, requests
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional, Tuple

# ====== ENV ======
MODEL_ID       = os.environ.get("BEDROCK_MODEL_ID", "us.deepseek.r1-v1:0")
REGION         = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
DEFAULT_FORMAT = (os.environ.get("DEFAULT_FORMAT", "json") or "json").lower()  # 'json'|'markdown'|'text'
MAX_TOKENS     = int(os.environ.get("MAX_TOKENS", "8000"))  # 戦略レベル分析用に大幅増加
TEMPERATURE    = float(os.environ.get("TEMPERATURE", "0.15"))
LINE_NOTIFY_TOKEN = os.environ.get("LINE_NOTIFY_TOKEN", "")

# ====== LOG ======
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ====== CORS/Response ======
def response_json(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        },
        "body": json.dumps(body, ensure_ascii=False)
    }

# ====== Debug early echo (enable with LAMBDA_DEBUG_ECHO=1 or ?echo=1) ======
def _early_echo(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        qs = (event.get("rawQueryString") or "").lower()
        env_on = os.environ.get("LAMBDA_DEBUG_ECHO") in ("1", "true", "TRUE")
        if not (env_on or ("echo=1" in qs)):
            return None
        body_raw = event.get("body")
        if event.get("isBase64Encoded") and isinstance(body_raw, str):
            try:
                body_raw = base64.b64decode(body_raw).decode("utf-8-sig")
            except Exception:
                body_raw = "<base64 decode error>"
        elif isinstance(body_raw, (bytes, bytearray)):
            try:
                body_raw = body_raw.decode("utf-8-sig")
            except Exception:
                body_raw = body_raw.decode("utf-8", errors="ignore")
        sample = body_raw[:1000] if isinstance(body_raw, str) else str(type(body_raw))
        return response_json(200, {
            "message": "DEBUG",
            "format": "json",
            "engine": "bedrock",
            "model": MODEL_ID,
            "response": {
                "echo": "early",
                "received_type": type(body_raw).__name__ if body_raw is not None else "None",
                "raw_sample": sample
            }
        })
    except Exception:
        return None

# ====== Helpers ======
def _to_number(x: Any) -> float:
    try:
        s = str(x).replace(",", "").replace("¥", "").replace("円", "").strip()
        return float(s)
    except Exception:
        return 0.0

def _detect_columns(rows: List[Dict[str, Any]]) -> Dict[str, str]:
    colmap: Dict[str, str] = {}
    if not rows:
        return colmap
    for c in rows[0].keys():
        name = str(c)
        lc = name.lower()
        if ("日" in name) or ("date" in lc):
            colmap.setdefault("date", name)
        if ("売" in name) or ("金額" in name) or ("amount" in lc) or ("sales" in lc) or ("total" in lc):
            colmap.setdefault("sales", name)
        if ("商" in name) or ("品" in name) or ("product" in lc) or ("item" in lc) or ("name" in lc):
            colmap.setdefault("product", name)
    return colmap

def _compute_stats(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(rows)
    if total == 0:
        return {"total_rows": 0, "total_sales": 0.0, "avg_row_sales": 0.0, "top_products": [], "timeseries": []}

    colmap = _detect_columns(rows)
    dcol, scol, pcol = colmap.get("date"), colmap.get("sales"), colmap.get("product")

    ts = defaultdict(float)
    by_product: Counter = Counter()
    total_sales = 0.0

    for r in rows:
        v = _to_number(r.get(scol, 0)) if scol else 0.0
        total_sales += v
        if pcol:
            by_product[str(r.get(pcol, "")).strip()] += v
        if dcol:
            dt = str(r.get(dcol, "")).strip().replace("/", "-")
            day = dt[:10] if len(dt) >= 10 else dt
            if day:
                ts[day] += v

    top_products = [{"name": k, "sales": float(v)} for k, v in by_product.most_common(5)]
    trend = [{"date": d, "sales": float(v)} for d, v in sorted(ts.items())]
    avg = float(total_sales / total) if total else 0.0

    return {
        "total_rows": total,
        "total_sales": float(total_sales),
        "avg_row_sales": avg,
        "top_products": top_products,
        "timeseries": trend
    }

def _build_prompt_json(stats: Dict[str, Any], sample: List[Dict[str, Any]], data_type: str = "sales_data") -> str:
    schema_hint = {
        "type": "object",
        "properties": {
            "overview": {"type": "string"},
            "findings": {"type": "array", "items": {"type": "string"}},
            "kpis": {
                "type": "object",
                "properties": {
                    "total_sales": {"type": "number"},
                    "top_products": {
                        "type": "array",
                        "items": {"type": "object", "properties": {"name": {"type": "string"}, "sales": {"type": "number"}}}
                    }
                }
            },
            "trend": {"type": "array", "items": {"type": "object", "properties": {"date": {"type": "string"}, "sales": {"type": "number"}}}}
        },
        "required": ["overview", "findings", "kpis"]
    }
    
    # データタイプ別の戦略コンサルタント級分析指示
    analysis_instructions = _get_analysis_instructions(data_type)
    data_type_name = _get_data_type_name(data_type)
    
    return f"""【マッキンゼー級戦略コンサルティング実行指令】

クライアント: 日本企業の経営陣
分析対象: {data_type_name}
分析水準: トップティア戦略コンサルティングファーム基準

【CRITICAL SUCCESS FACTORS】
以下の戦略分析フレームワークを"完全に実行"してください。表面的な分析は一切禁止です：

{analysis_instructions}

【MANDATORY DELIVERABLE STRUCTURE】
1. **EXECUTIVE SUMMARY** (結論ファースト)
   - 最重要な戦略的洞察を冒頭30秒で理解できる形で提示
   - 経営インパクトの大きい上位3つの課題と機会を明確化

2. **QUANTITATIVE DEEP DIVE** (数値徹底分析)
   - 各KPIの要因分解と改善ポテンシャル算出（必ず金額ベース）
   - 業界ベンチマーク比較（可能な範囲で競合水準を推定）
   - トレンド分析による将来予測（3ヶ月、6ヶ月、1年後の数値予測）

3. **ROOT CAUSE ANALYSIS** (本質的課題特定)
   - 問題の構造化（Issue Tree形式）
   - 真因の3層深掘り（現象→直接原因→根本原因）
   - 各要因の相対的影響度の定量評価

4. **STRATEGIC RECOMMENDATIONS** (戦略的改善提案)
   - Quick Wins（即効性あり、90日以内実行可能）
   - Strategic Initiatives（中期、6-12ヶ月で成果）
   - Transformational Changes（長期、1-3年の構造改革）
   - 各提案のROI・実行難易度・リスクを明記

5. **IMPLEMENTATION ROADMAP** (実行計画)
   - 優先順位マトリックス（インパクト×実行容易性）
   - 月次アクションプラン（責任部署・KPI・マイルストーン）
   - 成功指標とトラッキング方法

【OUTPUT QUALITY STANDARDS】
• 経営陣が即座に意思決定できる具体性と説得力
• 全主張に数値根拠とロジックを明示
• 改善による財務インパクトを可能な限り金額で提示
• 日本企業の組織文化・商慣習を考慮した実現可能な提案
• プロフェッショナルな文体（但し理解しやすい日本語）

※JSON形式で出力: {json.dumps(schema_hint, ensure_ascii=False)}

【ANALYSIS TARGET DATA】
統計サマリー: {json.dumps(stats, ensure_ascii=False)}
サンプルデータ: {json.dumps(sample, ensure_ascii=False)}

この分析は¥数百万円の戦略コンサルティング契約に匹敵する価値を提供してください。"""

def _build_prompt_markdown(stats: Dict[str, Any], sample: List[Dict[str, Any]], data_type: str = "sales_data") -> str:
    return f"""あなたは会社の売上データを分析するビジネスアドバイザーです。以下の売上データを見て、社長や部長が読むレポートを、完全に日本語と数字だけで作成してください。

【重要】
- Markdownや記号は一切使わず、普通の日本語文章で書いてください
- 「##」「**」「|」「-」などの記号は絶対に使わないでください
- 英語や専門用語は一切使わないでください
- まるで部下が上司に口頭で報告するような、自然な文章で書いてください
- 数字は「○○万円」「○○%増加」など、日本人が話すときの表現で書いてください

# 統計要約
{json.dumps(stats, ensure_ascii=False)}

# サンプル（最大50）
{json.dumps(sample, ensure_ascii=False)}
"""

def _build_prompt_text(stats: Dict[str, Any], sample: List[Dict[str, Any]], data_type: str = "sales_data") -> str:
    return f"""あなたは会社の売上データを分析するビジネスアドバイザーです。以下の売上データを見て、上司に口頭で報告するように、完全に日本語だけで3行以内にまとめてください。

【絶対守ること】
- 記号、英語、カタカナ専門用語は一切使わないでください
- 数字は「○○万円」「○○%増加」など、普通に話すときの表現で書いてください
- まるで朝礼で報告するような、自然な話し言葉で書いてください
- 「です・ます」調で、丁寧に書いてください

[統計要約]
{json.dumps(stats, ensure_ascii=False)}

[サンプル（最大50）]
{json.dumps(sample, ensure_ascii=False)}
"""

def _parse_csv_simple(csv_text: str) -> List[Dict[str, Any]]:
    lines = [l for l in csv_text.splitlines() if l.strip() != ""]
    if not lines: return []
    headers = [h.strip() for h in lines[0].split(",")]
    rows: List[Dict[str, Any]] = []
    for line in lines[1:]:
        cells = [c.strip() for c in line.split(",")]
        row = {}
        for i, h in enumerate(headers):
            row[h] = cells[i] if i < len(cells) else ""
        rows.append(row)
    return rows

def _identify_data_type(columns: List[str], sample_data: List[Dict[str, Any]]) -> str:
    """データの列名とサンプルから財務データの種類を自動判別（7つの分析タイプに特化）"""
    if not columns:
        return "financial_data"
    
    # 列名を小文字に変換して判別しやすくする
    col_lower = [col.lower() for col in columns]
    col_str = " ".join(col_lower) + " " + " ".join(columns)
    
    # スコアベースの判定システム
    scores = {
        "hr_data": 0,
        "marketing_data": 0,
        "sales_data": 0,
        "financial_data": 0,
        "inventory_data": 0,
        "customer_data": 0
    }
    
    # 人事データの強いキーワード（高スコア）
    hr_strong_keywords = ["社員id", "employee", "氏名", "部署", "給与", "salary", "賞与", "年収", "評価", "performance", "残業", "overtime", "有給", "離職", "昇進", "スキル", "チーム貢献", "人事"]
    for keyword in hr_strong_keywords:
        if keyword in col_str:
            scores["hr_data"] += 3
    
    # 人事データの中程度キーワード
    hr_medium_keywords = ["勤怠", "attendance", "研修", "training", "目標達成", "職位", "入社", "年齢"]
    for keyword in hr_medium_keywords:
        if keyword in col_str:
            scores["hr_data"] += 2
    
    # マーケティングデータの強いキーワード
    marketing_strong_keywords = ["キャンペーン", "campaign", "roi", "インプレッション", "impression", "クリック", "click", "cv数", "conversion", "顧客獲得", "cac", "roas", "広告", "媒体", "ターゲット"]
    for keyword in marketing_strong_keywords:
        if keyword in col_str:
            scores["marketing_data"] += 3
    
    # マーケティングデータの中程度キーワード
    marketing_medium_keywords = ["予算", "budget", "支出", "cost", "facebook", "google", "youtube", "instagram", "tiktok", "twitter"]
    for keyword in marketing_medium_keywords:
        if keyword in col_str:
            scores["marketing_data"] += 1
    
    # 売上データの強いキーワード
    sales_strong_keywords = ["売上", "sales", "revenue", "商品", "product", "顧客", "customer", "金額", "amount", "単価", "price", "数量", "quantity"]
    for keyword in sales_strong_keywords:
        if keyword in col_str:
            scores["sales_data"] += 3
    
    # 売上データの中程度キーワード
    sales_medium_keywords = ["日付", "date", "店舗", "store", "地域", "region", "カテゴリ", "category"]
    for keyword in sales_medium_keywords:
        if keyword in col_str:
            scores["sales_data"] += 1
    
    # 統合戦略データ（財務データ）の強いキーワード
    financial_strong_keywords = ["売上高", "revenue", "利益", "profit", "資産", "asset", "負債", "liability", "キャッシュ", "cash", "損益", "pl", "貸借", "bs"]
    for keyword in financial_strong_keywords:
        if keyword in col_str:
            scores["financial_data"] += 3
    
    # 在庫分析データの強いキーワード
    inventory_strong_keywords = ["在庫", "inventory", "stock", "在庫数", "保有数", "倉庫", "warehouse", "回転率", "turnover", "滞留", "入庫", "出庫", "調達", "procurement"]
    for keyword in inventory_strong_keywords:
        if keyword in col_str:
            scores["inventory_data"] += 3
    
    # 在庫分析データの中程度キーワード
    inventory_medium_keywords = ["商品コード", "sku", "ロット", "lot", "品番", "型番", "仕入", "supplier", "発注", "order", "納期", "delivery"]
    for keyword in inventory_medium_keywords:
        if keyword in col_str:
            scores["inventory_data"] += 1
    
    # 顧客分析データの強いキーワード  
    customer_strong_keywords = ["顧客", "customer", "会員", "member", "ユーザー", "user", "ltv", "lifetime", "churn", "離脱", "継続", "retention", "満足度", "satisfaction"]
    for keyword in customer_strong_keywords:
        if keyword in col_str:
            scores["customer_data"] += 3
    
    # 顧客分析データの中程度キーワード
    customer_medium_keywords = ["セグメント", "segment", "年齢", "age", "性別", "gender", "地域", "region", "購入履歴", "purchase", "アクセス", "access", "クリック", "click"]
    for keyword in customer_medium_keywords:
        if keyword in col_str:
            scores["customer_data"] += 1
    
    # データの内容からも判定（サンプルデータが利用可能な場合）
    if sample_data and len(sample_data) > 0:
        sample = sample_data[0]
        
        # 人事データの特徴的な値パターン
        for key, value in sample.items():
            str_value = str(value).lower()
            
            # 人事系の値パターン
            if any(dept in str_value for dept in ["営業部", "it部", "人事部", "財務部", "マーケティング部"]):
                scores["hr_data"] += 5
            if any(pos in str_value for pos in ["主任", "係長", "一般", "部長", "課長"]):
                scores["hr_data"] += 3
            if any(risk in str_value for risk in ["低", "中", "高"]) and ("リスク" in key or "risk" in key.lower()):
                scores["hr_data"] += 4
                
            # マーケティング系の値パターン
            if any(media in str_value for media in ["google広告", "facebook広告", "youtube広告", "instagram広告", "line広告", "tiktok広告"]):
                scores["marketing_data"] += 5
            if "%" in str_value and any(metric in key.lower() for metric in ["roi", "達成率", "満足度"]):
                scores["marketing_data"] += 2
                
            # 売上系の値パターン（数値が大きく、商品名がある場合）
            if "商品" in key or "product" in key.lower():
                scores["sales_data"] += 3
            if key.lower() in ["店舗", "store"] and str_value:
                scores["sales_data"] += 4
                
            # 在庫系の値パターン
            if any(unit in str_value for unit in ["個", "本", "kg", "箱", "セット", "台"]):
                scores["inventory_data"] += 2
            if "warehouse" in key.lower() or "倉庫" in key:
                scores["inventory_data"] += 3
            if any(status in str_value for status in ["入荷待ち", "出荷済み", "在庫切れ", "調達中"]):
                scores["inventory_data"] += 4
                
            # 顧客系の値パターン  
            if any(age in str_value for age in ["20代", "30代", "40代", "50代", "60代"]) or str_value.isdigit() and 18 <= int(str_value) <= 80:
                scores["customer_data"] += 3
            if any(gender in str_value for gender in ["男性", "女性", "male", "female", "男", "女"]):
                scores["customer_data"] += 3
            if "@" in str_value:  # メールアドレス
                scores["customer_data"] += 4
    
    # 最高スコアのタイプを返す
    if max(scores.values()) > 0:
        return max(scores, key=scores.get)
    
    # デフォルト
    return "financial_data"

def _get_data_type_name(data_type: str) -> str:
    """データタイプの日本語名を返す"""
    type_names = {
        "pl_statement": "損益計算書（PL表）",
        "balance_sheet": "貸借対照表（BS）",
        "cashflow_statement": "キャッシュフロー計算書",
        "sales_data": "売上データ",
        "inventory_data": "在庫データ",
        "customer_data": "顧客データ",
        "hr_data": "人事データ",
        "marketing_data": "マーケティングデータ",
        "financial_data": "財務データ",
        "document_data": "書類画像データ",
        "unknown": "不明なデータ"
    }
    return type_names.get(data_type, "財務データ")

def validate_analysis_compatibility(detected_data_type: str, requested_analysis_type: str) -> Tuple[bool, str]:
    """データタイプと分析タイプの適合性をチェック（使いやすさ重視）"""
    # 適合性マトリックス - より柔軟に
    compatibility_matrix = {
        'sales': {
            'primary': ['sales_data'],  # 主要対応
            'secondary': ['financial_data'],  # 副次対応（警告なしで通す）
            'name': '売上分析',
            'description': '売上・商品・顧客データの分析'
        },
        'hr': {
            'primary': ['hr_data'],
            'secondary': [],  # 人事は厳密に
            'name': '人事分析', 
            'description': '従業員パフォーマンス・給与・評価データの分析'
        },
        'marketing': {
            'primary': ['marketing_data'],
            'secondary': ['financial_data'],  # 予算データなども可
            'name': 'マーケティング分析',
            'description': 'キャンペーン・ROI・顧客獲得データの分析'
        },
        'strategic': {
            'primary': ['financial_data', 'sales_data'],
            'secondary': ['hr_data', 'marketing_data'],  # 統合戦略は何でも可
            'name': '統合戦略分析',
            'description': '総合的なビジネスデータの戦略分析'
        }
    }
    
    # リクエストタイプが存在しない場合は通す
    if requested_analysis_type not in compatibility_matrix:
        return True, ""
    
    config = compatibility_matrix[requested_analysis_type]
    
    # 主要タイプまたは副次タイプに適合するかチェック
    all_allowed = config['primary'] + config['secondary']
    
    if detected_data_type in all_allowed:
        return True, ""  # 適合している
    
    # 不適合の場合のみエラー
    if detected_data_type not in all_allowed:
        # 最適なボタンを提案
        best_match = None
        for btn_type, btn_config in compatibility_matrix.items():
            if detected_data_type in (btn_config['primary'] + btn_config['secondary']):
                best_match = btn_config['name']
                break
        
        error_msg = f"""⚠️ データタイプの不一致が検出されました

アップロードされたデータ: {_get_data_type_name(detected_data_type)}
選択された分析: {config['name']}

このデータは{config['name']}には最適化されていません。"""
        
        if best_match:
            error_msg += f"\n\n💡 このデータには「{best_match}」がおすすめです。\n\nただし、そのまま分析を続行することも可能です。"
            # 警告だけで続行を許可
            return True, ""
        else:
            error_msg += f"\n\n「統合戦略分析」ボタンをお試しください。"
            return True, ""
    
    return True, ""

def _get_analysis_instructions(data_type: str) -> str:
    """データタイプ別の分析指示を返す"""
    instructions = {
        "pl_statement": """
- 売上高、売上原価、粗利率を確認してください
- 販管費の内訳と売上高に占める割合を分析してください
- 営業利益、経常利益、当期純利益の推移を確認してください
- 収益性の健全性と改善点を指摘してください""",
        
        "balance_sheet": """
- 総資産、流動資産、固定資産の構成を確認してください
- 負債と純資産のバランスを分析してください
- 流動比率、自己資本比率などの安全性指標を計算してください
- 財務の健全性と資金繰りについて評価してください""",
        
        "cashflow_statement": """
- 営業キャッシュフロー、投資キャッシュフロー、財務キャッシュフローを確認してください
- 現金創出能力と資金の使い道を分析してください
- キャッシュフローの健全性と持続可能性を評価してください
- 資金繰りの改善点があれば指摘してください""",
        
        "sales_data": """
【売上戦略コンサルタントレベルの収益分析を実行】

**1. 多次元売上分析・トレンド診断**
- 売上高・粗利・純利の詳細構造分析（前年同期比・成長率・収益性評価）
- 商品別・顧客別・チャネル別・地域別の売上貢献度ランキングと集中度分析
- 季節性・循環性・トレンド成分の分解と将来6ヶ月間の売上予測
- 価格弾力性分析による最適価格戦略と収益最大化ポイントの特定

**2. 収益構造・利益性の包括分析**
- 売上高総利益率・営業利益率・ROSの経年変化と業界標準比較
- 商品ポートフォリオ分析（スター・問題児・金のなる木・負け犬の分類）
- 顧客セグメント別の収益性分析（パレート法則80/20の検証）
- 固定費・変動費構造と損益分岐点分析による経営安全性評価

**3. 市場機会・成長戦略の発見**
- 成長ドライバーの特定（商品・市場・顧客・チャネル別成長要因分析）
- 未開拓市場・クロスセル・アップセル機会の定量的評価
- 競合シェア分析と市場ポジション強化のための戦略的投資提案
- 新規事業・商品ライン拡張の収益性予測とリスク評価

**4. 営業効率・プロセス最適化**
- 営業担当者別・チーム別のパフォーマンス分析と改善ポテンシャル算出
- セールスファネル各段階の転換率分析と歩留まり改善策
- 商談成約率・平均受注額・リードタイム分析による営業プロセス最適化
- 営業投資ROIと人員配置最適化による売上向上シナリオ

**5. 戦略実行・KPI設定ロードマップ**
- 短期（四半期）・中期（年次）・長期（3年）の売上目標と戦略ロードマップ
- 重点管理すべき先行指標・遅行指標の特定と目標値設定
- 競合対策・市場変化対応のための機動的戦略オプションの準備
- 売上成長を支える組織・システム投資計画と期待ROI算出""",
        
        "inventory_data": """
- 在庫の総額、商品別構成を確認してください
- 在庫回転率や滞留在庫があれば指摘してください
- 適正在庫レベルと過剰在庫のリスクを評価してください
- 在庫管理の改善点があれば提案してください""",
        
        "hr_data": """
【人事戦略コンサルタントレベルの組織分析を実行】

**1. 包括的人件費・生産性分析**
- 部署別・職位別・年代別の詳細人件費構造分析と適正性評価
- 一人当たり売上高・利益貢献度・生産性指標の部署間比較
- 給与水準の業界標準・地域標準との詳細比較（分位点での位置づけ）
- 残業時間とパフォーマンスの相関分析（効率性の定量評価）

**2. 人材リスク・離職予測分析**
- 離職率の要因分解（給与・業務内容・管理職・環境要因別）
- ハイパフォーマー流出リスクの早期発見指標
- 採用コスト・研修投資回収期間・定着率の ROI 分析
- 世代別・スキル別の人材ポートフォリオギャップ分析

**3. 戦略的人材配置最適化**
- スキルマトリックス分析による最適配置シミュレーション
- 内部異動による生産性向上ポテンシャル算出
- 新規採用 vs 既存社員育成のコスト効果比較
- 管理職候補者の定量的評価とキャリアパス設計

**4. 組織変革・働き方改革プラン**
- データドリブンな働き方改革効果予測（時短・リモート・フレックス）
- 人事制度改革による離職率・満足度・生産性改善効果の定量化
- 評価制度最適化による成果向上シナリオ分析
- 研修・育成投資の優先順位と期待ROI算出

**5. 未来組織設計・投資計画**
- 事業成長に応じた組織規模・構成の最適化プラン
- 人材採用・育成の中期計画（3年スパンでの投資計画）
- デジタル化・AI導入による人員配置変化への対応戦略
- 次世代リーダー育成プログラムの設計と投資効果予測""",
        
        "marketing_data": """
【戦略コンサルタントレベルのマーケティング分析を実行】

**1. 詳細データ分析（数値根拠重視）**
- 全チャネルのROAS・CPA・LTVを詳細計算し、効率ランキングを作成
- 顧客獲得ファネル各段階の転換率分析（認知→興味→検討→購入→リピート）
- 月次・四半期・年次のマーケティングROI推移とトレンド変化を分析
- セグメント別（年代・性別・地域・行動パターン）の収益性格差を定量化

**2. 競合・市場環境分析**
- 業界標準との比較評価（CAC/LTV比率、広告費率、リーチ効率）
- 成長機会の特定（未開拓セグメント、季節性、新規チャネル）
- マーケティング予算配分の業界ベンチマークとの比較分析

**3. 戦略的改善提案（具体的アクションプラン）**
- チャネル別予算最適化（具体的金額・%での再配分提案）
- 顧客獲得単価改善の具体的施策（10個以上の実行可能な方法）
- LTV向上のための顧客育成プログラム設計
- 新規チャネル開拓の優先順位と投資効果予測

**4. 未来予測・シナリオ分析**
- 現在のトレンドを基にした6ヶ月後・1年後の成果予測
- 投資レベル別のROI予測シナリオ（保守・積極・超積極の3パターン）
- リスク要因の特定と対策（季節変動・競合動向・経済環境）

**5. KPI設定と実行ロードマップ**
- 短期（3ヶ月）・中期（6ヶ月）・長期（1年）のKPI設定
- 月次追跡すべき重要指標の特定と目標値設定
- 実行優先順位付きのアクションプラン（具体的な実施時期と担当者想定）""",

        "inventory_data": """
【サプライチェーン戦略コンサルタントレベルの在庫分析を実行】

**1. 多角的在庫効率性分析**
- 商品別・カテゴリ別・倉庫別の在庫回転率詳細分析と改善ポテンシャル算出
- ABC分析による戦略的在庫管理（売上貢献度×回転率のマトリックス分析）
- 季節性・トレンド変動を考慮した需要予測精度評価
- 在庫投資ROI・キャッシュフロー改善効果の定量化

**2. リスク・機会損失の包括評価**
- デッドストック化リスクの早期発見アルゴリズム（確率・金額算出）
- 品切れによる機会損失・顧客離脱リスクの定量評価
- 過剰在庫による資金拘束コストと倉庫費用の最適化分析
- 調達リードタイム変動リスクと安全在庫水準の最適化

**3. 戦略的調達・補充最適化**
- EOQ（経済的注文量）モデルによる発注量最適化
- サプライヤー別の調達コスト・品質・リードタイムの総合評価
- 需要変動パターン分析による動的補充戦略の設計
- 複数拠点間の在庫配置最適化（輸送コスト・サービスレベル考慮）

**4. 予測・プランニング高度化**
- 機械学習ベースの需要予測モデル精度向上提案
- 新商品導入・廃番商品の在庫移行戦略
- プロモーション・セール時の在庫戦略と売上最大化プラン
- 競合動向・市場トレンドを考慮した戦略的在庫投資計画

**5. デジタル化・自動化ロードマップ**
- 在庫管理システム高度化による効率改善効果予測
- IoT・自動発注システム導入のROI分析と実装計画
- データドリブン在庫戦略による競争優位性構築提案
- サプライチェーン全体最適化のための中期投資計画""",

        "customer_data": """
【CRM戦略コンサルタントレベルの顧客分析を実行】

**1. 高度顧客セグメンテーション分析**
- RFM分析（最終購入・頻度・金額）による詳細顧客ランキング
- 顧客ライフサイクル段階別の行動パターンと収益性分析
- デモグラフィック×行動データでの多次元セグメンテーション
- 各セグメントの収益貢献度・成長可能性・投資優先度の定量評価

**2. 包括的LTV・チャーン予測分析**  
- セグメント別LTV詳細計算（割引率・リピート確率・単価推移考慮）
- チャーン予測モデルによるリスク顧客の早期特定（確率算出）
- CAC回収期間・LTV/CAC比率の業界標準との比較評価
- 離脱要因の多変量解析（価格・品質・サービス・競合動向）

**3. 戦略的顧客育成プログラム**
- 新規顧客の優良顧客化シナリオ設計（段階別育成戦略）
- 休眠顧客復活プログラムの ROI 分析と実行計画
- VIP顧客向け特別施策の効果測定と最適化提案
- 口コミ・紹介促進による有機的成長戦略の設計

**4. 収益最大化・クロスセル戦略**
- 商品アフィニティ分析による最適レコメンデーション設計
- 価格感度分析による dynamic pricing 戦略提案
- アップセル・クロスセルの成功確率予測と優先順位付け
- 顧客接点別の収益化機会発見（Web・店舗・電話・メール）

**5. 長期関係構築・ロイヤルティ戦略**
- ブランドロイヤルティ向上施策の効果予測と投資計画
- カスタマーサクセス指標の設定と改善ロードマップ
- 競合対策・差別化要因の強化による顧客維持戦略
- 次世代顧客獲得チャネル開拓の戦略設計と投資効果予測""",
        
        "financial_data": """
【統合戦略コンサルタントレベルの財務・経営分析を実行】

**1. 包括的財務健全性分析**
- 収益性分析（ROE・ROA・ROIC）と資本効率の最適化評価
- 安全性分析（流動比率・固定比率・自己資本比率）による財務リスク診断
- 成長性分析（売上・利益・資産成長率）と持続的成長可能性評価
- 効率性分析（総資産回転率・在庫回転率・売掛金回転率）による経営効率診断

**2. 戦略的経営指標・KPI分析**
- EBITDA・フリーキャッシュフロー・EVAによる企業価値創造力評価
- 事業セグメント別・地域別の収益構造分析と資源配分最適化
- コスト構造分析（固定費・変動費比率）と損益分岐点・経営レバレッジ効果
- 資金調達構造と最適資本構成による財務戦略の評価・改善提案

**3. 競合・業界ベンチマーク比較分析**
- 業界標準との詳細比較（収益性・効率性・成長性・安全性の4軸評価）
- 同業他社との相対的ポジション分析と競争優位性の特定
- 市場シェア・価格戦略・コスト競争力の業界内ランキング評価
- ベストプラクティス企業との比較による改善ポテンシャル算出

**4. 統合戦略・投資計画の最適化**
- 事業ポートフォリオ分析（BCGマトリックス・GEマトリックス）による資源配分戦略
- M&A・設備投資・R&D投資の投資効果分析とポートフォリオ最適化
- 新規事業展開・市場拡大戦略のリスク・リターン分析
- シナジー効果・規模の経済による統合価値創造の定量評価

**5. 中長期経営計画・価値創造ロードマップ**
- 3年・5年の中期経営計画の実現可能性評価と修正提案
- 株主価値最大化のための資本政策・配当政策の最適化
- ESG経営・持続可能性経営の財務インパクト分析
- 経営危機・業界変化に対する耐性評価とリスク管理強化策
- デジタル変革・DX投資による競争力向上と収益性改善シナリオ"""
    }
    return instructions.get(data_type, instructions["financial_data"])

def _bedrock_converse_with_image(model_id: str, region: str, prompt: str, image_data: str, mime_type: str) -> str:
    """Claude Vision APIで画像を分析"""
    client = boto3.client("bedrock-runtime", region_name=region)

    # システムプロンプト
    system_ja = [{
        "text": """あなたは高度な画像分析とビジネスインテリジェンスの専門家です。
画像から情報を正確に抽出し、実用的なビジネス洞察を提供してください。
数値データは正確に読み取り、傾向やパターンを分析してください。
日本語で分かりやすく、具体的な提案を含めて回答してください。"""
    }]

    # メッセージに画像を含める
    messages = [{
        "role": "user",
        "content": [
            {
                "text": prompt
            },
            {
                "image": {
                    "format": mime_type.split('/')[-1] if '/' in mime_type else "jpeg",
                    "source": {
                        "bytes": base64.b64decode(image_data)
                    }
                }
            }
        ]
    }]

    try:
        resp = client.converse(
            modelId=model_id,
            system=system_ja,
            messages=messages,
            inferenceConfig={"maxTokens": MAX_TOKENS, "temperature": TEMPERATURE}
        )

        msg = resp.get("output", {}).get("message", {})
        parts = msg.get("content", [])
        txts = []
        for p in parts:
            if "text" in p:
                txts.append(p["text"])
        return "\n".join([t for t in txts if t]).strip()
    except Exception as e:
        logger.error(f"Bedrock Vision API error: {str(e)}")
        raise

def _bedrock_converse(model_id: str, region: str, prompt: str) -> str:
    client = boto3.client("bedrock-runtime", region_name=region)
    system_ja = [{
        "text": """【戦略コンサルタント級AIプラットフォーム - エンタープライズ仕様】

あなたはマッキンゼー・BCG・ベインレベルの戦略コンサルタントです。日本企業の経営課題に対して、以下の専門性で最高水準の分析を提供してください：

**コンサルティング専門領域**
• 財務戦略・企業価値最大化（ROE/ROIC最適化、資本効率向上）
• 営業・マーケティング戦略（顧客獲得・収益性向上・市場拡大）
• 人事・組織戦略（人材最適化・生産性向上・離職率改善）
• オペレーショナル・エクセレンス（プロセス改善・コスト削減）
• デジタル変革・イノベーション戦略

**分析実行フレームワーク（必須遵守）**
1. **Issue Tree分析**: 問題を構造化し、MECE（漏れなく・重複なく）で課題を特定
2. **定量分析**: 全指標のトレンド・要因分解・影響度を数値で立証
3. **ベンチマーク比較**: 業界標準・競合他社との差異を明確化
4. **Root Cause特定**: 問題の本質的原因を3層まで深掘り
5. **Impact算出**: 各改善案の投資効果を具体的金額で算出
6. **Implementation Plan**: 実行ロードマップ（責任者・期限・KPI付き）

**アウトプット品質基準**
• 経営層が意思決定に使える戦略レベルの洞察
• 仮説→検証→結論の論理構造を明確化
• Quick Wins（即効性）とLong-term Value（持続性）の両軸で提案
• リスク・前提条件・成功要因を必ず明記
• 数値は必ず根拠を示し、改善ポテンシャルを金額で定量化

**出力仕様（厳守）**
• 結論ファーストで要点を冒頭に提示
• 「So What?」（だから何？）を常に意識した価値ある提言
• 実行可能性とインパクトの2軸で優先順位を設定
• 成功事例・ベストプラクティスを可能な限り引用
• 日本企業特有の組織文化・商慣習を考慮した現実的提案

あなたの分析は経営陣の戦略意思決定に直接影響する重要な成果物です。妥協のない最高水準の品質で応答してください。"""
    }]
    resp = client.converse(
        modelId=model_id,
        system=system_ja,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": MAX_TOKENS, "temperature": TEMPERATURE}
    )
    msg = resp.get("output", {}).get("message", {})
    parts = msg.get("content", [])
    txts = []
    for p in parts:
        if "text" in p:  # DeepSeekのreasoningContentは無視
            txts.append(p["text"])
    return "\n".join([t for t in txts if t]).strip()

def _process_image_with_textract(image_data: str, mime_type: str) -> str:
    """AWS Textractを使用して画像からテキストを抽出"""
    try:
        textract = boto3.client('textract', region_name=REGION)
        
        # Base64デコード
        image_bytes = base64.b64decode(image_data)
        
        # Textractでテキスト抽出
        response = textract.detect_document_text(
            Document={'Bytes': image_bytes}
        )
        
        # テキストを結合
        extracted_text = []
        for item in response['Blocks']:
            if item['BlockType'] == 'LINE':
                extracted_text.append(item['Text'])
        
        return '\n'.join(extracted_text)
    
    except Exception as e:
        logger.error(f"Textract error: {str(e)}")
        return f"テキスト抽出エラー: {str(e)}"

def _analyze_document_image(image_data: str, mime_type: str, analysis_type: str) -> str:
    """画像書類を分析してビジネス分析を実行（Claude Vision API使用）"""
    try:
        # Claude Vision APIで直接画像分析
        prompt = """この画像を詳細に分析してください。以下の観点で分析してください：

1. **画像内容の識別**
   - 何の画像か（文書、グラフ、表、写真など）
   - 主要な要素や情報

2. **テキスト情報の抽出**
   - 画像内のすべてのテキストを正確に読み取り
   - 数値、日付、名称などの重要情報を特定

3. **データ分析**
   - 表やグラフがある場合は、データの傾向やパターンを分析
   - 重要な指標やKPIを特定

4. **ビジネス洞察**
   - この情報から得られるビジネス上の示唆
   - 改善点や注意すべき点
   - 活用可能な情報やアクションアイテム

5. **推奨事項**
   - データ管理や活用に関する提案
   - 次のステップの推奨

日本語で詳細かつ実用的な分析結果を提供してください。"""

        # Claude Vision APIで画像を直接分析
        analysis_result = _bedrock_converse_with_image(MODEL_ID, REGION, prompt, image_data, mime_type)

        return f"""📊 **画像分析結果**

{analysis_result}
"""

    except Exception as e:
        logger.error(f"Document image analysis error: {str(e)}")
        return f"画像分析エラー: {str(e)}"

# ====== LINE Notify & Sentry Webhook処理 ======
def send_line_notification(message: str) -> bool:
    """LINE Notify APIを使用してメッセージを送信"""
    if not LINE_NOTIFY_TOKEN:
        logger.error("LINE_NOTIFY_TOKEN not configured")
        return False
    
    try:
        headers = {
            'Authorization': f'Bearer {LINE_NOTIFY_TOKEN}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        data = {'message': message}
        
        response = requests.post(
            'https://notify-api.line.me/api/notify',
            headers=headers,
            data=data,
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info("✅ LINE通知送信成功")
            return True
        else:
            logger.error(f"❌ LINE通知送信失敗: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"❌ LINE通知エラー: {str(e)}")
        return False

def process_sentry_webhook(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Sentryからのwebhookペイロードを処理してLINE通知を送信"""
    try:
        # Sentryペイロードの検出 - より柔軟に
        is_sentry_webhook = (
            "event" in data or 
            "action" in data or 
            ("data" in data and isinstance(data["data"], dict) and ("issue" in data["data"] or "event" in data["data"])) or
            ("installation" in data) or
            ("alert" in data)
        )
        
        if not is_sentry_webhook:
            # Sentryペイロードではない場合はNoneを返す（通常の処理に進む）
            return None
            
        logger.info("🔴 Sentryからのwebhookペイロードを検出")
        
        # エラー情報を抽出
        error_title = "不明なエラー"
        error_detail = ""
        project_name = ""
        environment = ""
        
        # Sentryのペイロード構造に応じて情報抽出
        if "data" in data:
            event_data = data["data"]
            if "issue" in event_data:
                issue = event_data["issue"]
                error_title = issue.get("title", error_title)
                project_name = issue.get("project", {}).get("name", "")
            elif "event" in event_data:
                event = event_data["event"]
                error_title = event.get("title", event.get("message", error_title))
                environment = event.get("environment", "")
        elif "event" in data:
            event = data["event"]
            error_title = event.get("title", event.get("message", error_title))
            environment = event.get("environment", "")
            
        # LINE通知メッセージを作成
        timestamp = ""
        try:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
            
        message = f"""🚨 【SAP Frontend - エラー通知】

📍 エラー: {error_title}

🏢 プロジェクト: {project_name or "SAP Frontend"}
🌍 環境: {environment or "production"}  
🕒 発生時刻: {timestamp}

🔗 Sentryで詳細を確認してください
"""
        
        # LINE通知を送信
        success = send_line_notification(message)
        
        # レスポンスを返す
        return response_json(200, {
            "message": "Sentry webhook processed",
            "line_notification": "success" if success else "failed",
            "error_title": error_title,
            "project": project_name,
            "environment": environment
        })
        
    except Exception as e:
        logger.error(f"❌ Sentry webhook処理エラー: {str(e)}")
        return response_json(500, {
            "message": "Sentry webhook processing failed",
            "error": str(e)
        })

# ====== Handler ======
def lambda_handler(event, context):
    # Early echo（必要時のみ）
    echo = _early_echo(event)
    if echo is not None:
        return echo

    # CORS/HTTP method
    method = (event.get("requestContext", {}) or {}).get("http", {}).get("method") or event.get("httpMethod", "")
    if method == "OPTIONS":
        return response_json(200, {"ok": True})
    if method != "POST":
        return response_json(405, {
            "response": {"summary": "Use POST", "key_insights": [], "recommendations": [], "data_analysis": {"total_records": 0}},
            "format": "json", "message": "Use POST", "engine": "bedrock", "model": MODEL_ID
        })

    # Parse body
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        try:
            raw = base64.b64decode(raw).decode("utf-8", errors="ignore")
        except Exception:
            pass
    try:
        data = json.loads(raw)
    except Exception as e:
        return response_json(400, {
            "response": {"summary": f"INVALID_JSON: {str(e)}", "key_insights": [], "recommendations": [], "data_analysis": {"total_records": 0}},
            "format": "json", "message": "INVALID_JSON", "engine": "bedrock", "model": MODEL_ID
        })

    # デバッグ: 受信データの構造をログ出力
    logger.info(f"🔍 受信データの構造: {list(data.keys())}")
    
    # Sentry Webhook処理を最優先でチェック
    sentry_response = process_sentry_webhook(data)
    if sentry_response is not None:
        return sentry_response

    # Inputs
    instruction = (data.get("instruction") or data.get("prompt") or "").strip()
    fmt = (data.get("responseFormat") or DEFAULT_FORMAT or "json").lower()
    requested_analysis_type = data.get("analysisType", "").strip()
    
    # 画像処理の分岐（document分析 または fileType='image'）
    if requested_analysis_type == "document" or data.get("fileType") == "image":
        image_data = data.get("imageData", "")
        mime_type = data.get("mimeType", "image/jpeg")
        
        if not image_data:
            return response_json(400, {
                "response": {"summary": "画像データが含まれていません", "key_insights": [], "recommendations": []},
                "format": "json", "message": "Missing image data"
            })
        
        try:
            logger.info("Starting image analysis")
            analysis_result = _analyze_document_image(image_data, mime_type, requested_analysis_type)
            
            return response_json(200, {
                "response": {
                    "summary": analysis_result,
                    "key_insights": ["画像からテキスト抽出完了", "AI分析実行済み"],
                    "recommendations": ["抽出データの検証推奨", "重要情報の別途保存推奨"],
                    "data_analysis": {"total_records": 1, "document_type": "image"}
                },
                "format": "json", "message": "Image analysis completed", "engine": "bedrock+textract", "model": MODEL_ID
            })
            
        except Exception as e:
            logger.error(f"Image analysis error: {str(e)}")
            return response_json(500, {
                "response": {"summary": f"画像分析エラー: {str(e)}", "key_insights": [], "recommendations": []},
                "format": "json", "message": "Image analysis failed"
            })
    
    # FORCE_JA option
    force_ja = os.environ.get("FORCE_JA","false").lower() in ("1","true")
    if force_ja:
        instruction = ("日本語のみで、数値は半角。KPI・要点・トレンドを簡潔に。" + (" " + instruction if instruction else ""))

    # Prefer salesData (array). Optionally accept csv.
    sales: List[Dict[str, Any]] = []
    if isinstance(data.get("salesData"), list):
        sales = data["salesData"]
    elif isinstance(data.get("csv"), str):
        sales = _parse_csv_simple(data["csv"])
    # 最終フォールバック（稀に data/rows で来る場合）
    elif isinstance(data.get("rows"), list):
        sales = data["rows"]
    elif isinstance(data.get("data"), list):
        sales = data["data"]

    columns = list(sales[0].keys()) if sales else []
    total = len(sales)

    # まずデータタイプを自動判別
    detected_data_type = _identify_data_type(columns, sales[:5] if sales else [])
    
    # 適合性チェック（フロントエンドから分析タイプが指定されている場合）
    if requested_analysis_type:
        is_compatible, error_message = validate_analysis_compatibility(detected_data_type, requested_analysis_type)
        
        if not is_compatible:
            # 不適合の場合はエラーレスポンスを返す
            return response_json(200, {
                "response": {
                    "summary_ai": error_message,
                    "presentation_md": error_message,
                    "key_insights": [],
                    "data_analysis": {
                        "total_records": total,
                        "detected_type": _get_data_type_name(detected_data_type),
                        "requested_type": requested_analysis_type
                    }
                },
                "format": fmt,
                "message": "DATA_TYPE_MISMATCH",
                "model": MODEL_ID
            })
        
        # 適合している場合は要求された分析タイプを使用
        type_mapping = {
            'sales': 'sales_data',
            'hr': 'hr_data', 
            'marketing': 'marketing_data',
            'strategic': detected_data_type  # 統合戦略は実際のデータタイプを使用
        }
        data_type = type_mapping.get(requested_analysis_type, detected_data_type)
    else:
        # 分析タイプが指定されていない場合は自動判別結果を使用
        data_type = detected_data_type
    
    stats = _compute_stats(sales)
    sample = sales[:50] if sales else []

    # データタイプ別プロンプト構築
    if fmt == "markdown":
        prompt = _build_prompt_markdown(stats, sample, data_type)
    elif fmt == "text":
        prompt = _build_prompt_text(stats, sample, data_type)
    else:
        prompt = _build_prompt_json(stats, sample, data_type)

    # LLM call
    summary_ai = ""
    findings: List[str] = []
    kpis  = {"total_sales": stats.get("total_sales", 0.0), "top_products": stats.get("top_products", [])}
    trend = stats.get("timeseries", [])

    try:
        ai_text = _bedrock_converse(MODEL_ID, REGION, prompt)
        if fmt == "json":
            # JSON想定。フェンス除去・部分抽出に軽く対応
            text = ai_text.strip()
            if text.startswith("```"):
                # ```json ... ``` のケースを剥がす
                text = text.strip("`").lstrip("json").strip()
            try:
                ai_json = json.loads(text)
            except Exception:
                # 最後の手段：先頭～末尾の最初の{}を探す
                start = text.find("{"); end = text.rfind("}")
                if start != -1 and end != -1 and end > start:
                    try: ai_json = json.loads(text[start:end+1])
                    except Exception: ai_json = {"overview": ai_text}
                else:
                    ai_json = {"overview": ai_text}
            summary_ai = ai_json.get("overview", "")
            findings   = ai_json.get("findings", [])
            kpis       = ai_json.get("kpis", kpis)
            trend      = ai_json.get("trend", trend)
        else:
            summary_ai = ai_text
    except Exception as e:
        logger.exception("Bedrock error")
        summary_ai = f"(Bedrock error: {str(e)})"

    # presentation_md for enhanced readability
    def _fmt_yen(n):
        try: return f"{int(n):,} 円"
        except: return str(n)

    # 自然な日本語レポート（presentation_md） - 記号除去
    trend_list = stats.get('timeseries',[])[:3]
    trend_text = ""
    if trend_list:
        trend_parts = []
        for t in trend_list:
            date = t.get('date','')
            sales = t.get('sales',0)
            if date and sales:
                trend_parts.append(f"{date}に{int(sales):,}円")
        trend_text = "、".join(trend_parts) if trend_parts else "データがありません"
    
    total_sales = stats.get('total_sales',0)
    avg_sales = stats.get('avg_row_sales',0)
    
    presentation_md = f"""{total}件のデータを分析しました。売上合計は{int(total_sales):,}円で、1件あたり平均{int(avg_sales):,}円でした。主な売上は{trend_text}となっています。"""

    # Response - 技術的な部分を最小化
    if fmt == "markdown" or fmt == "text":
        # Markdown/Text形式は純粋な日本語のみ
        body = {
            "response": {
                "summary_ai": summary_ai
            },
            "format": fmt,
            "message": "OK",
            "model": MODEL_ID
        }
    else:
        # JSON形式: 自然な説明群 + 区切り線 + データ証拠
        separator_line = "---以下は読み込んだデータの証拠です---"
        body = {
            "response": {
                "summary_ai": summary_ai,
                "presentation_md": presentation_md,
                "key_insights": findings,
                "separator": separator_line,
                "data_analysis": {
                    "total_records": total,
                    "kpis": kpis,
                    "trend": trend
                }
            },
            "format": fmt,
            "message": "OK",
            "model": MODEL_ID
        }
    return response_json(200, body)