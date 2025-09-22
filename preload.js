const { contextBridge, ipcRenderer } = require('electron');

// Obtem as variáveis do processo principal de forma síncrona, garantindo disponibilidade antes dos módulos
let allowedEnv = { 
  OPENAI_API_KEY: '', 
  ELEVENLABS_API_KEY: '',
  ELEVENLABS_VOICE_ID: '',
  EMAILJS_SERVICE_ID: '',
  EMAILJS_TEMPLATE_ID: '',
  EMAILJS_PUBLIC_KEY: ''
};
try {
  console.log('[preload] Solicitando env do processo principal...');
  const envFromMain = ipcRenderer.sendSync('env:getSync');
  console.log('[preload] Resposta do processo principal:', envFromMain);
  
  if (envFromMain && typeof envFromMain === 'object') {
    allowedEnv = {
      OPENAI_API_KEY: envFromMain.OPENAI_API_KEY || '',
      ELEVENLABS_API_KEY: envFromMain.ELEVENLABS_API_KEY || '',
      ELEVENLABS_VOICE_ID: envFromMain.ELEVENLABS_VOICE_ID || '',
      EMAILJS_SERVICE_ID: envFromMain.EMAILJS_SERVICE_ID || '',
      EMAILJS_TEMPLATE_ID: envFromMain.EMAILJS_TEMPLATE_ID || '',
      EMAILJS_PUBLIC_KEY: envFromMain.EMAILJS_PUBLIC_KEY || ''
    };
    const openaiPrev = (allowedEnv.OPENAI_API_KEY || '').trim();
    const elevenlabsPrev = (allowedEnv.ELEVENLABS_API_KEY || '').trim();
    console.log('[preload] OPENAI_API_KEY presente:', openaiPrev ? 'sim' : 'não', '| preview:', openaiPrev ? (openaiPrev.slice(0, 20) + '...') : 'N/A');
    console.log('[preload] ELEVENLABS_API_KEY presente:', elevenlabsPrev ? 'sim' : 'não', '| preview:', elevenlabsPrev ? (elevenlabsPrev.slice(0, 20) + '...') : 'N/A');
    console.log('[preload] ELEVENLABS_VOICE_ID:', allowedEnv.ELEVENLABS_VOICE_ID || 'N/A');
    console.log('[preload] EMAILJS_SERVICE_ID:', allowedEnv.EMAILJS_SERVICE_ID || 'N/A');
    console.log('[preload] EMAILJS_TEMPLATE_ID:', allowedEnv.EMAILJS_TEMPLATE_ID || 'N/A');
    console.log('[preload] EMAILJS_PUBLIC_KEY presente:', allowedEnv.EMAILJS_PUBLIC_KEY ? 'sim' : 'não', '| preview:', allowedEnv.EMAILJS_PUBLIC_KEY ? (allowedEnv.EMAILJS_PUBLIC_KEY.slice(0, 20) + '...') : 'N/A');
  } else {
    console.error('[preload] ❌ Nenhuma variável recebida do processo principal');
    console.error('[preload] Verifique se o arquivo .env existe e contém todas as variáveis necessárias.');
    allowedEnv = {
      OPENAI_API_KEY: '',
      ELEVENLABS_API_KEY: '',
      ELEVENLABS_VOICE_ID: '',
      EMAILJS_SERVICE_ID: '',
      EMAILJS_TEMPLATE_ID: '',
      EMAILJS_PUBLIC_KEY: ''
    };
  }
} catch (e) {
  console.error('[preload] ❌ Erro ao obter env do processo principal:', e.message);
  console.error('[preload] Verifique se o arquivo .env existe e contém todas as variáveis necessárias.');
  allowedEnv = {
    OPENAI_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    ELEVENLABS_VOICE_ID: '',
    EMAILJS_SERVICE_ID: '',
    EMAILJS_TEMPLATE_ID: '',
    EMAILJS_PUBLIC_KEY: ''
  };
}

contextBridge.exposeInMainWorld('env', allowedEnv);
// Compatibilidade: expõe também diretamente como variáveis globais
try {
  contextBridge.exposeInMainWorld('OPENAI_API_KEY', allowedEnv.OPENAI_API_KEY || '');
  contextBridge.exposeInMainWorld('ELEVENLABS_API_KEY', allowedEnv.ELEVENLABS_API_KEY || '');
  contextBridge.exposeInMainWorld('ELEVENLABS_VOICE_ID', allowedEnv.ELEVENLABS_VOICE_ID || '');
  contextBridge.exposeInMainWorld('EMAILJS_SERVICE_ID', allowedEnv.EMAILJS_SERVICE_ID || '');
  contextBridge.exposeInMainWorld('EMAILJS_TEMPLATE_ID', allowedEnv.EMAILJS_TEMPLATE_ID || '');
  contextBridge.exposeInMainWorld('EMAILJS_PUBLIC_KEY', allowedEnv.EMAILJS_PUBLIC_KEY || '');
  console.log('[preload] Variáveis expostas em window.env e direto em window.*');
} catch (e) {
  console.error('[preload] Erro ao expor variáveis diretamente em window:', e.message);
}


