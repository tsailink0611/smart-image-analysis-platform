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

def _build_prompt_json(stats: Dict[str, Any], sample: List[Dict[str, Any]]) -> str:
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
    return f"""あなたは会社の売上データを分析する、親しみやすいビジネスアドバイザーです。以下の売上データを見て、経営陣や営業チームに分かりやすく説明してください。

【お願い】
- 自然な日本語で、まるで同僚に説明するように書いてください
- 専門用語や難しい言葉は避けて、誰でも理解できる表現を使ってください
- 数字は「○○万円」「○○千円」など、日本人が普段使う表現で書いてください
- 結果は以下のような形で整理してください：
  - 「全体の状況」: データの概要を2-3行で
  - 「気づいたこと」: 重要なポイントを3つまで
  - 「数字のまとめ」: 主要な売上指標

※与えられたデータのみを使って分析してください（推測は避けてください）
※以下の形式でJSONとして出力してください: {json.dumps(schema_hint, ensure_ascii=False)}

[統計要約]
{json.dumps(stats, ensure_ascii=False)}

[サンプル行]
{json.dumps(sample, ensure_ascii=False)}
"""

def _build_prompt_markdown(stats: Dict[str, Any], sample: List[Dict[str, Any]]) -> str:
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

def _build_prompt_text(stats: Dict[str, Any], sample: List[Dict[str, Any]]) -> str:
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

def _bedrock_converse(model_id: str, region: str, prompt: str) -> str:
    client = boto3.client("bedrock-runtime", region_name=region)
    system_ja = [{"text": "あなたは売上データの分析を行う、親しみやすいビジネスアドバイザーです。回答は必ず日本語で、一般のサラリーマンにも分かりやすく説明してください。専門用語や技術用語は使わず、自然で読みやすい文章で回答してください。数値は千円単位で区切り、円マークを付けて表示してください。"}]
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

    stats = _compute_stats(sales)
    sample = sales[:50] if sales else []

    # Build prompt
    if fmt == "markdown":
        prompt = _build_prompt_markdown(stats, sample)
    elif fmt == "text":
        prompt = _build_prompt_text(stats, sample)
    else:
        prompt = _build_prompt_json(stats, sample)

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

    # シンプルな日本語レポート（presentation_md）
    trend_text = "\n".join([f"{t.get('date','日付不明')}: {_fmt_yen(t.get('sales',0))}" 
                           for t in (stats.get('timeseries',[])[:3])])
    
    presentation_md = f"""売上分析結果

データ件数: {total}件を分析しました

売上合計: {_fmt_yen(stats.get('total_sales',0))}
平均売上: {_fmt_yen(stats.get('avg_row_sales',0))}

主な売上日:
{trend_text}

※この結果は売上データの分析です"""

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
        # JSON形式は構造化データも含むが、presentation_mdを優先表示用に
        body = {
            "response": {
                "summary_ai": summary_ai,
                "presentation_md": presentation_md,
                "key_insights": findings,
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