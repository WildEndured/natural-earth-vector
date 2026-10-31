export class AudioSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.ac = null;
    this.master = null;
    this.buses = {};
    this.enabled = false;
    this._noiseBuffer = null;
    this._lastPlay = new Map();
    this._throttle = {
      shot: 30,
      explosion: 60,
      hit: 20,
      death: 100,
      reload: 50,
    };
    this._installUnlock();
  }

  _installUnlock() {
    const unlock = () => {
      this.init();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('touchstart', unlock);
  }

  init() {
    if (this.ac) return;
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ac.destination);

      this.buses.sfx = this.ac.createGain();
      this.buses.sfx.gain.value = 0.8;
      this.buses.sfx.connect(this.master);

      this.buses.ui = this.ac.createGain();
      this.buses.ui.gain.value = 0.5;
      this.buses.ui.connect(this.master);

      const sr = this.ac.sampleRate;
      this._noiseBuffer = this.ac.createBuffer(1, sr, sr);
      const data = this._noiseBuffer.getChannelData(0);
      for (let i = 0; i < sr; i++) data[i] = Math.random() * 2 - 1;

      this.enabled = true;
      if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    } catch (e) {
      console.warn('Audio init failed', e);
    }
  }

  resume() {
    if (this.ac && this.ac.state === 'suspended') {
      this.ac.resume().catch(() => {});
    }
  }

  _canPlay(name) {
    if (!this.enabled) return false;
    const min = this._throttle[name] || 0;
    if (min <= 0) return true;
    const now = performance.now();
    const last = this._lastPlay.get(name) || 0;
    if (last + min > now) return false;
    this._lastPlay.set(name, now);
    return true;
  }

  _tone(freq, type, dur, vol, bus = 'sfx') {
    if (!this.enabled) return;
    this.resume();
    const now = this.ac.currentTime;
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.buses[bus] || this.master);
    osc.start(now);
    osc.stop(now + dur);
    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect(); } catch (_) {}
    };
  }

  _noise(dur, vol, filterFreq, bus = 'sfx') {
    if (!this.enabled || !this._noiseBuffer) return;
    this.resume();
    const now = this.ac.currentTime;
    const src = this.ac.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const filter = this.ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterFreq * 0.4), now + dur);
    const gain = this.ac.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.buses[bus] || this.master);
    src.start(now);
    src.stop(now + dur);
    src.onended = () => {
      try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {}
    };
  }

  shot(weaponId) {
    if (!this._canPlay('shot')) return;
    if (weaponId === 'pkm' || weaponId === 'm249') {
      this._tone(180, 'sawtooth', 0.08, 0.08);
      this._noise(0.05, 0.05, 2000);
    } else if (weaponId === 'rpg7') {
      this._tone(100, 'sawtooth', 0.4, 0.15);
      this._noise(0.3, 0.1, 800);
    } else if (weaponId === 'm4a1' || weaponId === 'm4a1_gl') {
      this._tone(350, 'square', 0.06, 0.05);
      this._noise(0.03, 0.04, 3500);
    } else {
      this._tone(320, 'square', 0.06, 0.06);
      this._noise(0.04, 0.04, 3000);
    }
  }

  explosion() {
    if (!this._canPlay('explosion')) return;
    this._tone(80, 'sawtooth', 0.5, 0.2);
    this._noise(0.4, 0.15, 400);
  }

  hit() {
    if (!this._canPlay('hit')) return;
    this._tone(800, 'sine', 0.05, 0.04);
  }

  death() {
    if (!this._canPlay('death')) return;
    this._tone(200, 'sine', 0.6, 0.08);
  }

  reload() {
    if (!this._canPlay('reload')) return;
    this._tone(400, 'square', 0.05, 0.03);
    setTimeout(() => this._tone(600, 'square', 0.05, 0.03), 100);
  }

  uiClick() {
    this._tone(600, 'sine', 0.04, 0.03, 'ui');
  }

  dispose() {
    if (this.ac) {
      this.ac.close().catch(() => {});
      this.ac = null;
    }
    this.enabled = false;
  }
  }
