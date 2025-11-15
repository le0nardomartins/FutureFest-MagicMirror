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

    // Converte o dataURL para buffer (imagem original) – idêntico ao "open('foto_original.png', 'rb')"
    const base64 = photoDataUrl.split(',')[1];
    const imgBuf = Buffer.from(base64, 'base64');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🪞 PIPELINE DE ENVELHECIMENTO (gpt-image-1 IMAGE-TO-IMAGE) INICIADO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📸 Tamanho da imagem ORIGINAL recebida (bytes):', imgBuf.length);
    console.log('💬 Hábitos / estilo de vida informados:', lifestyle || '(nenhum)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Prompt base EXATAMENTE como solicitado:
    // "age this person by 30 years realistically while maintaining identity"
    // acrescido de uma explicação sobre a influência do estilo de vida da pessoa.
    const BASE_PROMPT = 'age this person by 30 years realistically while maintaining identity';

    let lifestylePart = '';
    if (lifestyle) {
      // Limita o texto de estilo de vida para não explodir o prompt
      const MAX_LIFESTYLE_CHARS = 600;
      let lifestyleTrimmed = lifestyle.trim();
      if (lifestyleTrimmed.length > MAX_LIFESTYLE_CHARS) {
        lifestyleTrimmed = lifestyleTrimmed.substring(0, MAX_LIFESTYLE_CHARS) + '...';
      }

      lifestylePart =
        `. Take into account the person\'s lifestyle described in Portuguese here: "` +
        lifestyleTrimmed +
        '". Reflect this lifestyle realistically in the visible signs of aging, especially on skin quality, wrinkles, facial volume, expression lines and overall health.';
    }

    const finalPrompt = BASE_PROMPT + lifestylePart;

    console.log('📝 PROMPT FINAL ENVIADO PARA gpt-image-1:');
    console.log(finalPrompt);

    // Monta multipart/form-data: model + image + prompt
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const formParts = [];

    // Campo 'model'
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="model"\r\n\r\n`);
    formParts.push(`gpt-image-1\r\n`);

    // Campo 'image' (equivalente ao open("foto_original.png", "rb"))
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="image"; filename="photo.png"\r\n`);
    formParts.push(`Content-Type: image/png\r\n\r\n`);
    formParts.push(imgBuf);
    formParts.push(`\r\n`);

    // Campo 'prompt'
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="prompt"\r\n\r\n`);
    formParts.push(finalPrompt + '\r\n');

    // Fecha o formulário
    formParts.push(`--${boundary}--\r\n`);

    const bodyBuffers = [];
    for (const part of formParts) {
      if (Buffer.isBuffer(part)) {
        bodyBuffers.push(part);
      } else {
        bodyBuffers.push(Buffer.from(part, 'utf8'));
      }
    }
    const body = Buffer.concat(bodyBuffers);

    console.log('🎨 Chamando OpenAI Images API (images/edits, modelo gpt-image-1) para gerar a imagem envelhecida...');

    const imagesResp = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    console.log('📥 Resposta recebida da Images API (edits/gpt-image-1):', imagesResp.status, imagesResp.statusText);

    if (!imagesResp.ok) {
      const err = await imagesResp.text();
      console.error('❌ Erro da Images API (gpt-image-1 /edits):', err);

      let userMessage = 'Não foi possível gerar a imagem envelhecida. ';
      if (imagesResp.status === 500 || imagesResp.status === 503) {
        userMessage += 'Erro temporário do servidor da IA. Tente novamente em alguns instantes.';
      } else if (imagesResp.status === 408) {
        userMessage += 'A requisição demorou muito. Tente novamente.';
      } else {
        userMessage += 'Por favor, tente novamente.';
      }

      res.status(imagesResp.status || 500).json({
        error: err,
        userMessage
      });
      return;
    }

    const imagesData = await imagesResp.json();
    console.log('📦 Resposta bruta da Images API (trecho):', JSON.stringify(imagesData).substring(0, 400) + '...');

    // Alguns ambientes retornam diretamente b64_json, outros apenas URL.
    let imageDataUrl = '';

    if (imagesData && imagesData.data && imagesData.data[0]) {
      const item = imagesData.data[0];

      if (item.b64_json) {
        console.log('🧬 Encontrado campo b64_json na resposta da Images API. Usando base64 direto.');
        imageDataUrl = `data:image/png;base64,${item.b64_json}`;
      } else if (item.url) {
        const imageUrl = item.url;
        console.log('🖼️ URL da imagem envelhecida (gpt-image-1):', imageUrl);
        console.log('📥 Fazendo download da imagem gerada pela IA...');

        const downloadStartTime = Date.now();
        const imgResp = await fetch(imageUrl);
        if (!imgResp.ok) {
          console.error('❌ Erro ao fazer download da imagem envelhecida:', imgResp.status, imgResp.statusText);
          res.status(500).json({ error: 'failed to download generated image' });
          return;
        }

        const imgBuffer = await imgResp.arrayBuffer();
        const downloadDuration = Date.now() - downloadStartTime;
        console.log(`✅ Imagem da IA baixada (${downloadDuration}ms), tamanho:`, imgBuffer.byteLength, 'bytes');

        imageDataUrl = `data:image/png;base64,${Buffer.from(imgBuffer).toString('base64')}`;
      }
    }

    if (!imageDataUrl) {
      console.error('❌ Nenhum dado de imagem (url ou b64_json) encontrado na resposta da Images API');
      if (imagesData && imagesData.error) {
        console.error('Detalhes do erro da Images API:', imagesData.error);
      }
      res.status(500).json({ error: 'no image data in Images API response' });
      return;
    }

    console.log('✅ Imagem envelhecida gerada pela IA (gpt-image-1 /edits).');
    console.log('✅ Tamanho do data URL final:', imageDataUrl.length, 'caracteres');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PIPELINE COMPLETO - Retornando imagem envelhecida ao cliente');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.status(200).json({ imageDataUrl });
  } catch (e) {
    res.status(500).json({ error: e && (e.message || String(e)) });
  }
}
