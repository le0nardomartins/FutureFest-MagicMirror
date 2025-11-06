/**
 * Componente de círculo pulsante com ondas sonoras
 * Cria um efeito visual de ondas pulsantes que mudam de cor do azul para verde
 */
class SoundWaveAnimation {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.canvas = null;
        this.ctx = null;
        this.waves = [];
        this.particles = [];
        this.audioContext = null;
        this.audioElement = null;
        this.analyser = null;
        this.dataArray = null;
        this.isPlaying = false;
        this.animationId = null;
        this.time = 0;
        
        // Configurações de cores
        this.startColor = { r: 0, g: 200, b: 255 }; // Azul
        this.endColor = { r: 30, g: 255, b: 160 };  // Verde
        this.coreColor = { r: 255, g: 245, b: 200 }; // Cor do núcleo (amarelado)
        
        this.init();
    }
    
    init() {
        // Criar canvas
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        // Garante cobertura total e evita distorções no flex container
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = '0';
        this.canvas.style.top = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.container.appendChild(this.canvas);
        
        // Configurar tamanho do canvas
        this.resize();
        
        // Criar ondas iniciais
        this.createWaves(5);
        
        // Criar partículas energéticas
        this.createParticles(80);
        
        // Adicionar listener para redimensionamento da janela
        window.addEventListener('resize', () => this.resize());
        
        // Iniciar animação
        this.animate();
    }
    
    resize() {
        const cssW = this.container.clientWidth || this.container.offsetWidth;
        const cssH = this.container.clientHeight || this.container.offsetHeight;
        const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
        // Ajusta o buffer interno para alta densidade sem alterar CSS
        this.canvas.width = Math.max(1, Math.floor(cssW * dpr));
        this.canvas.height = Math.max(1, Math.floor(cssH * dpr));
        // Normaliza o sistema de coordenadas para 1:1 com CSS
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    createWaves(count) {
        this.waves = [];
        for (let i = 0; i < count; i++) {
            this.waves.push({
                radius: 0,
                maxRadius: 80, // Aumentado de 50 para 80
                alpha: 1,
                speed: 1.5 + Math.random() * 1, // Aumentada a velocidade base e variação
                thickness: 2 + Math.random() * 6, // Aumentada a variação de espessura
                pulseSpeed: 0.5 + Math.random() * 0.5 // Nova propriedade para pulsar
            });
        }
    }
    
    createParticles(count) {
        this.particles = [];
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(this.canvas.width, this.canvas.height) * 0.4;
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = (Math.random() * 0.5 + 0.3) * radius;
            
            this.particles.push({
                x: centerX + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance,
                size: 2 + Math.random() * 4, // Aumentado o tamanho das partículas
                speedX: (Math.random() - 0.5) * 2.5, // Aumentada a velocidade
                speedY: (Math.random() - 0.5) * 2.5, // Aumentada a velocidade
                color: Math.random() > 0.5 ? this.startColor : this.endColor,
                opacity: 0.4 + Math.random() * 0.6,
                angle: Math.random() * Math.PI * 2,
                angleSpeed: (Math.random() - 0.5) * 0.04, // Aumentada a velocidade de rotação
                distance: distance,
                distanceSpeed: (Math.random() - 0.5) * 1.2, // Aumentada a velocidade de distância
                orbitRadius: distance,
                orbitSpeed: (Math.random() - 0.5) * 0.02 // Aumentada a velocidade orbital
            });
        }
    }
    
    interpolateColor(ratio) {
        // Interpolação linear entre as cores inicial e final
        return {
            r: Math.floor(this.startColor.r + (this.endColor.r - this.startColor.r) * ratio),
            g: Math.floor(this.startColor.g + (this.endColor.g - this.startColor.g) * ratio),
            b: Math.floor(this.startColor.b + (this.endColor.b - this.startColor.b) * ratio)
        };
    }
    
    connectAudio(audioElementId) {
        try {
            // Configurar o elemento de áudio
            this.audioElement = document.getElementById(audioElementId);
            
            // Criar contexto de áudio
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Criar analyser
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            
            // Conectar fonte de áudio ao analyser
            const source = this.audioContext.createMediaElementSource(this.audioElement);
            source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            // Criar array para dados de frequência
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            console.log("Áudio conectado com sucesso!");
        } catch (error) {
            console.error("Erro ao conectar áudio:", error);
        }
    }
    
    playAudio() {
        if (this.audioElement && this.audioContext) {
            // Verificar se o contexto de áudio está em estado suspenso
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            // Reproduzir áudio
            this.audioElement.currentTime = 0;
            this.audioElement.play().catch(error => {
                console.error("Erro ao reproduzir áudio:", error);
            });
            
            this.isPlaying = true;
        }
    }
    
    animate() {
        this.time += 0.01;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Desenhar brilho de fundo geral
        const backgroundGlow = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, Math.min(this.canvas.width, this.canvas.height) * 0.3
        );
        
        const pulseIntensity = 0.5 + 0.3 * Math.sin(this.time * 1.5);
        const colorRatio = 0.5 + 0.3 * Math.sin(this.time * 0.7);
        const glowColor = this.interpolateColor(colorRatio);
        
        backgroundGlow.addColorStop(0, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${pulseIntensity * 0.4})`);
        backgroundGlow.addColorStop(0.5, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${pulseIntensity * 0.1})`);
        backgroundGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        this.ctx.fillStyle = backgroundGlow;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Desenhar brilho central mais intenso
        const coreGlow = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, 80 + Math.sin(this.time * 2) * 15 // Aumentado o raio e a variação
        );
        
        const coreIntensity = 0.7 + 0.3 * Math.sin(this.time * 2);
        
        coreGlow.addColorStop(0, `rgba(${this.coreColor.r}, ${this.coreColor.g}, ${this.coreColor.b}, ${coreIntensity})`);
        coreGlow.addColorStop(0.4, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${coreIntensity * 0.6})`);
        coreGlow.addColorStop(1, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0)`);
        
        this.ctx.fillStyle = coreGlow;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 100 + Math.sin(this.time * 2) * 20, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Desenhar núcleo central brilhante
        const innerRadius = 25 + Math.sin(this.time * 3) * 8; // Aumentado o raio base e a variação
        const coreGradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, innerRadius
        );
        
        coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        coreGradient.addColorStop(0.3, `rgba(${this.coreColor.r}, ${this.coreColor.g}, ${this.coreColor.b}, 0.9)`);
        coreGradient.addColorStop(1, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.6)`);
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = coreGradient;
        this.ctx.fill();
        
        // Atualizar e desenhar ondas
        let allWavesExpired = true;
        
        for (let i = 0; i < this.waves.length; i++) {
            const wave = this.waves[i];
            
            if (wave.radius < wave.maxRadius) {
                allWavesExpired = false;
                
                // Atualizar raio e opacidade com pulsação
                wave.radius += wave.speed * (1 + Math.sin(this.time * wave.pulseSpeed) * 0.3);
                wave.alpha = 0.8 * (1 - (wave.radius / wave.maxRadius));
                
                // Calcular cor baseada no progresso com variação
                const waveColorRatio = 0.3 + 0.7 * (wave.radius / wave.maxRadius) + Math.sin(this.time * 2) * 0.1;
                const waveColor = this.interpolateColor(waveColorRatio);
                
                // Desenhar onda com efeito de brilho melhorado
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, wave.radius, 0, Math.PI * 2);
                this.ctx.strokeStyle = `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${wave.alpha})`;
                this.ctx.lineWidth = wave.thickness * (1 + Math.sin(this.time * 3) * 0.2);
                this.ctx.filter = 'blur(3px)'; // Aumentado o blur
                this.ctx.stroke();
                this.ctx.filter = 'none';
            }
        }
        
        // Criar novas ondas mais frequentemente
        if (allWavesExpired || Math.random() < 0.03) { // Aumentada a chance de criar novas ondas
            this.createWaves(1 + Math.floor(Math.random() * 3)); // Possibilidade de criar mais ondas
        }
        
        // Atualizar e desenhar partículas
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            
            // Atualizar posição com movimento orbital
            p.angle += p.orbitSpeed;
            p.distance += p.distanceSpeed;
            
            // Limitar a distância para manter as partículas próximas
            if (p.distance < p.orbitRadius * 0.5) p.distance = p.orbitRadius * 0.5;
            if (p.distance > p.orbitRadius * 1.5) p.distance = p.orbitRadius * 1.5;
            
            // Atualizar posição baseada em órbita
            p.x = centerX + Math.cos(p.angle) * p.distance;
            p.y = centerY + Math.sin(p.angle) * p.distance;
            
            // Pulsar tamanho da partícula
            const sizePulse = 0.7 + 0.5 * Math.sin(this.time * 2 + i);
            const particleSize = p.size * sizePulse;
            
            // Desenhar partícula com gradiente
            const particleGradient = this.ctx.createRadialGradient(
                p.x, p.y, 0,
                p.x, p.y, particleSize * 2
            );
            
            const colorIdx = Math.floor(this.time + i) % 2;
            const particleColor = colorIdx === 0 ? this.startColor : this.endColor;
            
            particleGradient.addColorStop(0, `rgba(${particleColor.r}, ${particleColor.g}, ${particleColor.b}, ${p.opacity})`);
            particleGradient.addColorStop(1, `rgba(${particleColor.r}, ${particleColor.g}, ${particleColor.b}, 0)`);
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, particleSize * 2, 0, Math.PI * 2);
            this.ctx.fillStyle = particleGradient;
            this.ctx.fill();
        }
        
        // Desenhar linhas de energia conectando algumas partículas
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 80) {
                    const opacity = (1 - distance / 80) * 0.3;
                    const lineGradient = this.ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                    const color1 = i % 2 === 0 ? this.startColor : this.endColor;
                    const color2 = j % 2 === 0 ? this.startColor : this.endColor;
                    
                    lineGradient.addColorStop(0, `rgba(${color1.r}, ${color1.g}, ${color1.b}, ${opacity})`);
                    lineGradient.addColorStop(1, `rgba(${color2.r}, ${color2.g}, ${color2.b}, ${opacity})`);
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = lineGradient;
                    this.ctx.stroke();
                }
            }
        }
        
        // Analisar áudio se estiver reproduzindo
        if (this.isPlaying && this.analyser) {
            this.analyser.getByteFrequencyData(this.dataArray);
            
            // Calcular valor médio de frequência
            let sum = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                sum += this.dataArray[i];
            }
            const average = sum / this.dataArray.length;
            
            // Ajustar ondas e partículas com base no volume de áudio
            const volumeFactor = average / 128;
            
            for (let i = 0; i < this.waves.length; i++) {
                this.waves[i].speed = 1 + volumeFactor * 2;
                this.waves[i].thickness = 2 + volumeFactor * 4;
            }
            
            // Aumentar velocidade das partículas com volume
            for (let i = 0; i < this.particles.length; i++) {
                this.particles[i].orbitSpeed = (this.particles[i].orbitSpeed * 0.8) + (Math.random() - 0.5) * 0.01 * volumeFactor;
                this.particles[i].distanceSpeed = (this.particles[i].distanceSpeed * 0.8) + (Math.random() - 0.5) * 0.8 * volumeFactor;
            }
        }
        
        // Continuar animação
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.isPlaying = false;
        }
    }
}

// Exportar para uso global
window.SoundWaveAnimation = SoundWaveAnimation; 