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
const __compressDataUrlToLimit = async (dataUrl, { maxBytes = 40 * 1024, mime = 'image/jpeg' } = {}) => {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const load = () => new Promise((res, rej) => { img.onload = () => res(); img.onerror = rej; });
    img.src = dataUrl;
    await load();

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Escalas e qualidades progressivas
    const scales = [1.0, 0.8, 0.66, 0.5, 0.4, 0.33, 0.25];
    const qualities = [0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2];
    let best = dataUrl;
    let bestOvershoot = Infinity;

    for (const s of scales) {
      canvas.width = Math.max(96, Math.floor(width * s));
      canvas.height = Math.max(96, Math.floor(height * s));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const q of qualities) {
        const out = canvas.toDataURL(mime, q);
        const bytes = __dataUrlSizeBytes(out);
        if (bytes <= maxBytes) return out; // Achou tamanho ok
        const over = bytes - maxBytes;
        if (over < bestOvershoot) { bestOvershoot = over; best = out; }
      }
    }
    // Retorna melhor tentativa se não couber
    return best;
  } catch {
    return dataUrl;
  }
};

// Faz upload no Cloudinary e retorna URL segura
const __uploadToCloudinary = async (dataUrl) => {
  // Obtém env via meta tags preenchidas pelo /api/env
  const cloudName = (window.__getEnvVar && window.__getEnvVar('CLOUD_NAME')) || '';
  const cloudURL = (window.__getEnvVar && window.__getEnvVar('CLOUDINARY_URL')) || '';
  if (!(cloudName || cloudURL)) throw new Error('Cloudinary env ausente');

  // Se CLOUDINARY_URL existir, podemos usar unsigned upload com preset ou a própria URL.
  // Para simplicidade e envio em tamanho original, usamos endpoint padrão sem reamostrar.
  const form = new FormData();
  form.append('file', dataUrl);
  // Upload preset público (unsigned) fixo
  form.append('upload_preset', 'default_preset');

  const base = cloudName ? `https://api.cloudinary.com/v1_1/${cloudName}` : (cloudURL.split('@')[1] ? `https://api.cloudinary.com/v1_1/${cloudURL.split('@')[1]}` : '');
  const resp = await fetch(`${base}/image/upload`, { method: 'POST', body: form });
  if (!resp.ok) { const err = await resp.text(); throw new Error(`upload cloudinary: ${resp.status} - ${err}`); }
  const data = await resp.json();
  return data.secure_url || data.url;
};

window.emailjsSendImage = async ({ to, imageDataUrl }) => {
  try {
    // Aguarda SDK do EmailJS estar disponível (evita corrida de carregamento)
    const waitForSDK = async (to=6000) => {
      const start = Date.now();
      while (Date.now() - start < to) {
        if (window.emailjs && typeof window.emailjs.init === 'function' && typeof window.emailjs.send === 'function') return true;
        await new Promise(r => setTimeout(r, 50));
      }
      return false;
    };
    const sdkReady = await waitForSDK(6000);
    if (!sdkReady) throw new Error('EmailJS não carregado');
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

    console.log('[emailjs] init com PUBLIC_KEY (preview):', (publicKey||'').slice(0,6) + '...');
    window.emailjs.init(publicKey);

    // Em vez de enviar base64 enorme para o EmailJS, subimos ao Cloudinary e mandamos URL
    // Sobe em tamanho original (ou levemente comprimido apenas se desejado)
    console.log('[emailjs] subindo imagem para Cloudinary...');
    const imageUrl = await __uploadToCloudinary(imageDataUrl);
    console.log('[emailjs] upload concluído. URL:', imageUrl);

    const targetEmail = (to && String(to).trim()) ? String(to).trim() : 'leonardomartins140124@gmail.com';
    console.log('[emailjs] enviando email via EmailJS...', { to: targetEmail, serviceId, templateId });
    const result = await window.emailjs.send(serviceId, templateId, {
      to_email: targetEmail,
      to: targetEmail,
      user_email: targetEmail,
      image_url: imageUrl
    });
    console.log('[emailjs] envio OK:', result);
    return result;
  } catch (e) {
    console.error('emailjsSendImage error:', e);
    throw e;
  }
};
