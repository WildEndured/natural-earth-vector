// ═══════════════════════════════════════════════════════
// weather.js — Движок Времени (HoI4-стиль)
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const MAP = window.map;
  if (!MAP) { console.error('[weather.js] window.map не найден.'); return; }

  const CONFIG = {
    simulationSpeed: 1,           // ×1 = реальное время
    disasterChance: 0.05,
    maxActiveDisasters: 8,
    disasterDurationMs: 30000,
    tickMs: 250
  };

  // ─────────────────────────────────────────────────────
  // ВРЕМЯ: реальное, с паузой и ускорением
  // ─────────────────────────────────────────────────────
  const timeEngine = {
    baseRealMs: Date.now(),
    baseSimMs: Date.now(),
    speed: 1,
    paused: false,
    current: new Date(),
    season: 'summer',

    start() {
      setInterval(() => this.tick(), CONFIG.tickMs);
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
      return this.setSpeed(this.paused ? this.speed || 1 : 0);
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

  // ─────────────────────────────────────────────────────
  // ОКРУЖАЮЩАЯ СРЕДА
  // ─────────────────────────────────────────────────────
  const environment = {
    nightLayer: null,
    applySeasonTint(season) {
      const mapEl = document.getElementById('map');
      if (!mapEl) return;
      mapEl.classList.remove('season-winter','season-autumn','season-spring','season-summer');
      mapEl.classList.add('season-' + season);
    },
    renderNightOverlay(date) {
      if (!this.nightLayer) this.nightLayer = L.layerGroup().addTo(MAP);
      this.nightLayer.clearLayers();
      const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
      const midnightLng = 180 - 15 * utcHours;
      const dayOfYear = Math.floor((date - new Date(date.getUTCFullYear(), 0, 0)) / 86400000);
      const declination = 23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear - 172));
      const points = []; const d2r = Math.PI / 180; const decl = declination * d2r;
      for (let lng = -180; lng <= 180; lng += 5) {
        const H = (lng - midnightLng) * d2r;
        const tanDecl = Math.tan(decl);
        let lat = Math.abs(tanDecl) < 1e-6 ? 0 : Math.atan(-Math.cos(H) / tanDecl) / d2r;
        lat = Math.max(-90, Math.min(90, lat));
        points.push([lat, lng]);
      }
      if (declination >= 0) { points.push([-90,180]); points.push([-90,-180]); }
      else { points.push([90,180]); points.push([90,-180]); }
      L.polygon(points, {
        color: 'transparent', fillColor: '#000511',
        fillOpacity: 0.4, className: 'night-overlay', interactive: false
      }).addTo(this.nightLayer);
    }
  };

  // ─────────────────────────────────────────────────────
  // КАТАСТРОФЫ
  // ─────────────────────────────────────────────────────
  const DISASTERS = {
    fire:     { name: 'Лесной пожар',      color: '#e74c3c', radius: 60000,  season: ['summer','autumn'] },
    flood:    { name: 'Наводнение',        color: '#3498db', radius: 150000, season: ['spring','autumn'] },
    storm:    { name: 'Тропический шторм', color: '#9b59b6', radius: 220000, season: ['summer','autumn'] },
    blizzard: { name: 'Снежная буря',      color: '#85c1e9', radius: 180000, season: ['winter'] },
    tornado:  { name: 'Торнадо',           color: '#7f8c8d', radius: 40000,  season: ['spring','summer'] }
  };

  const disasterEngine = {
    active: [],
    start() { setInterval(() => this.tick(), 1000); },
    tick() {
      if (this.active.length >= CONFIG.maxActiveDisasters) return;
      if (Math.random() > CONFIG.disasterChance) return;
      this.spawnRandomForSeason();
      this.updateStatus();
    },
    updateStatus() {
      const el = document.getElementById('status-disasters');
      if (el) el.textContent = this.active.length;
    },
    spawnRandomForSeason() {
      for (let i = 0; i < 30; i++) {
        const point = this.randomPoint();
        const biome = window.ClimateEngine ? window.ClimateEngine.getBiomeAt(point.lat, point.lng) : 'Unknown';
        const validHere = this.validTypesAt(point.lat, point.lng);
        const seasonTypes = Object.entries(DISASTERS)
          .filter(([, d]) => d.season.includes(timeEngine.season))
          .map(([k]) => k);
        const allowed = validHere.filter(t => seasonTypes.includes(t));
        if (!allowed.length) continue;
        const type = allowed[Math.floor(Math.random() * allowed.length)];
        this.spawn(type, point.lat, point.lng, biome);
        return;
      }
    },
    validTypesAt(lat, lng) {
      let result = Object.keys(DISASTERS);
      if (window.ClimateEngine && window.ClimateEngine.loaded) {
        result = window.ClimateEngine.getValidDisasters(lat, lng).filter(t => DISASTERS[t]);
      }
      if (window.TerrainEngine && !window.TerrainEngine.canStartFire(lat, lng)) {
        result = result.filter(t => t !== 'fire');
      }
      return result;
    },
    randomPoint() {
      return { lat: (Math.random() * 140) - 70, lng: (Math.random() * 360) - 180 };
    },
    spawn(type, lat, lng, biome) {
      const cfg = DISASTERS[type];
      const circle = L.circle([lat, lng], {
        radius: cfg.radius, color: cfg.color, fillColor: cfg.color,
        fillOpacity: 0.4, weight: 2, className: 'disaster-pulse'
      }).addTo(MAP);
      circle.bindPopup(`<strong>${cfg.name}</strong><br>Биом: ${biome || '—'}<br>Координаты: ${lat.toFixed(2)}, ${lng.toFixed(2)}`);
      const event = { type, name: cfg.name, biome, lat, lng, circle, startedAt: Date.now() };
      this.active.push(event);
      this.updateStatus();
      setTimeout(() => this.despawn(event), CONFIG.disasterDurationMs);
      if (window.showToast) window.showToast(`⚠ ${cfg.name}`, 'warn');
    },
    despawn(event) {
      if (MAP.hasLayer(event.circle)) MAP.removeLayer(event.circle);
      this.active = this.active.filter(e => e !== event);
      this.updateStatus();
    },
    manualSpawn() { this.spawnRandomForSeason(); }
  };

  // ─────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────
  function bindUI() {
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = Number(btn.dataset.speed);
        timeEngine.setSpeed(speed);
      });
    });

    // Горячие клавиши (как в HoI4)
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '1' || e.key === ' ') { timeEngine.setSpeed(0); e.preventDefault(); }
      else if (e.key === '2') timeEngine.setSpeed(1);
      else if (e.key === '3') timeEngine.setSpeed(10);
      else if (e.key === '4') timeEngine.setSpeed(60);
      else if (e.key === '5') timeEngine.setSpeed(600);
    });

    const btnSpawn = document.getElementById('btn-spawn-disaster');
    if (btnSpawn) btnSpawn.addEventListener('click', () => disasterEngine.manualSpawn());
  }

  function init() {
    bindUI();
    timeEngine.start();
    disasterEngine.start();
    console.log('[weather.js] Движок природы запущен.');
  }

  if (MAP._loaded) init();
  else MAP.whenReady(init);

  window.NatureEngine = { timeEngine, disasterEngine, environment, DISASTERS, CONFIG };
})();
