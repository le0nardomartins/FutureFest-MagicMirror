export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const envVars = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
    ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || '',
    EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID || '',
    EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID || '',
    EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY || ''
  };

  res.status(200).json(envVars);
}
