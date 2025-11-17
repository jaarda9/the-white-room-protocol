const { MongoClient } = require('mongodb');

module.exports = async function handler(req, res) {
	// Enable CORS
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
		const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';

		if (!GEMINI_API_KEY) {
			return res.status(500).json({ error: 'Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY env var' });
		}

		const { payload } = req.body || {};
		if (!payload || !payload.contents) {
			return res.status(400).json({ error: 'Missing payload.contents' });
		}

        // Enforce a 10s upstream timeout to avoid 504s from the platform
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

		const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
            signal: controller.signal
		});

        clearTimeout(timeoutId);

		const data = await response.json();
		if (!response.ok) {
			return res.status(response.status).json({ error: 'Gemini request failed', details: data });
		}

		return res.status(200).json(data);
	} catch (err) {
		console.error('Architect proxy error:', err);
		return res.status(500).json({ error: err.message });
	}
}


