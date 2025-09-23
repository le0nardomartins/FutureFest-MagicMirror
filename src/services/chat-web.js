// Web Chat service using OpenAI for STT (transcription) and TTS (audio synthesis)


// Getter global único para variáveis (evita redeclaração entre arquivos)
window.__getEnvVar = window.__getEnvVar || function(key) {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector(`meta[name="${key}"]`);
    if (meta && meta.getAttribute('content')) return meta.getAttribute('content');
  }
  return '';
};

// Getters dinâmicos
const getOPENAI_API_KEY = () => (window.__getEnvVar('OPENAI_API_KEY') || '').trim();
const getELEVENLABS_API_KEY = () => (window.__getEnvVar('ELEVENLABS_API_KEY') || '').trim();
const getELEVENLABS_VOICE_ID = () => (window.__getEnvVar('ELEVENLABS_VOICE_ID') || '').trim();

// Verifica se as chaves estão presentes
if (!getOPENAI_API_KEY()) {
  console.error('[chat-web] ❌ OPENAI_API_KEY não encontrada');
  console.error('[chat-web] Verifique se a variável de ambiente OPENAI_API_KEY está configurada na Vercel');
}

if (!getELEVENLABS_API_KEY()) {
  console.error('[chat-web] ❌ ELEVENLABS_API_KEY não encontrada');
  console.error('[chat-web] Verifique se a variável de ambiente ELEVENLABS_API_KEY está configurada na Vercel');
}

if (!getELEVENLABS_VOICE_ID()) {
  console.error('[chat-web] ❌ ELEVENLABS_VOICE_ID não encontrada');
  console.error('[chat-web] Verifique se a variável de ambiente ELEVENLABS_VOICE_ID está configurada na Vercel');
}
try {
  const preview = (getOPENAI_API_KEY() || '').trim();
  console.log('[chat-web] OPENAI_API_KEY presente:', preview ? 'sim' : 'não', '| preview:', preview ? (preview.slice(0, 20) + '...') : 'N/A');
  
  const elevenPreview = (getELEVENLABS_API_KEY() || '').trim();
  console.log('[chat-web] ELEVENLABS_API_KEY presente:', elevenPreview ? 'sim' : 'não', '| preview:', elevenPreview ? (elevenPreview.slice(0, 20) + '...') : 'N/A');
  console.log('[chat-web] ELEVENLABS_VOICE_ID:', getELEVENLABS_VOICE_ID());
  
  if (!elevenPreview) {
    console.error('[chat-web] ⚠️  ELEVENLABS_API_KEY não encontrada!');
  }
} catch {}
const buildJSONHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getOPENAI_API_KEY()}` });
const buildAuthHeaders = () => ({ 'Authorization': `Bearer ${getOPENAI_API_KEY()}` });

const getOpenAIKeyPreview = () => {
  const key = (getOPENAI_API_KEY() || '').trim();
  return { found: !!key, preview: key ? `${key.slice(0, 20)}...` : 'N/A' };
};

// Record one user utterance using MediaRecorder with simple silence/timeout
const recordUserOnce = async ({ maxMs = 20000, silenceMs = 2000 } = {}) => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const mediaRecorder = new MediaRecorder(stream);
  const chunks = [];
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  let silenceStart = 0;
  let isSilent = false;
  let stopped = false;

  const stopAll = async () => {
    if (stopped) return;
    stopped = true;
    try { mediaRecorder.state !== 'inactive' && mediaRecorder.stop(); } catch {}
    stream.getTracks().forEach(t => t.stop());
    if (audioContext.state !== 'closed') await audioContext.close();
  };

  const detect = () => {
    if (stopped) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    let sum = 0; for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avg = sum / dataArray.length;
    if (avg < 10) {
      if (!isSilent) { isSilent = true; silenceStart = Date.now(); }
      else if (Date.now() - silenceStart > silenceMs) { stopAll(); return; }
    } else {
      isSilent = false;
    }
    requestAnimationFrame(detect);
  };

  mediaRecorder.start();
  detect();
  const timeoutId = setTimeout(() => stopAll(), maxMs);

  const blob = await new Promise(resolve => {
    mediaRecorder.onstop = () => {
      clearTimeout(timeoutId);
      const out = new Blob(chunks, { type: 'audio/webm' });
      resolve(out);
    };
  });
  return blob;
};

// OpenAI Whisper transcription
const transcribeWithOpenAI = async (audioBlob, { language = 'pt' } = {}) => {
  // Aguarda a chave estar disponível
  if (!(getOPENAI_API_KEY())) {
    await (async () => {
      const start = Date.now();
      while (Date.now() - start < 5000 && !getOPENAI_API_KEY()) {
        await new Promise(r => setTimeout(r, 100));
      }
    })();
  }
  const form = new FormData();
  const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
  form.append('file', file);
  form.append('model', 'whisper-1');
  form.append('language', language);
  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: buildAuthHeaders(), body: form });
  if (!resp.ok) { const err = await resp.text(); throw new Error(`STT error: ${resp.status} - ${err}`); }
  const data = await resp.json();
  return (data && (data.text || data.transcription || '').trim()) || '';
};

// ElevenLabs TTS synthesis -> returns object URL (ONLY ElevenLabs, no fallback)
const synthesizeWithElevenLabs = async (text, { voiceId = getELEVENLABS_VOICE_ID(), stability = 0.8, similarityBoost = 0.8 } = {}) => {
  console.log('[chat-web] ElevenLabs TTS - Texto:', text.slice(0, 50) + '...');
  console.log('[chat-web] ElevenLabs TTS - Voice ID:', voiceId);
  console.log('[chat-web] ElevenLabs TTS - API Key:', (getELEVENLABS_API_KEY() || '').slice(0, 10) + '...');
  // Aguarda env
  if (!(getELEVENLABS_API_KEY() && voiceId)) {
    const start = Date.now();
    while (Date.now() - start < 5000 && !(getELEVENLABS_API_KEY() && getELEVENLABS_VOICE_ID())) {
      await new Promise(r => setTimeout(r, 100));
    }
    voiceId = getELEVENLABS_VOICE_ID();
  }
  
  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST', 
    headers: { 
      'Content-Type': 'application/json', 
      'xi-api-key': getELEVENLABS_API_KEY() 
    }, 
    body: JSON.stringify({ 
      text, 
      model_id: 'eleven_multilingual_v2',
      voice_settings: { 
        stability, 
        similarity_boost: similarityBoost,
        style: 0.2,
        use_speaker_boost: true
      } 
    })
  });
  
  if (!resp.ok) { 
    const err = await resp.text(); 
    console.error('[chat-web] ElevenLabs TTS error:', resp.status, err);
    console.error('[chat-web] Verifique se a API key tem permissão text_to_speech');
    throw new Error(`ElevenLabs TTS error: ${resp.status} - ${err}`); 
  }
  
  console.log('[chat-web] ElevenLabs TTS - Sucesso! Gerando áudio...');
  const arrayBuf = await resp.arrayBuffer();
  const blob = new Blob([arrayBuf], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  console.log('[chat-web] ElevenLabs TTS - Áudio gerado, URL:', url);
  return { url, blob };
};

const playAudioUrlAndWait = (url) => new Promise((resolve, reject) => {
  const audio = new Audio();
  audio.src = url;
  audio.onended = () => { resolve(undefined); };
  audio.onerror = (e) => { resolve(undefined); };
  audio.play().catch(() => resolve(undefined));
});

// Remove cercas de código e marcações JSON/Markdown da resposta
const sanitizeForSpeech = (text) => {
  if (!text) return '';
  let t = String(text);
  t = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```json|```/g, '').trim());
  t = t.replace(/^```|```$/g, '');
  t = t.replace(/^json\s*/i, '');
  return t.trim();
};

// Conversation engine with 15 stages, history, and stage-specific instructions
const createConversationEngine = ({ onWorldUpdate, onFinish, email }) => {
  const buildHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getOPENAI_API_KEY()}` });
  const worldStages = [];
  let currentStage = 0; // número de estágios já concluídos
  let introContext = '';

  // Prompt base com regras fixas
  const baseSystemPrompt = [
    'You are the narrator of a simulated world.',
    'Always reply in Brazilian Portuguese.',
    'Hard formatting rules (MANDATORY):',
    '- Output MUST be PLAIN TEXT only (no JSON, no Markdown, no triple backticks).',
    '- Decision axis is STRICTLY ENVIRONMENTAL and GLOBAL (for all humanity). Never target local groups or isolated cases. Choices must reflect what the majority of humanity would choose.',
    '- If the environment is already irreversibly degraded according to the context, broaden the decision to global survival/remediation (still global, affecting all humanity).',
    '- CRITICAL: Each stage must present NEW environmental challenges. When one problem is solved, another must emerge. From stage 10 onwards, problems become more intense and require more difficult, specific solutions.',
    '- PAST MISTAKES: If previous decisions created problems, these must resurface and compound with new challenges. The AI must narrate how past errors are now causing consequences.',
    '- Stages 2..15: First write a 2-3 sentence NARRATION covering climate, society, culture, economy, technology and biodiversity (environmental-centric, showing consequences across aspects). The narration MUST explicitly evaluate the PREVIOUS USER ANSWER as if it were adopted by the majority of humanity: state if it worked or not and briefly explain why. Then introduce the NEW environmental challenge that emerged. Then ask EXACTLY ONE objective, GLOBAL, environmental QUESTION (no extra context).',
    '- Stage 1: DO NOT narrate; ask ONLY ONE objective, GLOBAL, environmental question based on the initial context provided.',
    '- Pre-stage (context setup): write ONLY the initial world narration in 2-4 sentences (plain text).',
    '- Never use lists, bullets, or code blocks; only sentences.',
    '- In the question, always start with "O que você acha..." ou "na sua opinião..."',
    '- Always end the question with the prefix "O que você vai fazer, Viajante?"'
  ].join('\n');

  // Diretriz de estágio com pequenas variações
  const buildStageDirective = (stageNumber) => {
    if (stageNumber === 1) {
      return [
        'Estágio 1 (após contextualização prévia):',
        '- Use o "contexto_mundo_inicial" fornecido previamente.',
        '- NÃO narre novamente.',
        '- Apresente APENAS UMA PERGUNTA objetiva AMBIENTAL e GLOBAL (sem contextualização adicional), refletindo a decisão da maioria da humanidade.',
        '- Formato: texto puro de uma única frase com ponto de interrogação.'
      ].join('\n');
    }
    if (stageNumber >= 10 && stageNumber < 15) {
      return [
        `Estágio ${stageNumber} (preparando encerramento - PROBLEMAS INTENSOS):`,
        '- Considere todas as respostas anteriores e avance a narrativa, mostrando efeitos AMBIENTAIS cumulativos e seus impactos globais em sociedade/cultura/economia/tecnologia/biodiversidade.',
        '- A narração DEVE começar avaliando explicitamente a resposta anterior do usuário como se fosse adotada pela maioria da humanidade: funcionou ou não? Por quê? Qual efeito ambiental imediato?',
        '- CRÍTICO: Apresente NOVOS problemas ambientais mais intensos e complexos. Se erros passados criaram problemas, eles devem ressurgir agora com consequências piores.',
        '- Os problemas devem exigir soluções mais difíceis, específicas e tecnologicamente avançadas.',
        '- Proponha UMA nova situação complexa e faça UMA pergunta AMBIENTAL e GLOBAL (escolha da maioria). Se o ambiente colapsou, foque em sobrevivência/remediação global.'
      ].join('\n');
    }
    if (stageNumber >= 15) {
      return [
        'Estágio 15 (encerramento):',
        '- Conclua a simulação, descrevendo como ficou o mundo final do usuário em todos os aspectos (clima, sociedade, cultura, economia, tecnologia, biodiversidade, qualidade de vida), com ênfase nos desdobramentos AMBIENTAIS e seus impactos globais.',
        '- Diga explicitamente se ainda há vida e como ela se mantém (ou não).',
        '- Neste estágio, retorne pergunta = null.',
        '- NÃO faça perguntas aqui. Apenas contextualize de forma vívida aspectos como clima, sociedade, cultura, economia, tecnologia e biodiversidade.',
        '- Deixe uma pergunta em aberto ou algo que faça ele refletir, como uma frase ou uma reflexão para ele pensar sobre suas decisões e o estado final do mundo.'
      ].join('\n');
    }
    return [
      `Estágio ${stageNumber}:`,
      '- Considere respostas anteriores e o estado do mundo acumulado.',
      '- Construa uma nova NARRAÇÃO (2-3 frases) cobrindo clima, sociedade, cultura, economia, tecnologia e biodiversidade, sempre a partir do eixo AMBIENTAL e com escopo GLOBAL.',
      '- A narração DEVE iniciar avaliando explicitamente a resposta anterior do usuário como se a maioria da humanidade a tivesse adotado: funcionou ou não? Diga por quê e quais efeitos ambientais ocorreram.',
      '- CRÍTICO: Apresente um NOVO problema ambiental que surgiu. Quando um problema é resolvido, outro deve emergir naturalmente.',
      '- Se erros passados criaram problemas, eles devem ressurgir agora com consequências.',
      '- Proponha UMA pergunta única ESTRITAMENTE AMBIENTAL e GLOBAL (a escolha do usuário representa a decisão da maioria da humanidade). Se o ambiente colapsou, pergunte sobre sobrevivência/remediação em escala global.'
    ].join('\n');
  };

  // Pré-estágio 0: contextualização do mundo (sem pergunta)
  const prepareIntroContext = async () => {
    // Aguarda chave
    if (!getOPENAI_API_KEY()) {
      const start = Date.now();
      while (Date.now() - start < 5000 && !getOPENAI_API_KEY()) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    const messages = [
      { role: 'system', content: baseSystemPrompt },
      { role: 'user', content: [
        'Pré-estágio 0 (contextualização inicial do mundo):',
        '- Construa um contexto inicial detalhado do mundo em 2-4 frases.',
        '- NÃO faça perguntas aqui. Apenas contextualize de forma vívida aspectos como clima, sociedade, cultura, economia, tecnologia e biodiversidade.',
        '- Escreva apenas a narração em TEXTO PURO.'
      ].join('\n') }
    ];
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: buildHeaders(), body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.6 })
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Intro context error: ${resp.status} - ${err}`);
    }
    const data = await resp.json();
    const contentRaw = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    try { console.log('[chat][intro] RAW RESPONSE ←', contentRaw); } catch {}
    // Sanitiza para fala: remove cercas de código/JSON
    const content = sanitizeForSpeech(contentRaw);
    introContext = content || '';
    const entry = { stage: 0, question: null, narration: introContext, worldState: {}, userAnswer: null };
    worldStages.push(entry);
    onWorldUpdate && onWorldUpdate({ currentStage: 0, entry, worldStages: [...worldStages] });
    return { worldState: entry.worldState, narration: entry.narration };
  };

  // Constrói mensagens incluindo histórico resumido
  const buildMessages = ({ stageNumber, userAnswer, priorState }) => {
    console.log('[chat] buildMessages → estágio:', stageNumber, '| userAnswer presente?:', !!(userAnswer && userAnswer.trim()));
    const history = worldStages.map(s => ({
      estagio: s.stage,
      pergunta: s.question || null,
      resposta_usuario: s.userAnswer || null,
      narracao: s.narration,
      estado_mundo: s.worldState || {}
    }));
    console.log('[chat] buildMessages → histórico acumulado:', history.length, 'itens');

    const context = {
      email: email || null,
      estagio_atual: stageNumber,
      total_estagios: 15,
      estado_mundo_atual: priorState || {},
      historico: history,
      contexto_mundo_inicial: introContext || ''
    };

    const stageDirective = buildStageDirective(stageNumber);

    const userBlock = [
      `Diretriz do estágio:\n${stageDirective}`,
      `Contexto atual: ${JSON.stringify(context)}`,
      `Resposta do usuário (estágio anterior ou atual se existir): ${userAnswer && userAnswer.trim() ? userAnswer.trim() : 'Sem resposta'}`,
      'Retorne APENAS um JSON válido no formato exigido.'
    ].join('\n');

    console.log('[chat] buildMessages → enviando prompt-base?', !!baseSystemPrompt, '| tamanho regras:', baseSystemPrompt.length);
    console.log('[chat] buildMessages → trecho diretriz:', (stageDirective || '').slice(0, 80) + '...');

    return [
      { role: 'system', content: baseSystemPrompt },
      { role: 'user', content: userBlock }
    ];
  };

  const getNext = async ({ userText, priorState }) => {
    const stageNumber = currentStage + 1; // 1..15
    const messages = buildMessages({ stageNumber, userAnswer: userText || '', priorState });
    console.log('[chat] getNext → estágio', stageNumber, '| userText len:', (userText || '').length, '| priorState?', !!priorState);

    // Aguarda env antes de chamar a OpenAI
    if (!getOPENAI_API_KEY()) {
      const start = Date.now();
      while (Date.now() - start < 5000 && !getOPENAI_API_KEY()) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.7 })
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Chat API error: ${resp.status} - ${err}`);
    }
    const data = await resp.json();
    const contentRaw = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    try { console.log('[chat] RAW RESPONSE ←', contentRaw); } catch {}
    const content = sanitizeForSpeech(contentRaw);
    // Parser robusto: texto puro, sem JSON
    let parsed;
    if (stageNumber === 1) {
      parsed = { pergunta: content.trim(), narracao: '', estado_mundo: priorState || {} };
    } else {
      // Heurística: separa narração (primeiras 2-3 frases) e pergunta (última com '?')
      const sentences = content.split(/(?<=\.)\s+|(?<=\?)\s+/).filter(Boolean);
      const question = sentences.reverse().find(s => s.trim().endsWith('?')) || '';
      sentences.reverse();
      const narration = sentences.filter(s => s !== question).slice(0, 3).join(' ').trim();
      parsed = { pergunta: question || (stageNumber >= 15 ? null : 'Qual é sua decisão?'), narracao: narration || '', estado_mundo: priorState || {} };
    }
    console.log('[chat] getNext ← estágio', stageNumber, '| narração presente?', !!(parsed && parsed.narracao), '| pergunta presente?', !!(parsed && parsed.pergunta));
    const entry = {
      stage: stageNumber,
      question: stageNumber >= 15 ? null : parsed.pergunta,
      narration: parsed.narracao,
      worldState: parsed.estado_mundo,
      userAnswer: (userText || '').trim() || null
    };
    worldStages.push(entry);
    currentStage++;
    onWorldUpdate && onWorldUpdate({ currentStage, entry, worldStages: [...worldStages] });
    const finished = currentStage >= 15;
    if (finished) { onFinish && onFinish({ stages: [...worldStages], email: email || '' }); }
    return { finished, entry };
  };

  return { getNext, prepareIntroContext };
};

// High-level chat loop controller
const createAIEntityChat = ({ onTranscript, onAIQuestion, onAINarration, onWorldUpdate, onFinish, email, onDebug }) => {
  const engine = createConversationEngine({ onWorldUpdate, onFinish, email });
  // referência local dos estágios para gerar timeline ao final
  const worldStagesRef = [];

  let stopping = false;
  const loop = async (priorState) => {
    if (stopping) return;
    console.log('[chat] loop → iniciando próxima iteração. Resposta anterior len:', (window.__lastUserText || '').length);
    const { finished, entry } = await engine.getNext({ userText: window.__lastUserText || '', priorState });
    if (finished) {
      try {
        // Após concluir os 15 estágios, gerar linha do tempo textual e imagem 1920x1080
        const timelineText = await summarizeTimeline(worldStagesRef);
        const dataUrl = await window.generateTimelineImage(timelineText);
        await saveUserImageToAssets(dataUrl);
        // Enviar email, se houver
        try {
          if ((email || '').trim()) {
            await sendUserImageByEmail({ email, imageDataUrl: dataUrl });
          }
        } catch (e) { console.error('email send error:', e); }
      } catch (e) {
        console.error('post-finish generate timeline error:', e);
      }
      return;
    }
    // salva estágio atual para timeline
    try { worldStagesRef.push(entry); } catch {}
    // 1) Narrar (se houver)
    if ((entry.narration || '').trim()) {
      onAINarration && onAINarration(entry.narration);
      onDebug && onDebug.onAINarration && onDebug.onAINarration(entry.narration);
      console.log('[chat] loop → narrando antes da pergunta; len:', (entry.narration || '').length);
      try {
        const { url } = await synthesizeWithElevenLabs(entry.narration);
        await playAudioUrlAndWait(url);
      } catch (e) {
        console.error('[chat-web] Erro na síntese de voz da narração:', e.message);
      }
    }

    // 2) Perguntar (se houver)
    if ((entry.question || '').trim()) {
    onAIQuestion && onAIQuestion(entry.question);
    onDebug && onDebug.onAIQuestion && onDebug.onAIQuestion(entry.question);
    try {
        const { url } = await synthesizeWithElevenLabs(entry.question);
      await playAudioUrlAndWait(url);
      } catch (e) {
        console.error('[chat-web] Erro na síntese de voz da pergunta:', e.message);
      }
    }

    // 3) Ouvir usuário (apenas se houver pergunta)
    if ((entry.question || '').trim()) {
        try {
          onDebug && onDebug.onHearStart && onDebug.onHearStart();
          const blob = await recordUserOnce({ maxMs: 10000, silenceMs: 1500 });
          let txt = await transcribeWithOpenAI(blob, { language: 'pt' });
          // Se a transcrição vier apenas entre parênteses, tratar como silêncio
          if ((txt || '').trim().match(/^\s*\([\s\S]*\)\s*$/)) {
            txt = '';
          }
          window.__lastUserText = txt || '';
          console.log('[chat] loop → resposta do usuário capturada:', (window.__lastUserText || '').slice(0, 80) + '...');
      onTranscript && onTranscript(window.__lastUserText);
      onDebug && onDebug.onTranscribed && onDebug.onTranscribed(window.__lastUserText);
    } catch (e) {
      window.__lastUserText = '';
      onTranscript && onTranscript('');
      onDebug && onDebug.onTranscribed && onDebug.onTranscribed('');
    }
    } else {
      // Se não há pergunta, não ouvimos nada e seguimos adiante
      window.__lastUserText = '';
    }

    if (entry && entry.worldState) {
      return loop(entry.worldState);
    }
    return loop(priorState || {});
  };

  const start = async () => {
    stopping = false; window.__lastUserText = '';
    // Garante preparo do contexto inicial antes do estágio 1
    try {
      const intro = await (async () => {
        try { return await engine.prepareIntroContext(); } catch (e) { console.error('[chat] intro context error:', e.message); return { worldState: {}, narration: '' }; }
      })();
      // Narra o contexto inicial antes do Estágio 1
      if ((intro.narration || '').trim()) {
        try {
          const { url } = await synthesizeWithElevenLabs(intro.narration);
          await playAudioUrlAndWait(url);
        } catch (e) { console.error('[chat] erro ao narrar contexto inicial:', e.message); }
      }
      return loop(intro.worldState || {});
    } catch {
      return loop({});
    }
  };
  const stop = () => { stopping = true; };
  return { start, stop };
};

// Resumo textual da linha do tempo via Chat
const summarizeTimeline = async (worldStages) => {
  const messages = [
    { role: 'system', content: 'Você resume linhas do tempo narrativas. Retorne um texto conciso, com 6-10 marcos principais, em ordem cronológica, descrevendo os eventos mais marcantes que ocorreram no mundo do usuário ao longo de 15 estágios. Use frases curtas separadas por ponto e vírgula.' },
    { role: 'user', content: `Eis a trajetória completa (estágios com pergunta, resposta do usuário, narração e estado): ${JSON.stringify(worldStages)}` }
  ];
  try { console.log('[chat][timeline] REQUEST messages →', JSON.stringify(messages, null, 2)); } catch {}
  // Garante env antes de resumir
  await waitForEnv(['OPENAI_API_KEY']);
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getOPENAI_API_KEY()}` }, body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.5 })
  });
  if (!resp.ok) { const err = await resp.text(); throw new Error(`timeline summary error: ${resp.status} - ${err}`); }
  const data = await resp.json();
  const content = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  try { console.log('[chat][timeline] RAW RESPONSE ←', content); } catch {}
  return content.trim();
};

// Salva dataURL como arquivo em assets/user_image.png (em browser, não há FS real; manteremos em localStorage e oferecemos download)
const saveUserImageToAssets = async (dataUrl) => {
  try {
    localStorage.setItem('user_image_dataurl', dataUrl);
  } catch {}
};

// Envia email via emailjs.js
const sendUserImageByEmail = async ({ email, imageDataUrl }) => {
  try {
    if (!window.emailjsSendImage) return;
    await window.emailjsSendImage({ to: email, imageDataUrl });
  } catch (e) { console.error('emailjsSendImage error:', e); }
};

// Expor funções no window para uso global
window.createAIEntityChat = createAIEntityChat;
window.getOpenAIKeyPreview = getOpenAIKeyPreview;
window.createConversationEngine = createConversationEngine;
