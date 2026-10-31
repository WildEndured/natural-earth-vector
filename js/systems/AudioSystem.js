export class AudioSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.ac = null;
    this.master = null;
    this.buses = {};
    this.enabled = false;
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
      this.master.gain.value = 0.5;
      this.master.connect(this.ac.destination);

      this.buses.sfx = this.ac.createGain();
      this.buses.sfx.gain.value = 0.8;
      this.buses.sfx.connect(this.master);

      this.enabled = true;
    } catch (e) {
      console.warn('Audio init failed', e);
    }
  }

  playTone(freq, type, dur, vol = 0.1, bus = 'sfx') {
    if (!this.enabled || !this.ac) return;
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
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  shot(weaponId) {
    this.playTone(320, 'square', 0.06, 0.06);
    this.playNoise(0.04, 0.04, 3000);
  }

  playNoise(dur, vol, filterFreq) {
    if (!this.enabled || !this.ac) return;
    const now = this.ac.currentTime;
    const len = Math.floor(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const filter = this.ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    const gain = this.ac.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.buses.sfx);
    src.start(now);
    src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  dispose() { this.ac?.close(); this.ac = null; this.enabled = false; }
}
