// Envelope mínimo para enviar imagem via EmailJS no browser
// Exponha window.emailjsSendImage({ to, imageDataUrl })

// Este arquivo assume que a biblioteca EmailJS já está incluída via script no HTML ou build
// e que existem SERVICE_ID, TEMPLATE_ID e PUBLIC_KEY configurados no painel EmailJS.

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
        if (keys.every(k => (getEnvVar(k) || '').trim())) return true;
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

    const result = await window.emailjs.send(serviceId, templateId, {
      to_email: to,
      image_base64: imageDataUrl
    });
    return result;
  } catch (e) {
    console.error('emailjsSendImage error:', e);
    throw e;
  }
};
