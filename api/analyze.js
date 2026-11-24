module.exports = async (req, res) => {
  const sendJson = (statusCode, payload) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  if (req.method !== 'POST') {
    return sendJson(405, { error: { message: 'Method not allowed' } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendJson(500, { error: { message: 'GEMINI_API_KEY is missing in Vercel.' } });
  }

  try {
    // Safely read body whether Vercel pre-parsed it or passed a raw stream
    let body = req.body;
    if (!body) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString('utf8');
      body = rawBody ? JSON.parse(rawBody) : {};
    } else if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    body.generationConfig = {
      ...(body.generationConfig || {}),
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingLevel: 'MINIMAL' }
    };

    // Active 2026 fast models: gemini-3.5-flash-lite -> gemini-3.8-flash fallback
    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
    let lastData = { error: { message: 'AI service temporarily busy.' } };
    let lastStatus = 503;

    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();
      if (response.ok) {
        return sendJson(200, data);
      }

      lastData = data;
      lastStatus = response.status;

      if ([400, 403].includes(response.status)) {
        break;
      }
    }

    return sendJson(lastStatus, lastData);
  } catch (error) {
    return sendJson(500, { error: { message: error.message || 'Internal server error' } });
  }
};
