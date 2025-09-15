// api/analysis.mjs
export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }
  
  try {
    const body = req.body;
    
    // Enhanced validation
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'JSON body required' });
    }
    
    if (!body.prompt || typeof body.prompt !== 'string') {
      return res.status(400).json({ error: 'prompt field is required' });
    }
    
    if (!body.image || typeof body.image !== 'string') {
      return res.status(400).json({ error: 'image field is required' });
    }
    
    const LAMBDA_URL = process.env.LAMBDA_URL;
    
    // For development/testing - return mock response if no Lambda URL
    if (!LAMBDA_URL) {
      return res.status(200).json({
        extractedText: 'Mock extracted text from development server',
        confidence: 95.5,
        analysis: `Mock AI analysis result for prompt: "${body.prompt}"\n\nThis is a development response since LAMBDA_URL is not configured.`,
        metadata: {
          processingTime: 1500,
          model: 'development-mock'
        }
      });
    }
    
    // Forward to Lambda
    const upstream = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Smart-Image-Analysis-Platform/1.0'
      },
      body: JSON.stringify(body),
      timeout: 30000 // 30 second timeout
    });
    
    if (!upstream.ok) {
      throw new Error(`Lambda returned ${upstream.status}: ${upstream.statusText}`);
    }
    
    const responseText = await upstream.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response from Lambda: ${responseText}`);
    }
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(502).json({ 
      error: 'UPSTREAM_ERROR', 
      detail: error.message,
      timestamp: new Date().toISOString()
    });
  }
}