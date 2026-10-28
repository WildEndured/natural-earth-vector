// ==================== AUDIO.JS ====================
// Процедурный звук через Web Audio API. Без файлов.

const Audio = {
    ctx: null,
    master: null,
    enabled: true,
    
    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.3;
            this.master.connect(this.ctx.destination);
        } catch (e) {
            console.warn('Audio недоступен:', e);
            this.enabled = false;
        }
    },
    
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    
    _tone(freq, type, duration, volume = 0.1, decay = true) {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (decay) osc.frequency.exponentialRampToValueAtTime(freq * 0.3, now + duration);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + duration);
    },
    
    _noise(duration, volume = 0.1, filterFreq = 1000) {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        source.start(now);
    },
    
    // Публичные методы
    shot(weaponId) {
        // Разные по оружию
        if (weaponId === 'pkm' || weaponId === 'm249') {
            this._tone(180, 'sawtooth', 0.08, 0.08);
            this._noise(0.05, 0.05, 2000);
        } else if (weaponId === 'rpg7') {
            this._tone(100, 'sawtooth', 0.4, 0.15);
            this._noise(0.3, 0.1, 800);
        } else {
            this._tone(300 + Math.random() * 100, 'square', 0.08, 0.06);
            this._noise(0.04, 0.03, 3000);
        }
    },
    
    explosion() {
        this._tone(80, 'sawtooth', 0.5, 0.2);
        this._noise(0.4, 0.15, 400);
    },
    
    hit() {
        this._tone(800, 'sine', 0.05, 0.04);
    },
    
    death() {
        this._tone(200, 'sine', 0.6, 0.08);
    },
    
    reload() {
        this._tone(400, 'square', 0.05, 0.03);
        setTimeout(() => this._tone(600, 'square', 0.05, 0.03), 100);
    },
    
    alarm() {
        this._tone(800, 'square', 0.15, 0.1);
        setTimeout(() => this._tone(1000, 'square', 0.15, 0.1), 150);
    }
};
