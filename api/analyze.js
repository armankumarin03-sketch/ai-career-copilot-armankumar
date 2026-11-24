module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY is not set in Vercel.' } });
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: { message: 'Invalid JSON request body.' } });
  }

  // Use only active 3.8 models supported by new API keys
  const models = ['gemini-3.8-flash', 'gemini-3.8-flash-lite'];
  let lastData = null;
  let lastStatus = 500;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );

        const data = await response.json();

        if (response.ok) {
          return res.status(200).json(data);
        }

        lastData = data;
        lastStatus = response.status;

        // Stop immediately on invalid API key (400/403)
        if ([400, 403].includes(response.status)) {
          return res.status(response.status).json(data);
        }

        // Skip if model name not found (404)
        if (response.status === 404) {
          break;
        }

        // On temporary high demand (503) or rate limit (429), wait 2s and retry
        if ([429, 503].includes(response.status) && attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        lastData = { error: { message: error.message } };
      }
    }
  }

  return res.status(lastStatus).json(
    lastData || { error: { message: 'Google servers are temporarily busy. Please click Analyze again.' } }
  );
};
