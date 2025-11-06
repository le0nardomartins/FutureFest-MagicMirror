(function(){
'use strict';
// Elementos do cursor
const cursor = document.querySelector('.cursor');
const cursorTrail = document.querySelector('.cursor-trail');
const menuScreen = document.querySelector('#menu-screen');
const starsContainer = document.querySelector('.stars');

// Configurações das faíscas
const sparkColors = ['#2ecc71', '#3498db', '#e74c3c', '#f1c40f'];
const maxSparks = 50;
let lastMouseX = 0;
let lastMouseY = 0;
let sparks = [];
let lastSparkTime = 0;

// Array para armazenar as estrelas
let stars = [];

// Função para criar uma faísca
function createSpark(x, y, velocityX, velocityY) {
    const spark = document.createElement('div');
    spark.className = 'spark';
    document.body.appendChild(spark);

    // Posição inicial
    spark.style.left = x + 'px';
    spark.style.top = y + 'px';

    // Cor aleatória
    spark.style.background = sparkColors[Math.floor(Math.random() * sparkColors.length)];

    // Tamanho aleatório
    const size = Math.random() * 3 + 1;
    spark.style.width = size + 'px';
    spark.style.height = size + 'px';

    // Animação personalizada
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 30 + 10;
    const tx = Math.cos(angle) * speed + (velocityX * 2);
    const ty = Math.sin(angle) * speed + (velocityY * 2);

    spark.style.setProperty('--tx', `${tx}px`);
    spark.style.setProperty('--ty', `${ty}px`);

    // Aplicar animação
    spark.style.animation = 'sparkFade 1s ease-out forwards';

    // Remover após a animação
    setTimeout(() => {
        document.body.removeChild(spark);
        sparks = sparks.filter(s => s !== spark);
    }, 1000);

    return spark;
}

// Atualiza a posição do cursor e cria faíscas
document.addEventListener('mousemove', (e) => {
    if (cursor) {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    }
    
    // Posiciona o cursor-trail
    if (cursorTrail) {
        cursorTrail.style.left = e.clientX + 'px';
        cursorTrail.style.top = e.clientY + 'px';
    }

    // Calcula a velocidade do movimento
    const velocityX = e.clientX - lastMouseX;
    const velocityY = e.clientY - lastMouseY;
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

    // Cria faíscas baseadas na velocidade
    const currentTime = Date.now();
    if (speed > 5 && currentTime - lastSparkTime > 20) { // Ajuste o 20 para controlar a frequência
        const numSparks = Math.min(Math.floor(speed / 5), 5); // Ajuste para controlar quantidade
        
        for (let i = 0; i < numSparks; i++) {
            if (sparks.length < maxSparks) {
                const spark = createSpark(
                    e.clientX + (Math.random() - 0.5) * 10,
                    e.clientY + (Math.random() - 0.5) * 10,
                    velocityX,
                    velocityY
                );
                sparks.push(spark);
            }
        }
        lastSparkTime = currentTime;
    }

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

// Efeito de escala ao clicar
document.addEventListener('mousedown', () => {
    if (cursor) cursor.style.transform = 'scale(0.8)';
    // Cria um burst de faíscas ao clicar
    for (let i = 0; i < 15; i++) {
        if (sparks.length < maxSparks) {
            const spark = createSpark(
                lastMouseX + (Math.random() - 0.5) * 20,
                lastMouseY + (Math.random() - 0.5) * 20,
                0,
                0
            );
            sparks.push(spark);
        }
    }
});

document.addEventListener('mouseup', () => {
    if (cursor) cursor.style.transform = 'scale(1)';
});

// Cria estrelas
function createStars() {
    if (!starsContainer) return; // sem container de estrelas nesta página
    const numberOfStars = 100; // Aumentei o número de estrelas
    
    // Não limpa todas as estrelas de uma vez, apenas adiciona novas
    // Vamos remover apenas algumas estrelas aleatoriamente
    if (stars.length > 0) {
        // Remove apenas 20% das estrelas existentes aleatoriamente
        const starsToRemove = Math.floor(stars.length * 0.2);
        for (let i = 0; i < starsToRemove; i++) {
            if (stars.length > 0) {
                const randomIndex = Math.floor(Math.random() * stars.length);
                if (stars[randomIndex] && stars[randomIndex].parentNode) {
                    stars[randomIndex].parentNode.removeChild(stars[randomIndex]);
                    stars.splice(randomIndex, 1);
                }
            }
        }
    }

    // Adiciona novas estrelas
    const newStarsCount = numberOfStars - stars.length;
    for (let i = 0; i < newStarsCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        
        // Posição aleatória
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        
        // Tamanho aleatório com variação maior
        const size = Math.random() * 4 + 1;
        
        // Atraso na animação mais variado
        const delay = Math.random() * 4;
        
        // Duração da animação levemente variada para criar mais naturalidade
        const duration = 3 + Math.random() * 2;
        
        star.style.cssText = `
            left: ${x}%;
            top: ${y}%;
            width: ${size}px;
            height: ${size}px;
            animation-delay: ${delay}s;
            animation-duration: ${duration}s;
        `;
        
        if (!starsContainer) return; // guarda-dupla
        starsContainer.appendChild(star);
        stars.push(star);
    }
}

// Efeito de hover no botão
const startButton = document.querySelector('#start-button');
const buttonText = document.querySelector('.button-text');
const buttonGlow = document.querySelector('.button-glow');

if (startButton) {
    startButton.addEventListener('mouseenter', () => {
        // if (buttonText) buttonText.style.opacity = '0';
        if (buttonGlow) {
            buttonGlow.style.width = '150px';
            buttonGlow.style.height = '150px';
            buttonGlow.style.opacity = '0.6';
        }
        
        // Aumenta o tamanho do cursor ao passar sobre o botão
        if (cursor) cursor.style.transform = 'scale(1.5)';
        // Removendo a expansão do cursor-trail
        if (cursorTrail) {
            cursorTrail.style.width = '0';
            cursorTrail.style.height = '0';
        }
    });

    startButton.addEventListener('mouseleave', () => {
        // if (buttonText) buttonText.style.opacity = '1';
        if (buttonGlow) {
            buttonGlow.style.width = '0';
            buttonGlow.style.height = '0';
            buttonGlow.style.opacity = '0';
        }
        
        // Retorna o cursor ao tamanho normal
        if (cursor) cursor.style.transform = 'scale(1)';
        if (cursorTrail) {
            cursorTrail.style.width = '0';
            cursorTrail.style.height = '0';
        }
    });
}

// Inicializa as estrelas (somente se o container existir)
if (starsContainer) {
    createStars();
    // Recria algumas estrelas periodicamente para manter o efeito dinâmico
    // Intervalo mais curto para uma transição mais suave
    setInterval(createStars, 3000);
}

})();