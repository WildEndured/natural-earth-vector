// ─────────────────────────────────────────────────────
// ВРЕМЯ: старт 01.01.2022 00:00 UTC, по умолчанию ПАУЗА
// ─────────────────────────────────────────────────────
const START_TIME = new Date(Date.UTC(2022, 0, 1, 0, 0, 0)); // 1 января 2022, 00:00 UTC

const timeEngine = {
  baseRealMs: Date.now(),
  baseSimMs: START_TIME.getTime(),
  speed: 1,
  paused: true,              // ← пауза по умолчанию
  current: new Date(START_TIME.getTime()),
  season: 'winter',

  start() {
    setInterval(() => this.tick(), CONFIG.tickMs);
    this.updateSpeedButtons();
    this.update();
  },

  tick() {
    this.updateCurrentFromBase();
    this.update();
  },

  updateCurrentFromBase() {
    if (this.paused) return;
    const realElapsed = Date.now() - this.baseRealMs;
    this.current = new Date(this.baseSimMs + realElapsed * this.speed);
  },

  setSpeed(newSpeed) {
    this.updateCurrentFromBase();
    if (newSpeed === 0) {
      this.paused = true;
    } else {
      this.baseRealMs = Date.now();
      this.baseSimMs = this.current.getTime();
      this.speed = newSpeed;
      this.paused = false;
    }
    this.updateSpeedButtons();
  },

  togglePause() {
    return this.setSpeed(this.paused ? (this.speed || 1) : 0);
  },

  updateSpeedButtons() {
    document.querySelectorAll('.speed-btn').forEach(b => {
      const val = Number(b.dataset.speed);
      b.classList.toggle('active',
        this.paused ? val === 0 : val === this.speed && val !== 0
      );
    });
  },

  update() {
    const hudDate = document.getElementById('hud-date');
    if (hudDate) {
      const d = this.current;
      const day = String(d.getUTCDate()).padStart(2, '0');
      const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
      hudDate.textContent = `${day} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }
    const hudDay = document.getElementById('hud-date-day');
    if (hudDay) {
      const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      hudDay.textContent = days[this.current.getUTCDay()];
    }
    this.updateSeason();
    environment.renderNightOverlay(this.current);
  },

  updateSeason() {
    const m = this.current.getUTCMonth();
    let s = 'winter';
    if (m >= 2 && m <= 4) s = 'spring';
    else if (m >= 5 && m <= 7) s = 'summer';
    else if (m >= 8 && m <= 10) s = 'autumn';

    if (s !== this.season) {
      this.season = s;
      const hud = document.getElementById('hud-season');
      if (hud) {
        hud.textContent = { winter:'ЗИМА', spring:'ВЕСНА', summer:'ЛЕТО', autumn:'ОСЕНЬ' }[s];
        hud.style.color = { winter:'#85c1e9', spring:'#58d68d', summer:'#f1c40f', autumn:'#e67e22' }[s];
      }
      environment.applySeasonTint(s);
    }
  }
};
