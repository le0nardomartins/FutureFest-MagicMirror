;(function(){
'use strict';
// Estrutura para armazenar as cenas do jogo
const scenes = {
    intro: {
        videoPath: 'videos/Forest_1.mp4',
        choices: [
            {
                text: 'Continuar',
                nextScene: 'forest2'
            },
            {
                text: 'Continuar',
                nextScene: 'forest2'
            }
        ],
        autoProgress: true, // Indica que deve progredir automaticamente
        nextScene: 'forest2' // Próxima cena após o vídeo
    },
    forest2: {
        videoPath: 'videos/Forest_2.mp4',
        choices: [
            {
                text: 'Explorar o caminho da esquerda',
                nextScene: 'pathLeft'
            },
            {
                text: 'Seguir pelo caminho da direita',
                nextScene: 'pathRight'
            }
        ]
    }
    // Outras cenas serão adicionadas aqui
};

// Elementos do DOM
let menuScreen;
let gameScreen;
let videoElement;
let choice1Button;
let choice2Button;
let choicesContainer;
let soundWaveContainer;
let soundWaveInstance;

// Sons para os botões
let hoverSound;
let clickSound;

// Função para inicializar os elementos DOM
function initializeElements() {
    menuScreen = document.getElementById('menu-screen');
    gameScreen = document.getElementById('game-screen');
    videoElement = document.getElementById('scene-video');
    choice1Button = document.getElementById('choice1');
    choice2Button = document.getElementById('choice2');
    choicesContainer = document.getElementById('choices-container');
    soundWaveContainer = document.getElementById('sound-wave-container');
}

// Função para inicializar os sons
function initSounds() {
    hoverSound = document.getElementById('hover-sound');
    clickSound = document.getElementById('click-sound');
    
    console.log('Elemento de hover encontrado:', !!hoverSound);
    console.log('Elemento de clique encontrado:', !!clickSound);
    
    // Se os elementos não existirem, criar novos objetos de áudio
    if (!hoverSound) {
        hoverSound = new Audio();
        // Detectar se estamos na página principal ou em uma subpágina
        const basePath = window.location.pathname.includes('/pages/') ? '../assets/audio/hover.wav' : 'assets/audio/hover.wav';
        hoverSound.src = basePath;
        console.log('Criando novo elemento de áudio hover com caminho:', basePath);
    }
    
    if (!clickSound) {
        clickSound = new Audio();
        // Detectar se estamos na página principal ou em uma subpágina
        const basePath = window.location.pathname.includes('/pages/') ? '../assets/audio/clicked.wav' : 'assets/audio/clicked.wav';
        clickSound.src = basePath;
        console.log('Criando novo elemento de áudio clique com caminho:', basePath);
    }
    
    // Pré-carregar os sons
    try {
        hoverSound.load();
        clickSound.load();
    } catch (e) {
        console.error('Erro ao pré-carregar sons:', e);
    }
}

// Função para aplicar os sons aos botões
function applyButtonSounds(button) {
    if (!button) return;
    
    console.log('Aplicando sons ao botão:', button.id || 'botão sem id');
    
    // Remover listeners anteriores se existirem para evitar duplicação
    button.removeEventListener('mouseenter', playHoverSound);
    button.removeEventListener('click', playClickSound);
    
    // Adicionar novos listeners
    button.addEventListener('mouseenter', playHoverSound);
    button.addEventListener('click', playClickSound);
}

// Funções para reproduzir sons
function playHoverSound() {
    console.log('Evento hover acionado');
    if (hoverSound) {
        hoverSound.currentTime = 0;
        hoverSound.play().catch(e => console.log('Erro ao reproduzir som de hover:', e));
    }
}

function playClickSound() {
    console.log('Evento click acionado');
    if (clickSound) {
        clickSound.currentTime = 0;
        clickSound.play().catch(e => console.log('Erro ao reproduzir som de clique:', e));
    }
}

// Inicializar animação de ondas sonoras se o container existir
function initSoundWaveAnimation() {
    if (soundWaveContainer && window.SoundWaveAnimation) {
        // Evita instanciar duas vezes (se a página já criou um canvas)
        if (soundWaveInstance) return true;
        if (soundWaveContainer.querySelector('canvas')) return true;
        soundWaveInstance = new SoundWaveAnimation('sound-wave-container');
        return true;
    }
    return false;
}

let currentScene = null;

// Função para iniciar o jogo
function startGame() {
    if (menuScreen && gameScreen) {
        menuScreen.classList.remove('active');
        gameScreen.classList.add('active');
        loadScene('intro');
    }
}

// Função para carregar uma cena
function loadScene(sceneId) {
    currentScene = scenes[sceneId];
    if (!currentScene) {
        console.error('Cena não encontrada:', sceneId);
        return;
    }

    // Garantir que os elementos estão inicializados
    initializeElements();

    if (!videoElement || !choicesContainer) {
        console.error('Elementos de vídeo ou escolhas não encontrados');
        return;
    }

    // Esconde os botões de escolha inicialmente
    choicesContainer.style.opacity = '0';
    if (choice1Button) choice1Button.style.display = 'none';
    if (choice2Button) choice2Button.style.display = 'none';

    // Configura o vídeo
    videoElement.src = currentScene.videoPath;
    videoElement.load();

    // Configura os botões de escolha
    if (choice1Button) choice1Button.textContent = currentScene.choices[0].text;
    if (choice2Button) choice2Button.textContent = currentScene.choices[1].text;

    // Adiciona os event listeners para as escolhas
    if (choice1Button) choice1Button.onclick = () => makeChoice(0);
    if (choice2Button) choice2Button.onclick = () => makeChoice(1);

    // Configura o comportamento do fim do vídeo
    videoElement.onended = () => {
        if (currentScene.autoProgress) {
            // Se for auto-progress, carrega a próxima cena automaticamente
            loadScene(currentScene.nextScene);
        } else {
            // Caso contrário, mostra as escolhas com animação
            fadeOutVideo();
            showChoices();
        }
    };
    
    // Inicia o vídeo com fade in
    videoElement.style.opacity = '0';
    videoElement.play();
    setTimeout(() => {
        videoElement.style.opacity = '1';
    }, 100);
}

// Função para fade out do vídeo, revelando a animação de ondas
function fadeOutVideo() {
    if (videoElement) {
        videoElement.style.opacity = '0.3';
    }
    
    // Inicializar a animação de ondas se ainda não estiver ativa
    if (!soundWaveInstance) {
        initSoundWaveAnimation();
    }
}

// Função para mostrar as escolhas com animação
function showChoices() {
    // Inicializar ou reinicializar sons
    initSounds();
    
    if (choice1Button) {
        choice1Button.style.display = 'inline-block';
        applyButtonSounds(choice1Button);
    }
    
    if (choice2Button) {
        choice2Button.style.display = 'inline-block';
        applyButtonSounds(choice2Button);
    }
    
    setTimeout(() => {
        if (choicesContainer) {
            choicesContainer.style.opacity = '1';
        }
    }, 100);
}

// Função para processar a escolha do jogador
function makeChoice(choiceIndex) {
    // Fade out nas escolhas
    if (choicesContainer) {
        choicesContainer.style.opacity = '0';
    }
    
    setTimeout(() => {
        const nextScene = currentScene.choices[choiceIndex].nextScene;
        loadScene(nextScene);
    }, 500);
}

// Adiciona transições suaves
if (videoElement) {
    videoElement.style.transition = 'opacity 1.5s ease-in-out';
}

if (choicesContainer) {
    choicesContainer.style.transition = 'opacity 0.5s ease-in-out';
}

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar elementos do DOM
    initializeElements();
    
    // Inicializar sons
    initSounds();
    
    // Inicializar animação de ondas sonoras se possível
    initSoundWaveAnimation();
    
    // Aplicar sons a todos os botões encontrados na página
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(button => {
        applyButtonSounds(button);
    });
    
    // Aplicar sons específicamente aos botões de escolha se existirem
    if (choice1Button) applyButtonSounds(choice1Button);
    if (choice2Button) applyButtonSounds(choice2Button);
    
    // Aplicar sons ao botão de iniciar se existir
    const startButton = document.getElementById('start-button');
    if (startButton) applyButtonSounds(startButton);
    
    console.log('Inicialização completa. Botões com sons:', allButtons.length);
});

})();