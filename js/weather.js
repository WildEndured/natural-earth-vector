// ==================== WEATHER.JS ====================
const Weather = {
    type: 'clear',
    intensity: 0,
    particles: [],
    _viewMult: 1.0,
    _accuracyMult: 1.0,
    _speedMult: 1.0,

    init() { this.particles = []; },

    set(type, intensity = 0.5) {
        this.type = type;
        this.intensity = intensity;
        this.particles = [];
        // P1 W-10: кэш модификаторов
        this._viewMult = type === 'fog' ? 0.5 : type === 'rain' ? 0.8 : type === 'snow' ? 0.7 : 1.0;
        this._accuracyMult = type === 'rain' ? 0.9 : type === 'snow' ? 0.85 : type === 'fog' ? 0.8 : 1.0;
        this._speedMult = type === 'snow' ? 0.8 : type === 'rain' ? 0.9 : 1.0;
        if (type === 'rain') for (let i = 0; i < 200; i++) this.particles.push(this._makeRainDrop());
        else if (type === 'snow') for (let i = 0; i < 150; i++) this.particles.push(this._makeSnowFlake());
    },

    _makeRainDrop() {
        return { x: Math.random() * 2000, y: Math.random() * 2000, speed: 400 + Math.random() * 200 };
    },
    _makeSnowFlake() {
        return { x: Math.random() * 2000, y: Math.random() * 2000, speed: 30 + Math.random() * 30, drift: (Math.random() - 0.5) * 20 };
    },

    update(dt) {
        if (this.type === 'rain') {
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                p.y += p.speed * dt;
                if (p.y > 2000) { p.y = -10; p.x = Math.random() * 2000; }
            }
        } else if (this.type === 'snow') {
            // P1 W-2: performance.now() вынесен из цикла
            const now = performance.now() / 1000;
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                p.y += p.speed * dt;
                p.x += Math.sin(now + p.drift) * 10 * dt;
                if (p.y > 2000) { p.y = -10; p.x = Math.random() * 2000; }
            }
        }
    },

    viewRangeMult() { return this._viewMult; },
    accuracyMult() { return this._accuracyMult; },
    speedMult() { return this._speedMult; },

    draw(ctx, camera, W, H) {
        if (this.type === 'rain') {
            // P1 W-1: батчинг — один beginPath / stroke
            ctx.strokeStyle = `rgba(150, 180, 220, ${0.3 * this.intensity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                const sx = (p.x - camera.x) * camera.zoom + W / 2;
                const sy = (p.y - camera.y) * camera.zoom + H / 2;
                if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx - 2, sy + 8);
            }
            ctx.stroke();
        } else if (this.type === 'snow') {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * this.intensity})`;
            ctx.beginPath();
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                const sx = (p.x - camera.x) * camera.zoom + W / 2;
                const sy = (p.y - camera.y) * camera.zoom + H / 2;
                if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
                ctx.moveTo(sx + 1.5, sy);
                ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
            }
            ctx.fill();
        } else if (this.type === 'fog') {
            ctx.fillStyle = `rgba(180, 180, 180, ${0.2 * this.intensity})`;
            ctx.fillRect(0, 0, W, H);
        }
    }
};
