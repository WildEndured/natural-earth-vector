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
      this.master.gain.value = 0.4;
      this.master.connect(this.ac.destination);

      this.buses.sfx = this.ac.createGain();
      this.buses.sfx.gain.value = 0.8;
      this.buses.sfx.connect(this.master);

      this.enabled = true;
      if (this.ac.state === 'suspended') this.ac.resume();
    } catch (e) {
      console.warn('Audio init failed', e);
    }
  }

  shot(weaponId) {
    if (!this.enabled) return;
    this._tone(320, 'square', 0.06, 0.05);
    this._noise(0.04, 0.04, 3000);
  }

  _tone(freq, type, dur, vol) {
    if (!this.enabled) return;
    const now = this.ac.currentTime;
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.buses.sfx);
    osc.start(now);
    osc.stop(now + dur);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  _noise(d
