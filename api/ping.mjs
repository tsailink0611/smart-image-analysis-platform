// api/ping.mjs
  export default async function handler(req, res) {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Use GET' });
    }
    return res.status(200).json({ ok: true, route: '/api/ping', time: new Date().toISOString() });
  }