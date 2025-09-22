// Simple browser-side OpenAI Images integration and basic video generation

// Função removida - usando API key hardcoded diretamente

// Getter global único compartilhado
window.__getEnvVar = window.__getEnvVar || function(key) {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector(`meta[name="${key}"]`);
    if (meta && meta.getAttribute('content')) return meta.getAttribute('content');
  }
  return '';
};

// API key obtida usando a função getEnvVar (nome único para evitar conflito global)
window.__getOpenAIKey = window.__getOpenAIKey || function() {
  return (window.__getEnvVar('OPENAI_API_KEY') || '').trim();
};
const getOPENAI_API_KEY = window.__getOpenAIKey;

// Verifica se a chave está presente
if (!getOPENAI_API_KEY()) {
  console.error('[dalle] ❌ OPENAI_API_KEY não encontrada');
  console.error('[dalle] Verifique se a variável de ambiente OPENAI_API_KEY está configurada na Vercel');
}
try {
  const preview = (getOPENAI_API_KEY() || '').trim();
  console.log('[dalle] OPENAI_API_KEY presente:', preview ? 'sim' : 'não', '| preview:', preview ? (preview.slice(0, 20) + '...') : 'N/A');
} catch {}

const buildOpenAIHeaders = async () => {
  // Aguarda env
  if (!getOPENAI_API_KEY()) {
    const start = Date.now();
    while (Date.now() - start < 5000 && !getOPENAI_API_KEY()) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  const key = (getOPENAI_API_KEY() || '').trim();
  if (!key) return {};
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` };
};

const generateFinalWorldImage = async (worldStages) => {
  try {
    const key = (OPENAI_API_KEY || '').trim();
    if (!key) throw new Error('OPENAI_API_KEY ausente');

    const last = worldStages[worldStages.length - 1] || {};
    const summary = (worldStages || []).map((s, i) => `Estágio ${i+1}: ${s.narration || s.worldNarration || ''}`).join('\n');
    const prompt = `Crie uma imagem fotorrealista e cinematográfica do mundo final do usuário após 15 estágios de transformação. Contexto resumido:\n${summary}\n\nDescrição final do mundo: ${last.worldState ? JSON.stringify(last.worldState) : (last.worldNarration || last.narration || '')}.\n\nEstilo: épico, tons naturais, alto detalhe, volumetric lighting, ultra-detalhado.`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: await buildOpenAIHeaders(),
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        quality: 'high',
        response_format: 'b64_json'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha na geração de imagem: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const b64 = (data && data.data && data.data[0] && data.data[0].b64_json) || '';
    if (!b64) throw new Error('Imagem não retornada');
    return `data:image/png;base64,${b64}`;
  } catch (error) {
    console.error('generateFinalWorldImage error:', error);
    throw error;
  }
};

// Gera imagem 1920x1080 com linha do tempo horizontal a partir de um resumo textual
const generateTimelineImage = async (timelineSummary) => {
  try {
    const key = (OPENAI_API_KEY || '').trim();
    if (!key) throw new Error('OPENAI_API_KEY ausente');

    const basePrompt = [
      'Crie uma única imagem 1920x1080 (paisagem) que represente, em uma linha do tempo horizontal,',
      'os eventos mais marcantes da trajetória do mundo do usuário em 15 estágios.',
      'Use um estilo cinematográfico, com boa legibilidade visual, separadores claros entre marcos,',
      'elementos ambientais/sociais/tecnológicos, e cores que ajudem a leitura cronológica da esquerda para a direita.',
      'Não inclua textos longos; prefira ícones/símbolos/imagens que representem cada marco.',
      'Resumo para basear a linha do tempo:\n',
      timelineSummary
    ].join(' ');

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: await buildOpenAIHeaders(),
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: basePrompt,
        size: '1920x1080',
        quality: 'high',
        response_format: 'b64_json'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha na geração de imagem (timeline): ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const b64 = (data && data.data && data.data[0] && data.data[0].b64_json) || '';
    if (!b64) throw new Error('Imagem (timeline) não retornada');
    return `data:image/png;base64,${b64}`;
  } catch (error) {
    console.error('generateTimelineImage error:', error);
    throw error;
  }
};

// Very simple Ken Burns effect video from a single image
const renderKenBurnsVideoFromImage = async (imageSrc, { durationMs = 10000, fps = 30 } = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        const width = 1024;
        const height = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const stream = canvas.captureStream(fps);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          resolve({ blob, url });
        };
        recorder.start();

        const totalFrames = Math.floor((durationMs / 1000) * fps);
        for (let f = 0; f < totalFrames; f++) {
          const t = f / totalFrames;
          const scale = 1 + 0.1 * t; // small zoom-in
          const cx = img.width / 2;
          const cy = img.height / 2;
          const drawW = width / scale;
          const drawH = height / scale;
          const sx = Math.max(0, cx - drawW / 2);
          const sy = Math.max(0, cy - drawH / 2);
          const sw = Math.min(drawW, img.width - sx);
          const sh = Math.min(drawH, img.height - sy);

          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
          await new Promise(r => requestAnimationFrame(r));
        }

        recorder.stop();
      };
      img.onerror = (e) => reject(e);
      img.src = imageSrc;
    } catch (err) {
      reject(err);
    }
  });
};

// Expor funções no window para uso global
window.generateFinalWorldImage = generateFinalWorldImage;
window.generateTimelineImage = generateTimelineImage;
window.renderKenBurnsVideoFromImage = renderKenBurnsVideoFromImage;
