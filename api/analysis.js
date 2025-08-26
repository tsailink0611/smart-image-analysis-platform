// api/analysis.js
module.exports = async (req, res) => {
  // プリフライト（念のため対応）
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    // req.body は Vercel node runtime で自動JSONパースされます
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'JSON body required' });
    }
    if (!req.body.prompt || typeof req.body.prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }

    // Lambda Function URL に転送
    const LAMBDA_URL = process.env.LAMBDA_URL;
    if (!LAMBDA_URL) {
      // 疎通確認のための仮応答
      return res.status(200).json({
        message: 'BFF alive (LAMBDA_URL not set yet)',
        received: req.body
      });
    }

    // Lambdaへ転送
    const upstream = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(upstream.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: 'UPSTREAM_ERROR', detail: String(e) });
  }
};