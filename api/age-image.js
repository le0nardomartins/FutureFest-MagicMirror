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

    // Prompt base otimizado e conciso para envelhecer até aproximadamente 80 anos (limitado a 1000 chars)
    const promptBase = 'Transform this photo to appear realistically older (80 years old) while fully preserving identity, facial features, skin tone, proportions, hairstyle, framing, pose, background, and lighting. Apply natural aging for 80 years: deeper wrinkles, age spots, mature skin texture, loss of firmness, gray/white hair, thinning hair, sagging skin. No filters, stylization, makeup, or graphic elements. Maintain realistic high-fidelity photography.';
    
    // Limita a transcrição do usuário para não exceder 1000 caracteres no total
    const MAX_PROMPT_LENGTH = 1000;
    const baseLength = promptBase.length;
    const suffixLength = lifestyle ? ' Incorporate lifestyle: . Output realistic 80-year-old version, maintaining fidelity.'.length : ' Output realistic 80-year-old version, maintaining fidelity.'.length;
    const availableForLifestyle = MAX_PROMPT_LENGTH - baseLength - suffixLength;
    
    let finalLifestyle = '';
    if (lifestyle) {
      if (lifestyle.length > availableForLifestyle) {
        finalLifestyle = lifestyle.substring(0, availableForLifestyle - 3) + '...';
        console.log(`⚠️ Transcrição do usuário truncada de ${lifestyle.length} para ${finalLifestyle.length} caracteres para não exceder limite de 1000 caracteres`);
      } else {
        finalLifestyle = lifestyle;
      }
    }
    
    // Combina o prompt base com o estilo de vida do usuário se fornecido
    const prompt = finalLifestyle 
      ? `${promptBase} Incorporate lifestyle: ${finalLifestyle}. Output realistic 80-year-old version, maintaining fidelity.`
      : `${promptBase} Output realistic 80-year-old version, maintaining fidelity.`;
    
    // Validação final - garante que nunca exceda 1000 caracteres
    let finalPrompt = prompt;
    if (prompt.length > MAX_PROMPT_LENGTH) {
      console.warn(`⚠️ Prompt ainda excede ${MAX_PROMPT_LENGTH} caracteres (${prompt.length}). Truncando...`);
      finalPrompt = prompt.substring(0, MAX_PROMPT_LENGTH - 3) + '...';
    }
    
    console.log(`📏 Tamanho do prompt final: ${finalPrompt.length} caracteres (limite: ${MAX_PROMPT_LENGTH})`);

    // Converte o dataURL para buffer
    const base64 = photoDataUrl.split(',')[1];
    const imgBuf = Buffer.from(base64, 'base64');

    // Log do prompt (será visível no console do servidor)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 PROCESSAMENTO DE IMAGEM PELA IA INICIADO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📸 Tamanho da imagem recebida:', imgBuf.length, 'bytes');
    console.log('💬 Estilo de vida do usuário:', lifestyle || '(nenhum)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 PROMPT COMPLETO ENVIADO PARA OPENAI:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(finalPrompt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 Endpoint: https://api.openai.com/v1/images/edits');
    console.log('📤 Preparando requisição multipart/form-data...');

    // Envia para OpenAI Images Edits
    // Nota: A API de edição não suporta response_format, então recebemos URL e convertemos para base64
    // Criando multipart/form-data manualmente para compatibilidade
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const formParts = [];
    
    // Adiciona campo 'image'
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="image"; filename="photo.png"\r\n`);
    formParts.push(`Content-Type: image/png\r\n\r\n`);
    formParts.push(imgBuf);
    formParts.push(`\r\n--${boundary}\r\n`);
    
    // Adiciona campo 'prompt' (usando finalPrompt que garante limite de 1000 chars)
    formParts.push(`Content-Disposition: form-data; name="prompt"\r\n\r\n`);
    formParts.push(finalPrompt);
    formParts.push(`\r\n--${boundary}--\r\n`);
    
    // Constrói o body
    const bodyParts = [];
    for (const part of formParts) {
      if (Buffer.isBuffer(part)) {
        bodyParts.push(part);
      } else {
        bodyParts.push(Buffer.from(part, 'utf8'));
      }
    }
    const body = Buffer.concat(bodyParts);
    console.log('✅ Body multipart construído, tamanho:', body.length, 'bytes');
    console.log('🚀 Enviando requisição para OpenAI Images Edits API...');
    const apiStartTime = Date.now();

    const resp = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: body
    });
    const apiDuration = Date.now() - apiStartTime;
    
    console.log(`📥 Resposta recebida da OpenAI (${apiDuration}ms)`);
    console.log('📊 Status HTTP:', resp.status, resp.statusText);
    
    if (!resp.ok) {
      const err = await resp.text();
      console.error('❌ Erro da API OpenAI:', err);
      res.status(resp.status).json({ error: err || 'openai error' }); return;
    }
    
    console.log('✅ Resposta OK da OpenAI, processando JSON...');
    const data = await resp.json();
    console.log('📦 Dados recebidos:', JSON.stringify(data).substring(0, 200) + '...');
    
    const imageUrl = data && data.data && data.data[0] && data.data[0].url;
    if (!imageUrl) { 
      console.error('❌ URL da imagem não encontrada na resposta');
      res.status(500).json({ error: 'no image URL in response' }); return; 
    }
    
    console.log('🖼️ URL da imagem gerada:', imageUrl);
    console.log('📥 Fazendo download da imagem gerada...');
    const downloadStartTime = Date.now();
    
    // Faz download da imagem e converte para base64
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) { 
      console.error('❌ Erro ao fazer download da imagem:', imgResp.status);
      res.status(500).json({ error: 'failed to download image' }); return; 
    }
    
    const imgBuffer = await imgResp.arrayBuffer();
    const downloadDuration = Date.now() - downloadStartTime;
    console.log(`✅ Imagem baixada (${downloadDuration}ms), tamanho:`, imgBuffer.byteLength, 'bytes');
    
    console.log('🔄 Convertendo imagem para base64...');
    const imgBase64 = Buffer.from(imgBuffer).toString('base64');
    const imageDataUrl = `data:image/png;base64,${imgBase64}`;
    console.log('✅ Imagem convertida para base64, tamanho final:', imageDataUrl.length, 'caracteres');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PROCESSAMENTO CONCLUÍDO - Retornando imagem ao cliente');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    res.status(200).json({ imageDataUrl });
  } catch (e) {
    res.status(500).json({ error: e && (e.message || String(e)) });
  }
}

