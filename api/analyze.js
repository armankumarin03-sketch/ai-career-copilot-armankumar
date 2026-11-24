module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY is not set in Vercel.' } });
  }

  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const models = ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-2.5-flash'];

  let lastData = null;
  let lastStatus = 500;

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

      const data = await response.json();
      if (response.ok) {
        return res.status(200).json(data);
      }

      lastData = data;
      lastStatus = response.status;

      // Retry next model only if current model is overloaded (503/429) or unavailable (404)
      if (![404, 429, 503].includes(response.status)) {
        break;
      }
    } catch (error) {
      lastData = { error: { message: error.message } };
    }
  }

  return res.status(lastStatus).json(lastData || { error: { message: 'All models busy, please retry.' } });
};
