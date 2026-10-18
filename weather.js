// ═══════════════════════════════════════════════════════
// weather.js — Движок Времени, Климата и Катастроф
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const MAP = window.map;
  if (!MAP) {
    console.error('[weather.js] window.map не найден.');
    return;
  }

  const CONFIG = {
    startTime: new Date('2024-06-21T12:00:00Z'),
    simulationSpeed: 5,
    disasterChance: 0.05,
    maxActiveDisasters: 8,
    disasterDurationMs: 30000,
    tickMs: 1000
  };

  const timeEngine = {
    current: new Date(CONFIG.startTime.getTime()),
    paused: false,
    season: 'summer',

    start() {
      setInterval(() => this.tick(), CONFIG.tickMs);
      this.update();
    },

    tick() {
      if (this.paused) return;
      this.current = new Date(
        this.current.getTime() + CONFIG.simulationSpeed * 60 * 1000
      );
      this.update();
    },

    update() {
      const hudTime = document.getElementById('hud-time');
      if (hudTime) {
        hudTime.textContent = this.current.toISOString().slice(11, 16) + ' UTC';
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
          hud.textContent = s.toUpperCase();
          hud.style.color = {
            winter: '#85c1e9', spring: '#58d68d',
            summer: '#f1c40f', autumn: '#e67e22'
          }[s];
        }
        environment.applySeasonTint(s);
      }
    }
  };

  const environment = {
    nightLayer: null,

    applySeasonTint(season) {
      const mapEl = document.getElementById('map');
      if (!mapEl) return;
      mapEl.classList.remove(
        'season-winter', 'season-autumn', 'season-spring', 'season-summer'
      );
      mapEl.classList.add('season-' + season);
    },

    renderNightOverlay(date) {
      if (!this.nightLayer) this.nightLayer = L.layerGroup().addTo(MAP);
      this.nightLayer.clearLayers();

      const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
      const midnightLng = 180 - 15 * utcHours;
      const dayOfYear = Math.floor(
        (date - new Date(date.getUTCFullYear(), 0, 0)) / 86400000
      );
      const declination = 23.44 * Math.cos(
        (2 * Math.PI / 365) * (dayOfYear - 172)
      );

      const points = [];
      const d2r = Math.PI / 180;
      const decl = declination * d2r;

      for (let lng = -180; lng <= 180; lng += 5) {
        const H = (lng - midnightLng) * d2r;
        const tanDecl = Math.tan(decl);
        let lat = Math.abs(tanDecl) < 1e-6
          ? 0
          : Math.atan(-Math.cos(H) / tanDecl) / d2r;
        lat = Math.max(-90, Math.min(90, lat));
        points.push([lat, lng]);
      }
      if (declination >= 0) {
        points.push([-90, 180]); points.push([-90, -180]);
      } else {
        points.push([90, 180]); points.push([90, -180]);
      }

      L.polygon(points, {
        color: 'transparent',
        fillColor: '#000011',
        fillOpacity: 0.45,
        className: 'night-overlay',
        interactive: false
      }).addTo(this.nightLayer);
    }
  };

  const DISASTERS = {
    fire:     { name: 'Лесной пожар',      color: '#e74c3c', radius: 60000,  season: ['summer', 'autumn'] },
    flood:    { name: 'Наводнение',        color: '#3498db', radius: 150000, season: ['spring', 'autumn'] },
    storm:    { name: 'Тропический шторм', color: '#9b59b6', radius: 220000, season: ['summer', 'autumn'] },
    blizzard: { name: 'Снежная буря',      color: '#85c1e9', radius: 180000, season: ['winter'] },
    tornado:  { name: 'Торнадо',           color: '#7f8c8d', radius: 40000,  season: ['spring', 'summer'] }
  };

  const disasterEngine = {
    active: [],

    start() { setInterval(() => this.tick(), CONFIG.tickMs); },

    tick() {
      if (this.active.length >= CONFIG.maxActiveDisasters) return;
      if (Math.random() > CONFIG.disasterChance) return;
      this.spawnRandomForSeason();
    },

    spawnRandomForSeason() {
      for (let i = 0; i < 30; i++) {
        const point = this.randomPoint();

        const biome = window.ClimateEngine
          ? window.ClimateEngine.getBiomeAt(point.lat, point.lng)
          : 'Unknown';

        if (window.TerrainEngine &&
            !window.TerrainEngine.canStartFire(point.lat, point.lng) &&
            this.hasFireInSeason()) continue;

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

    hasFireInSeason() {
      return DISASTERS.fire.season.includes(timeEngine.season);
    },

    validTypesAt(lat, lng) {
      let result = Object.keys(DISASTERS);
      if (window.ClimateEngine && window.ClimateEngine.loaded) {
        result = window.ClimateEngine.getValidDisasters(lat, lng)
          .filter(t => DISASTERS[t] !== undefined);
      }
      if (window.TerrainEngine &&
          !window.TerrainEngine.canStartFire(lat, lng)) {
        result = result.filter(t => t !== 'fire');
      }
      return result;
    },

    randomPoint() {
      return {
        lat: (Math.random() * 140) - 70,
        lng: (Math.random() * 360) - 180
      };
    },

    spawn(type, lat, lng, biome) {
      const cfg = DISASTERS[type];
      const circle = L.circle([lat, lng], {
        radius: cfg.radius,
        color: cfg.color, fillColor: cfg.color, fillOpacity: 0.45,
        weight: 2, className: 'disaster-pulse'
      }).addTo(MAP);

      let extraInfo = '';
      if (window.Atmosphere) {
        const atm = window.Atmosphere.getAtPoint(
          lat, lng, timeEngine.current, timeEngine.season
        );
        extraInfo += `<br>Температура: ${atm.temp.toFixed(1)}°C`;
        extraInfo += `<br>Ветер: ${atm.wind.speed.toFixed(0)} м/с`;
      }
      if (window.TerrainEngine) {
        const snow = window.TerrainEngine.getSnowAt(lat, lng);
        const soil = window.TerrainEngine.getSoilAt(lat, lng);
        if (snow > 0.5) extraInfo += `<br>Снег: ${snow.toFixed(1)} см`;
        extraInfo += `<br>Почва: ${soil}`;
      }

      circle.bindPopup(`
        <strong>${cfg.name}</strong><br>
        Биом: ${biome || '—'}<br>
        Координаты: ${lat.toFixed(2)}, ${lng.toFixed(2)}${extraInfo}<br>
        Начало: ${timeEngine.current.toISOString().slice(11, 16)} UTC
      `);

      const event = {
        type, name: cfg.name, biome, lat, lng, circle, startedAt: Date.now()
      };
      this.active.push(event);
      setTimeout(() => this.despawn(event), CONFIG.disasterDurationMs);

      console.log(`[DISASTER] ${cfg.name} @ ${lat.toFixed(2)},${lng.toFixed(2)} [${biome}]`);
    },

    despawn(event) {
      if (MAP.hasLayer(event.circle)) MAP.removeLayer(event.circle);
      this.active = this.active.filter(e => e !== event);
    },

    manualSpawn() { this.spawnRandomForSeason(); }
  };

  function bindUI() {
    const btnPause = document.getElementById('btn-pause-time');
    if (btnPause) {
      btnPause.addEventListener('click', (e) => {
        timeEngine.paused = !timeEngine.paused;
        e.target.textContent = timeEngine.paused ? '▶ Пуск' : '⏸ Пауза';
        e.target.style.color = timeEngine.paused ? '#e74c3c' : '#d4d4d4';
      });
    }
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

  window.NatureEngine = {
    timeEngine, disasterEngine, environment, DISASTERS, CONFIG
  };
})();
