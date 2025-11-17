// Ping test endpoint for real ping measurement
export default async function handler(req, res) {
    if (req.method === 'HEAD') {
        // Simple HEAD request for ping measurement
        res.status(200).end();
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
