module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY is missing in Vercel.' } });
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: { message: 'Invalid JSON request body.' } });
  }

  const models = ['gemini-3.8-flash-lite', 'gemini-3.8-flash'];
  let lastError = 'AI service temporarily busy. Please click Analyze again.';
  let lastStatus = 503;

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        lastError = `Upstream non-JSON response (${response.status})`;
        lastStatus = response.status;
        continue;
      }

      if (response.ok) {
        return res.status(200).json(data);
      }

      lastError = data.error?.message || `API error ${response.status}`;
      lastStatus = response.status;

      if ([400, 403].includes(response.status)) {
        return res.status(response.status).json({ error: { message: lastError } });
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(lastStatus).json({ error: { message: lastError } });
};
