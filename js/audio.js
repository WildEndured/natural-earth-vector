// ==================== AUDIO.JS ====================
// Процедурный звук через Web Audio API. Без файлов.
// P0: переиспользуемый noise-буфер, throttle, disconnect, unlock на user gesture.

const Audio = {
    ctx: null,
    master: null,
    enabled: true,
    _noiseBuffer: null,
    _lastPlayTime: {},
    _throttleMs: { shot: 30, explosion: 60, hit: 20, death: 100, reload: 50, alarm: 200 },

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.3;
            this.master.connect(this.ctx.destination);

            // P0 AUD-1: один шумовой буфер на всю сессию
            const sr = this.ctx.sampleRate;
            this._noiseBuffer = this.ctx.createBuffer(1, sr, sr);
            const data = this._noiseBuffer.getChannelData(0);
            for (let i = 0; i < sr; i++) data[i] = Math.random() * 2 - 1;

            // P0 AUD-4: разблокировка на первом user gesture (iOS / Android Chrome)
            const unlock = () => {
                if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
                document.removeEventListener('pointerdown', unlock);
                document.removeEventListener('touchstart', unlock);
            };
            document.addEventListener('pointerdown', unlock);
            document.addEventListener('touchstart', unlock);
        } catch (e) {
            console.warn('Audio недоступен:', e);
            this.enabled = false;
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    },

    // P0 AUD-2: throttle
    _throttle(name) {
        const min = this._throttleMs[name] || 0;
        if (min <= 0) return true;
        const now = performance.now();
        if ((this._lastPlayTime[name] || 0) + min > now) return false;
        this._lastPlayTime[name] = now;
        return true;
    },

    _tone(freq, type, duration, volume = 0.1, decay = true) {
        if (!this.enabled || !this.ctx) return;
        if (!Number.isFinite(freq) || freq <= 0) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (decay) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq * 0.3), now + duration);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(this.master);
        // P0 AUD-3: освобождение нод
        osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (_) {} };
        osc.start(now);
        osc.stop(now + duration);
    },

    _noise(duration, volume = 0.1, filterFreq = 1000) {
        if (!this.enabled || !this.ctx || !this._noiseBuffer) return;
        this.resume();
        const now = this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        source.buffer = this._noiseBuffer;
        source.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterFreq * 0.4), now + duration);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        // P0 AUD-3: освобождение нод
        source.onended = () => { try { source.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {} };
        source.start(now);
        source.stop(now + duration);
    },

    shot(weaponId) {
        if (!this._throttle('shot')) return;
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
        if (!this._throttle('explosion')) return;
        this._tone(80, 'sawtooth', 0.5, 0.2);
        this._noise(0.4, 0.15, 400);
    },

    hit() {
        if (!this._throttle('hit')) return;
        this._tone(800, 'sine', 0.05, 0.04);
    },

    death() {
        if (!this._throttle('death')) return;
        this._tone(200, 'sine', 0.6, 0.08);
    },

    reload() {
        if (!this._throttle('reload')) return;
        this._tone(400, 'square', 0.05, 0.03);
        setTimeout(() => this._tone(600, 'square', 0.05, 0.03), 100);
    },

    alarm() {
        if (!this._throttle('alarm')) return;
        this._tone(800, 'square', 0.15, 0.1);
        setTimeout(() => this._tone(1000, 'square', 0.15, 0.1), 150);
    }
};
