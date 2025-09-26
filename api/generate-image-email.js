export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const {
      OPENAI_API_KEY,
      CLOUD_NAME,
      CLOUDINARY_URL,
      CLOUDINARY_UPLOAD_PRESET,
      API_KEY,
      API_SECRET,
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      EMAILJS_PUBLIC_KEY
    } = process.env;

    const { email, stages } = req.body || {};
    if (!email || !String(email).trim()) {
      res.status(400).json({ error: 'email required' }); return;
    }
    if (!Array.isArray(stages) || stages.length === 0) {
      res.status(400).json({ error: 'stages required' }); return;
    }
    if (!OPENAI_API_KEY) { res.status(500).json({ error: 'OPENAI_API_KEY missing' }); return; }

    const __truncate = (text, max=700) => String(text||'').slice(0, max);
    const buildFinalPrompt = ({ finalDescription }) => {
      const positive = 'cinematic photorealistic environmental scene, global scale, dramatic natural light, volumetric lighting, hdr, ultra-detailed, sharp focus';
      const keywords = 'climate, society, technology, biodiversity, oceans, forests, cities, resilience';
      const negative = 'text, captions, watermarks, logos, charts, ui, low-res, blurry, distorted, oversaturated, nsfw, close-up faces';
      return [
        `Positive: ${positive}.`,
        `Keywords: ${keywords}.`,
        `Negative: ${negative}.`,
        'Final world summary:', __truncate(finalDescription || '', 700)
      ].join('\n');
    };

    const last = stages[stages.length-1] || {};
    const finalDesc = last.worldState ? JSON.stringify(last.worldState) : (last.worldNarration || last.narration || '');
    const prompt = buildFinalPrompt({ finalDescription: finalDesc });

    const openaiResp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1536x1024', quality: 'high' })
    });
    if (!openaiResp.ok) { const err = await openaiResp.text(); throw new Error(`openai: ${openaiResp.status} ${err}`); }
    const openaiData = await openaiResp.json();
    const item = openaiData && openaiData.data && openaiData.data[0];
    if (!item) throw new Error('openai: no image');
    let source = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
    if (!source) throw new Error('openai: invalid image payload');

    // Upload to Cloudinary
    let cloudName = CLOUD_NAME;
    if (!cloudName && CLOUDINARY_URL && CLOUDINARY_URL.includes('@')) {
      cloudName = CLOUDINARY_URL.split('@')[1];
    }
    if (!cloudName) throw new Error('cloudinary: CLOUD_NAME missing');
    const form = new URLSearchParams();
    const formData = new FormData();
    formData.append('file', source);
    if (CLOUDINARY_UPLOAD_PRESET) {
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    } else if (API_KEY && API_SECRET) {
      const timestamp = Math.floor(Date.now()/1000);
      const crypto = await import('crypto');
      const toSign = `timestamp=${timestamp}${API_SECRET}`;
      const signature = crypto.createHash('sha1').update(toSign).digest('hex');
      formData.append('api_key', API_KEY);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signature);
    } else {
      // fallback requires preset
      formData.append('upload_preset', 'default_preset');
    }
    const cloudResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
    if (!cloudResp.ok) { const err = await cloudResp.text(); throw new Error(`cloudinary: ${cloudResp.status} ${err}`); }
    const cloudData = await cloudResp.json();
    const imageUrl = cloudData.secure_url || cloudData.url;
    if (!imageUrl) throw new Error('cloudinary: no url');

    // Send via EmailJS REST
    if (!(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY)) {
      throw new Error('emailjs env missing');
    }
    const emailResp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: { to_email: email, image_url: imageUrl, to: email, user_email: email }
      })
    });
    if (!emailResp.ok) { const err = await emailResp.text(); throw new Error(`emailjs: ${emailResp.status} ${err}`); }

    res.status(200).json({ success: true, imageUrl });
  } catch (e) {
    console.error('generate-image-email error:', e);
    res.status(500).json({ error: String(e.message || e) });
  }
}


