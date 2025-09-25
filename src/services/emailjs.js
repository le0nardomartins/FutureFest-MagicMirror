// Envelope mínimo para enviar imagem via EmailJS no browser
// Exponha window.emailjsSendImage({ to, imageDataUrl })

// Este arquivo assume que a biblioteca EmailJS já está incluída via script no HTML ou build
// e que existem SERVICE_ID, TEMPLATE_ID e PUBLIC_KEY configurados no painel EmailJS.

// Utilitário: calcula tamanho em bytes de um dataURL base64
const __dataUrlSizeBytes = (dataUrl) => {
  try {
    const base64 = String(dataUrl || '').split(',')[1] || '';
    return Math.ceil((base64.length * 3) / 4);
  } catch { return 0; }
};

// Utilitário: reamostra/comprime dataURL para caber no limite (default 50KB)
const __compressDataUrlToLimit = async (dataUrl, { maxBytes = 48 * 1024, mime = 'image/jpeg' } = {}) => {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const load = () => new Promise((res, rej) => { img.onload = () => res(); img.onerror = rej; });
    img.src = dataUrl;
    await load();

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let quality = 0.8;
    for (let step = 0; step < 10; step++) {
      // Reduz dimensões progressivamente a partir de 0.75, depois 0.6, etc.
      const scale = [1, 0.85, 0.75, 0.66, 0.5, 0.4, 0.33, 0.25, 0.2, 0.16][step] || 0.16;
      canvas.width = Math.max(64, Math.floor(width * scale));
      canvas.height = Math.max(64, Math.floor(height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let out = canvas.toDataURL(mime, quality);
      if (__dataUrlSizeBytes(out) <= maxBytes) return out;
      // reduz qualidade se ainda estiver grande
      quality = Math.max(0.4, quality - 0.1);
    }
    // Retorna a melhor tentativa mesmo que ultrapasse um pouco
    return canvas.toDataURL(mime, 0.4);
  } catch {
    return dataUrl;
  }
};

window.emailjsSendImage = async ({ to, imageDataUrl }) => {
  try {
    if (!window.emailjs) throw new Error('EmailJS não carregado');
    // Getter global único compartilhado
    window.__getEnvVar = window.__getEnvVar || function(key) {
      if (typeof document !== 'undefined') {
        const meta = document.querySelector(`meta[name="${key}"]`);
        if (meta && meta.getAttribute('content')) return meta.getAttribute('content');
      }
      return '';
    };

    // Aguarda env
    const waitFor = async (keys, to=5000) => {
      const start = Date.now();
      while (Date.now() - start < to) {
        if (keys.every(k => ((window.__getEnvVar && window.__getEnvVar(k)) || '').trim())) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    };
    await waitFor(['EMAILJS_SERVICE_ID','EMAILJS_TEMPLATE_ID','EMAILJS_PUBLIC_KEY']);

    const serviceId = (window.__getEnvVar('EMAILJS_SERVICE_ID') || '').trim();
    const templateId = (window.__getEnvVar('EMAILJS_TEMPLATE_ID') || '').trim();
    const publicKey = (window.__getEnvVar('EMAILJS_PUBLIC_KEY') || '').trim();

    // Verifica se as chaves estão presentes
    if (!serviceId) {
      throw new Error('EMAILJS_SERVICE_ID não encontrada. Verifique se a variável de ambiente está configurada na Vercel');
    }
    if (!templateId) {
      throw new Error('EMAILJS_TEMPLATE_ID não encontrada. Verifique se a variável de ambiente está configurada na Vercel');
    }
    if (!publicKey) {
      throw new Error('EMAILJS_PUBLIC_KEY não encontrada. Verifique se a variável de ambiente está configurada na Vercel');
    }

    window.emailjs.init(publicKey);

    // EmailJS limita o tamanho total das variáveis (~50KB). Comprimir se necessário.
    let payloadDataUrl = imageDataUrl;
    const sizeBytes = __dataUrlSizeBytes(payloadDataUrl);
    if (sizeBytes > 48 * 1024) {
      payloadDataUrl = await __compressDataUrlToLimit(payloadDataUrl, { maxBytes: 47 * 1024, mime: 'image/jpeg' });
    }

    const targetEmail = (to && String(to).trim()) ? String(to).trim() : 'leonardomartins140124@gmail.com';
    const result = await window.emailjs.send(serviceId, templateId, {
      to_email: targetEmail,
      to: targetEmail,
      user_email: targetEmail,
      image_base64: payloadDataUrl
    });
    return result;
  } catch (e) {
    console.error('emailjsSendImage error:', e);
    throw e;
  }
};
