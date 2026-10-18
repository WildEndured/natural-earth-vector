// ═══════════════════════════════════════════════════════
// weather.js — Движок Времени, Климата и Катастроф
// Зависимости: window.map (из script.js), SunCalc
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const MAP = window.map;
  if (!MAP) {
    console.error('[weather.js] window.map не найден. Подключите script.js раньше.');
    return;
  }

  // ─────────────────────────────────────────────────────
  // КОНФИГ
  // ─────────────────────────────────────────────────────
  const CONFIG = {
    startTime: new Date('2024-06-21T12:00:00Z'),
    simulationSpeed: 5,          // 1 тик = 5 мин симуляции
    disasterChance: 0.03,        // шанс за тик
    maxActiveDisasters: 8,
    disasterDurationMs: 30000,
    tickMs: 1000
  };

  // ─────────────────────────────────────────────────────
  // ВРЕМЯ
  // ─────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────
  // ОКРУЖАЮЩАЯ СРЕДА
  // ─────────────────────────────────────────────────────
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
      if (!this.nightLayer) {
        this.nightLayer = L.layerGroup().addTo(MAP);
      }
      this.nightLayer.clearLayers();

      const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
      const midnightLng = 180 - 15 * utcHours;

      // Наклон оси → склонение солнца
      const dayOfYear = Math.floor(
        (date - new Date(date.getUTCFullYear(), 0, 0)) / 86400000
      );
      const declination = 23.44 * Math.cos(
        (2 * Math.PI / 365) * (dayOfYear - 172)
      );

      const nightPolygon = this.buildNightPolygon(midnightLng, declination);

      L.polygon(nightPolygon, {
        color: 'transparent',
        fillColor: '#000011',
        fillOpacity: 0.45,
        className: 'night-overlay',
        interactive: false
      }).addTo(this.nightLayer);
    },

    buildNightPolygon(centerLng, declination) {
      const points = [];
      const d2r = Math.PI / 180;
      const decl = declination * d2r;

      for (let lng = -180;
