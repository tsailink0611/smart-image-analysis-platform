// api/analysis.mjs
  export default async function handler(req, res) {
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
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'JSON body required' });
      }
      if (!body.prompt || typeof body.prompt !== 'string') {
        return res.status(400).json({ error: 'prompt is required' });
      }
      const LAMBDA_URL = process.env.LAMBDA_URL;
      if (!LAMBDA_URL) {
        return res.status(200).json({ message: 'BFF alive (LAMBDA_URL not set yet)', received: body });     
      }
      const upstream = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const text = await upstream.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(upstream.status).send(text);
    } catch (e) {
      return res.status(502).json({ error: 'UPSTREAM_ERROR', detail: String(e) });
    }
  }