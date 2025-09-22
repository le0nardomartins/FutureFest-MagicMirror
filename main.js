const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const dotenv = require('dotenv');

// Carrega variáveis do arquivo .env para process.env (usa caminho absoluto para evitar divergência de CWD)
const envPath = path.join(__dirname, '.env');
console.log('[env] Tentando carregar .env de:', envPath);
dotenv.config({ path: envPath });

// Verifica se as variáveis foram carregadas do .env
const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
const elevenlabsKey = (process.env.ELEVENLABS_API_KEY || '').trim();
const elevenlabsVoiceId = (process.env.ELEVENLABS_VOICE_ID || '').trim();
const emailjsServiceId = (process.env.EMAILJS_SERVICE_ID || '').trim();
const emailjsTemplateId = (process.env.EMAILJS_TEMPLATE_ID || '').trim();
const emailjsPublicKey = (process.env.EMAILJS_PUBLIC_KEY || '').trim();

// Verifica se todas as variáveis necessárias estão presentes
const requiredVars = {
  OPENAI_API_KEY: openaiKey,
  ELEVENLABS_API_KEY: elevenlabsKey,
  ELEVENLABS_VOICE_ID: elevenlabsVoiceId,
  EMAILJS_SERVICE_ID: emailjsServiceId,
  EMAILJS_TEMPLATE_ID: emailjsTemplateId,
  EMAILJS_PUBLIC_KEY: emailjsPublicKey
};

const missingVars = Object.entries(requiredVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('[env] ❌ Variáveis de ambiente ausentes no arquivo .env:');
  missingVars.forEach(key => console.error(`[env]   - ${key}`));
  console.error('[env] Crie um arquivo .env na raiz do projeto com as variáveis necessárias.');
  console.error('[env] Use o arquivo env.example como referência.');
  process.exit(1);
}

console.log('[env] ✅ Todas as variáveis de ambiente carregadas com sucesso:');
console.log('[env] OPENAI_API_KEY presente:', openaiKey ? 'sim' : 'não', '| preview:', openaiKey ? (openaiKey.slice(0, 20) + '...') : 'N/A');
console.log('[env] ELEVENLABS_API_KEY presente:', elevenlabsKey ? 'sim' : 'não', '| preview:', elevenlabsKey ? (elevenlabsKey.slice(0, 20) + '...') : 'N/A');
console.log('[env] ELEVENLABS_VOICE_ID:', elevenlabsVoiceId || 'N/A');
console.log('[env] EMAILJS_SERVICE_ID:', emailjsServiceId || 'N/A');
console.log('[env] EMAILJS_TEMPLATE_ID:', emailjsTemplateId || 'N/A');
console.log('[env] EMAILJS_PUBLIC_KEY presente:', emailjsPublicKey ? 'sim' : 'não', '| preview:', emailjsPublicKey ? (emailjsPublicKey.slice(0, 20) + '...') : 'N/A');

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    fullscreen: true,
    frame: true,
    backgroundColor: '#000000',
    autoHideMenuBar: true, // Esconde a barra de menu
    titleBarStyle: 'hidden', // Esconde a barra de título mas mantém os controles de janela
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#FFFFFF'
    }
  });

  // Adiciona atalho para alternar tela cheia
  win.setMenuBarVisibility(false);
  
  win.loadFile('src/index.html');
}

app.whenReady().then(() => {
  // Fornece env ao renderer de forma síncrona
  ipcMain.on('env:getSync', (event) => {
    event.returnValue = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
      ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || '',
      EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID || '',
      EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID || '',
      EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY || ''
    };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 