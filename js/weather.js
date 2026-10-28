// ==================== WEATHER.JS ====================
// Погода: дождь, туман, снег. Влияет на viewRange, accuracy, speed.

const Weather = {
    type: 'clear',  // clear | rain | fog | snow
    intensity: 0,   // 0–1
    particles: [],
    
    init() {
        this.particles = [];
    },
    
    set(type, intensity = 0.5) {
        this.type = type;
        this.intensity = intensity;
        this.particles = [];
        if (type === 'rain') {
            for (let i = 0; i < 200; i++) this.particles.push(this._makeRainDrop());
        } else if (type === 'snow') {
            for (let i = 0; i < 150; i++) this.particles.push(this._makeSnowFlake());
        }
    },
    
    _makeRainDrop() {
        return { x: Math.random() * 2000, y: Math.random() * 2000, speed: 400 + Math.random() * 200 };
    },
    
    _makeSnowFlake() {
        return { x: Math.random() * 2000, y: Math.random() * 2000, speed: 30 + Math.random() * 30, drift: (Math.random() - 0.5) * 20 };
    },
    
    update(dt) {
        if (this.type === 'rain') {
            for (const p of this.particles) {
                p.y += p.speed * dt;
                if (p.y > 2000) { p.y = -10; p.x = Math.random() * 2000; }
            }
        } else if (this.type === 'snow') {
            for (const p of this.particles) {
                p.y += p.speed * dt;
                p.x += Math.sin(performance.now() / 1000 + p.drift) * 10 * dt;
                if (p.y > 2000) { p.y = -10; p.x = Math.random() * 2000; }
            }
        }
    },
    
    // Модификаторы
    viewRangeMult() {
        if (this.type === 'fog') return 0.5;
        if (this.type === 'rain') return 0.8;
        if (this.type === 'snow') return 0.7;
        return 1.0;
    },
    
    accuracyMult() {
        if (this.type === 'rain') return 0.9;
        if (this.type === 'snow') return 0.85;
        if (this.type === 'fog') return 0.8;
        return 1.0;
    },
    
    speedMult() {
        if (this.type === 'snow') return 0.8;
        if (this.type === 'rain') return 0.9;
        return 1.0;
    },
    
    draw(ctx, camera, W, H) {
        if (this.type === 'rain') {
            ctx.strokeStyle = `rgba(150, 180, 220, ${0.3 * this.intensity})`;
            ctx.lineWidth = 1;
            for (const p of this.particles) {
                const sx = (p.x - camera.x) * camera.zoom + W / 2;
                const sy = (p.y - camera.y) * camera.zoom + H / 2;
                if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx - 2, sy + 8);
                ctx.stroke();
            }
        } else if (this.type === 'snow') {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * this.intensity})`;
            for (const p of this.particles) {
                const sx = (p.x - camera.x) * camera.zoom + W / 2;
                const sy = (p.y - camera.y) * camera.zoom + H / 2;
                if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
                ctx.beginPath();
                ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (this.type === 'fog') {
            ctx.fillStyle = `rgba(180, 180, 180, ${0.2 * this.intensity})`;
            ctx.fillRect(0, 0, W, H);
        }
    }
};
