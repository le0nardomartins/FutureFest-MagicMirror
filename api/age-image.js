export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
    if (!OPENAI_API_KEY) { res.status(500).json({ error: 'OPENAI_API_KEY missing' }); return; }

    const { photoDataUrl, transcript } = req.body || {};
    if (!(photoDataUrl && typeof photoDataUrl === 'string' && photoDataUrl.startsWith('data:image/'))) {
      res.status(400).json({ error: 'photoDataUrl (data:image/...) required' }); return;
    }
    const lifestyle = String(transcript || '').trim();

    // Constrói prompt com ênfase em preservar identidade e realismo fotográfico
    const prompt = [
      'Transforme a foto desta mesma pessoa para parecer mais velha de forma realista.',
      'Preserve integralmente identidade, traços faciais e estilo fotográfico original.',
      'Não mude o enquadramento, a pose, o fundo ou a iluminação; apenas a aparência da idade.',
      'Mantenha tom de pele, formato dos olhos, nariz, boca, sobrancelhas, orelhas e marcas únicas.',
      'Aumente sinais de idade (linhas finas, textura da pele, possíveis fios grisalhos) de modo natural.',
      'Fotografia realista, sem filtros artísticos, sem caricatura, sem elementos gráficos.',
      lifestyle ? `Leve em conta o estilo de vida descrito: ${lifestyle}` : 'Use envelhecimento natural moderado.'
    ].join(' ');

    // Converte o dataURL para buffer
    const base64 = photoDataUrl.split(',')[1];
    const imgBuf = Buffer.from(base64, 'base64');

    // Envia para OpenAI Images Edits (gpt-image-1)
    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('prompt', prompt);
    form.append('image[]', new Blob([imgBuf], { type: 'image/png' }), 'photo.png');
    // Sem máscara: instrução de edição via prompt
    form.append('size', '1024x1024');
    form.append('response_format', 'b64_json');

    const resp = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: form
    });
    if (!resp.ok) {
      const err = await resp.text();
      res.status(resp.status).json({ error: err || 'openai error' }); return;
    }
    const data = await resp.json();
    const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) { res.status(500).json({ error: 'no image in response' }); return; }
    const imageDataUrl = `data:image/png;base64,${b64}`;
    res.status(200).json({ imageDataUrl });
  } catch (e) {
    res.status(500).json({ error: e && (e.message || String(e)) });
  }
}

