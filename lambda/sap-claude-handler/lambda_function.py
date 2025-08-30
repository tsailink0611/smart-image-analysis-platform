# lambda_function.py
# Stable, no external deps. Reads salesData (array) or csv (string). Bedrock converse. CORS/OPTIONS ready.

import json, os, base64, logging, boto3
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional, Tuple

# ====== ENV ======
MODEL_ID       = os.environ.get("BEDROCK_MODEL_ID", "us.deepseek.r1-v1:0")
REGION         = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
DEFAULT_FORMAT = (os.environ.get("DEFAULT_FORMAT", "json") or "json").lower()  # 'json'|'markdown'|'text'
MAX_TOKENS     = int(os.environ.get("MAX_TOKENS", "2200"))
TEMPERATURE    = float(os.environ.get("TEMPERATURE", "0.15"))

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
    # データタイプ別の分析指示
    analysis_instructions = _get_analysis_instructions(data_type)
    
    return f"""あなたは企業の財務データを分析する経験豊富な経営コンサルタントです。以下のデータを見て、経営陣に分かりやすく説明してください。

【データ種別】: {_get_data_type_name(data_type)}

【分析指示】
{analysis_instructions}

【出力形式】
- 自然な日本語で、まるで同僚に説明するように書いてください
- 専門用語は必要最小限に留め、誰でも理解できる表現を使ってください
- 数字は「○○万円」「○○千円」など、日本人が普段使う表現で書いてください
- 結果は以下のような形で整理してください：
  - 「全体の状況」: データの概要を2-3行で
  - 「気づいたこと」: 重要なポイントを3つまで
  - 「数字のまとめ」: 主要な指標

※与えられたデータのみを使って分析してください（推測は避けてください）
※以下の形式でJSONとして出力してください: {json.dumps(schema_hint, ensure_ascii=False)}

[統計要約]
{json.dumps(stats, ensure_ascii=False)}

[サンプル行]
{json.dumps(sample, ensure_ascii=False)}
"""

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
    """データの列名とサンプルから財務データの種類を自動判別"""
    if not columns:
        return "unknown"
    
    # 列名を小文字に変換して判別しやすくする
    col_lower = [col.lower() for col in columns]
    col_str = " ".join(col_lower)
    
    # PL表（損益計算書）のキーワード
    pl_keywords = ["売上高", "売上", "revenue", "sales", "売上原価", "cost", "gross", "販管費", "operating", "営業利益", "profit", "当期純利益", "net", "経常利益", "ordinary"]
    if any(keyword in col_str for keyword in pl_keywords):
        return "pl_statement"
    
    # 貸借対照表のキーワード
    bs_keywords = ["資産", "asset", "負債", "liability", "純資産", "equity", "流動", "固定", "current", "non-current", "capital"]
    if any(keyword in col_str for keyword in bs_keywords):
        return "balance_sheet"
    
    # キャッシュフロー計算書のキーワード
    cf_keywords = ["キャッシュ", "cash", "flow", "営業cf", "投資cf", "財務cf", "operating", "investing", "financing"]
    if any(keyword in col_str for keyword in cf_keywords):
        return "cashflow_statement"
    
    # 売上データのキーワード
    sales_keywords = ["日付", "date", "商品", "product", "金額", "amount", "顧客", "customer", "数量", "quantity"]
    if any(keyword in col_str for keyword in sales_keywords):
        return "sales_data"
    
    # 在庫データのキーワード
    inventory_keywords = ["在庫", "inventory", "stock", "仕入", "purchase", "単価", "unit"]
    if any(keyword in col_str for keyword in inventory_keywords):
        return "inventory_data"
    
    # 人事データのキーワード
    hr_keywords = ["社員", "employee", "給与", "salary", "賃金", "wage", "勤怠", "attendance", "残業", "overtime", "部署", "department", "評価", "performance", "人事", "hr", "採用", "recruitment", "離職", "turnover"]
    if any(keyword in col_str for keyword in hr_keywords):
        return "hr_data"
    
    # マーケティングデータのキーワード
    marketing_keywords = ["広告", "ad", "campaign", "マーケティング", "marketing", "cpc", "ctr", "conversion", "roi", "roas", "リード", "lead", "獲得", "acquisition", "顧客", "customer", "コスト", "cost", "チャネル", "channel"]
    if any(keyword in col_str for keyword in marketing_keywords):
        return "marketing_data"
    
    # 既定値：汎用財務データ
    return "financial_data"

def _get_data_type_name(data_type: str) -> str:
    """データタイプの日本語名を返す"""
    type_names = {
        "pl_statement": "損益計算書（PL表）",
        "balance_sheet": "貸借対照表（BS）",
        "cashflow_statement": "キャッシュフロー計算書",
        "sales_data": "売上データ",
        "inventory_data": "在庫データ",
        "hr_data": "人事データ",
        "marketing_data": "マーケティングデータ",
        "financial_data": "財務データ",
        "unknown": "不明なデータ"
    }
    return type_names.get(data_type, "財務データ")

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
- 売上の合計、平均、トレンドを確認してください
- 商品別・時期別の売上構成を分析してください
- 売上の成長性と季節性があれば指摘してください
- 営業戦略の改善点があれば提案してください""",
        
        "inventory_data": """
- 在庫の総額、商品別構成を確認してください
- 在庫回転率や滞留在庫があれば指摘してください
- 適正在庫レベルと過剰在庫のリスクを評価してください
- 在庫管理の改善点があれば提案してください""",
        
        "hr_data": """
- 部署別・職位別の人件費分析を行ってください
- 給与水準の適正性と業界標準との比較を確認してください
- 残業時間と生産性の関係を分析してください
- 離職率や採用コストの傾向があれば指摘してください
- 人員配置の最適化と働き方改革の提案を行ってください""",
        
        "marketing_data": """
- チャネル別の広告費対効果（ROAS）を計算してください
- 顧客獲得コスト（CAC）と生涯価値（LTV）を分析してください
- コンバージョン率とクリック率の改善点を指摘してください
- 最も効率的なマーケティング施策を特定してください
- 予算配分の最適化とROI向上策を提案してください""",
        
        "financial_data": """
- データの主要な項目と数値を確認してください
- 重要な指標や比率があれば計算してください
- 傾向やパターンがあれば分析してください
- ビジネス上の意味と改善点があれば指摘してください"""
    }
    return instructions.get(data_type, instructions["financial_data"])

def _bedrock_converse(model_id: str, region: str, prompt: str) -> str:
    client = boto3.client("bedrock-runtime", region_name=region)
    system_ja = [{"text": "あなたは企業の財務データを分析する経験豊富な経営コンサルタントです。売上データ、損益計算書（PL表）、貸借対照表、キャッシュフロー計算書など、あらゆる数値データを分析できます。まず提供されたデータの種類を自動判別し、適切な分析を行ってください。回答は必ず日本語で、一般のビジネスパーソンにも分かりやすく説明してください。専門用語は必要最小限に留め、数値は千円単位で区切り、円マークを付けて表示してください。"}]
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

    # Inputs
    instruction = (data.get("instruction") or data.get("prompt") or "").strip()
    fmt = (data.get("responseFormat") or DEFAULT_FORMAT or "json").lower()
    requested_analysis_type = data.get("analysisType", "").strip()
    
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

    # データタイプ判別（フロントエンド指定を優先）
    if requested_analysis_type:
        # フロントエンドからの明示的指定をマッピング
        type_mapping = {
            'sales': 'sales_data',
            'hr': 'hr_data', 
            'marketing': 'marketing_data',
            'strategic': 'financial_data'  # 統合戦略分析は汎用財務として処理
        }
        data_type = type_mapping.get(requested_analysis_type, 'financial_data')
    else:
        # 自動判別
        data_type = _identify_data_type(columns, sales[:5] if sales else [])
    
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