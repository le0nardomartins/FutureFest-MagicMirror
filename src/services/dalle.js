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

// Log mais brando e tardio para aguardar /api/env preencher meta tags
if (!getOPENAI_API_KEY()) {
  setTimeout(() => {
    const preview = (getOPENAI_API_KEY() || '').trim();
    if (!preview) {
      console.warn('[dalle] OPENAI_API_KEY ainda não disponível (aguardando /api/env)');
    } else {
      console.log('[dalle] OPENAI_API_KEY carregada (preview):', preview.slice(0, 8) + '...');
    }
  }, 2000);
} else {
  try {
    const preview = (getOPENAI_API_KEY() || '').trim();
    console.log('[dalle] OPENAI_API_KEY carregada (preview):', preview.slice(0, 8) + '...');
  } catch {}
}

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

const urlToDataUrl = async (url) => {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

const __truncate = (text, max = 700) => String(text || '').slice(0, max);

const buildTimelinePrompt = ({ summary, finalDescription }) => {
  const positive = 'cinematic photorealistic timeline, left-to-right progression, clear separators, global environmental themes, volumetric lighting, hdr, sharp focus';
  const keywords = 'climate crisis, renewable energy, migration, biodiversity loss, carbon capture, drought, flood, wildfire, sea level rise, reforestation';
  const negative = 'text, captions, watermarks, logos, charts, ui, low-res, blurry, distorted, oversaturated, nsfw, close-up faces';
  return [
    `Positive: ${positive}.`,
    `Keywords: ${keywords}.`,
    `Negative: ${negative}.`,
    'Context:', __truncate(summary, 600),
    'Final:', __truncate(finalDescription || '', 240)
  ].join('\n');
};

// Prompt compacto para uma cena única do mundo final (sem timeline)
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

const generateFinalWorldImage = async (worldStages) => {
  try {
    const key = (getOPENAI_API_KEY() || '').trim();
    if (!key) throw new Error('OPENAI_API_KEY ausente');

    const last = worldStages[worldStages.length - 1] || {};
    let finalDescription = (last.worldNarration || last.narration || '');
    if (!finalDescription) {
      const ws = last.worldState;
      if (ws && typeof ws === 'object' && Object.keys(ws).length > 0) {
        finalDescription = JSON.stringify(ws);
      }
    }
    const prompt = buildFinalPrompt({ finalDescription });

    const response = await fetch('https://api.openai.com/v1/images/edits'.replace('/edits','/generations'), {
      method: 'POST',
      headers: await buildOpenAIHeaders(),
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1536x1024',
        quality: 'high'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha na geração de imagem: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const item = data && data.data && data.data[0];
    if (!item) throw new Error('Imagem não retornada');
    if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item.url) return await urlToDataUrl(item.url);
    throw new Error('Formato de imagem desconhecido');
  } catch (error) {
    console.error('generateFinalWorldImage error:', error);
    throw error;
  }
};

// Gera imagem 1920x1080 com linha do tempo horizontal a partir de um resumo textual
const generateTimelineImage = async (timelineSummary) => {
  try {
    const key = (getOPENAI_API_KEY() || '').trim();
    if (!key) throw new Error('OPENAI_API_KEY ausente');

    const prompt = buildTimelinePrompt({ summary: String(timelineSummary || '').trim(), finalDescription: '' });

    const response = await fetch('https://api.openai.com/v1/images/edits'.replace('/edits','/generations'), {
      method: 'POST',
      headers: await buildOpenAIHeaders(),
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1536x1024',
        quality: 'high'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha na geração de imagem (timeline): ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const item = data && data.data && data.data[0];
    if (!item) throw new Error('Imagem (timeline) não retornada');
    if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item.url) return await urlToDataUrl(item.url);
    throw new Error('Formato de imagem desconhecido');
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
window.buildFinalPrompt = buildFinalPrompt;
window.buildTimelinePrompt = buildTimelinePrompt;
