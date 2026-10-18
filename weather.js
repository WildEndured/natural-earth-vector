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
    // Скорость: 1 тик = 1 реальная секунда, 1 тик = 5 минут симуляции
    simulationSpeed: 5,
    maxZoomForSunCalc: 6,
    // Шанс спавна случайной катастрофы за 1 тик (0..1)
    disasterChance: 0.03,
    maxActiveDisasters: 8,
    disasterDurationMs: 30000
  };

  // ─────────────────────────────────────────────────────
  // ВРЕМЯ
  // ─────────────────────────────────────────────────────
  const timeEngine = {
    current: new Date(CONFIG.startTime.getTime()),
    paused: false,
    season: 'summer',
    tickMs: 1000,

    start() {
      setInterval(() => this.tick(), this.tickMs);
      this.update();
    },

    tick() {
      if (this.paused) return;
      this.current = new Date(this.current.getTime() + CONFIG.simulationSpeed * 60 * 1000);
      this.update();
    },

    update() {
      // HUD
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
  // ОКРУЖАЮЩАЯ СРЕДА (день/ночь, сезонная окраска)
  // ─────────────────────────────────────────────────────
  const environment = {
    nightLayer: null,

    applySeasonTint(season) {
      const mapEl = document.getElementById('map');
      if (!mapEl) return;
      mapEl.classList.remove('season-winter', 'season-autumn', 'season-spring', 'season-summer');
      mapEl.classList.add('season-' + season);
    },

    // Терминатор: рисуем полигон ночной тени по точке солнца
    renderNightOverlay(date) {
      if (!this.nightLayer) {
        this.nightLayer = L.layerGroup().addTo(MAP);
      }
      this.nightLayer.clearLayers();

      // Находим точку, где солнце в зените
      const pos = SunCalc.getPosition(date, 0, 0);
      // Приблизительный антипод солнца (координаты точки "полуночи")
      // Для точности нужен полный расчёт, но для симулятора достаточно:
      const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;

      // Долгота "полуночи" = 180 - 15 * utcHours (приближённо)
      const midnightLng = 180 - 15 * utcHours;
      const declination = 23.44 * Math.cos((2 * Math.PI / 365) * (date.getUTCDate() + 172));

      // Строим полигон ночи: простой прямоугольник-«шапка»
      // В реальном проекте: вычисляем границу терминатора через формулу
      // sin(h) = sin(φ)sin(δ) + cos(φ)cos(δ)cos(H)
      const nightPolygon = this.buildNightPolygon(midnightLng, declination);

      L.polygon(nightPolygon, {
        color: 'transparent',
        fillColor: '#000011',
        fillOpacity: 0.45,
        className: 'night-overlay',
        interactive: false
      }).addTo(this.nightLayer);
    },

    // Упрощённый, но визуально корректный терминатор
    buildNightPolygon(centerLng, declination) {
      const points = [];
      const d2r = Math.PI / 180;
      const decl = declination * d2r;

      // Проходим по долготам, для каждой считаем широту терминатора
      for (let lng = -180; lng <= 180; lng += 5) {
        const H = (lng - centerLng) * d2r;       // часовой угол
        const lat = Math.atan(-Math.cos(H) / Math.tan(decl)) / d2r;
        points.push([Math.max(-90, Math.min(90, lat)), lng]);
      }

      // Замыкаем на северный/южный полюс (в зависимости от сезона)
      // Если δ > 0 (лето сев. полушария), ночь — на юге
      if (declination >= 0) {
        points.push([-90, 180]);
        points.push([-90, -180]);
      } else {
        points.push([90, 180]);
        points.push([90, -180]);
      }
      return points;
    }
  };

  // ─────────────────────────────────────────────────────
  // КАТАСТРОФЫ
  // ─────────────────────────────────────────────────────
  const DISASTERS = {
    fire:    { name: 'Лесной пожар',       color: '#e74c3c', radius: 60000,  season: ['summer', 'autumn'] },
    flood:   { name: 'Наводнение',         color: '#3498db', radius: 150000, season: ['spring', 'autumn'] },
    storm:   { name: 'Тропический шторм',  color: '#9b59b6', radius: 220000, season: ['summer', 'autumn'] },
    blizzard:{ name: 'Снежная буря',       color: '#85c1e9', radius: 180000, season: ['winter'] },
    tornado: { name: 'Торнадо',            color: '#7f8c8d', radius: 40000,  season: ['spring', 'summer'] }
  };

  const disasterEngine = {
    active: [],

    start() {
      setInterval(() => this.tick(), 1000);
    },

    tick() {
      // Проверка условий для спавна
      if (this.active.length >= CONFIG.maxActiveDisasters) return;
      if (Math.random() > CONFIG.disasterChance) return;

      const type = this.pickTypeForSeason(timeEngine.season);
      if (!type) return;

      const { lat, lng } = this.randomLandPoint();
      this.spawn(type, lat, lng);
    },

    pickTypeForSeason(season) {
      const available = Object.entries(DISASTERS)
        .filter(([, d]) => d.season.includes(season))
        .map(([k]) => k);
      if (!available.length) return null;
      return available[Math.floor(Math.random() * available.length)];
    },

    // Простая эвристика: точка должна быть на суше.
    // Проверяем, содержит ли countries-слой эту точку.
    randomLandPoint() {
      for (let i = 0; i < 20; i++) {
        const lat = (Math.random() * 140) - 70;
        const lng = (Math.random() * 360) - 180;
        if (this.isOnLand(lat, lng)) return { lat, lng };
      }
      return { lat: 0, lng: 0 };
    },

    isOnLand(lat, lng) {
      const countries = window.loadedLayers && window.loadedLayers.countries;
      if (!countries) return true; // fallback: считаем, что суша
      let found = false;
      countries.eachLayer(layer => {
        if (found) return;
        if (layer.getBounds && layer.getBounds().contains([lat, lng])) {
          // Грубая проверка через bounding box, но для симулятора достаточно
          found = true;
        }
      });
      return found;
    },

    spawn(type, lat, lng) {
      const cfg = DISASTERS[type];
      const circle = L.circle([lat, lng], {
        radius: cfg.radius,
        color: cfg.color,
        fillColor: cfg.color,
        fillOpacity: 0.45,
        weight: 2,
        className: 'disaster-pulse'
      }).addTo(MAP);

      // Подпись
      circle.bindPopup(`
        <strong>${cfg.name}</strong><br>
        Координаты: ${lat.toFixed(2)}, ${lng.toFixed(2)}<br>
        Начало: ${timeEngine.current.toISOString().slice(11, 16)} UTC
      `);

      const event = { type, name: cfg.name, lat, lng, circle, startedAt: Date.now() };
      this.active.push(event);

      // Автоудаление
      setTimeout(() => this.despawn(event), CONFIG.disasterDurationMs);

      this.log(`Спавн: ${cfg.name} @ ${lat.toFixed(2)}, ${lng.toFixed(2)}`);
    },

    despawn(event) {
      if (MAP.hasLayer(event.circle)) MAP.removeLayer(event.circle);
      this.active = this.active.filter(e => e !== event);
      this.log(`Завершено: ${event.name}`);
    },

    log(msg) {
      console.log(`[DISASTER ${new Date().toISOString().slice(11, 19)}] ${msg}`);
    }
  };

  // ─────────────────────────────────────────────────────
  // UI-КОНТРОЛЫ ПОГОДЫ
  // ─────────────────────────────────────────────────────
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
    if (btnSpawn) {
      btnSpawn.addEventListener('click', () => {
        const type = disasterEngine.pickTypeForSeason(timeEngine.season);
        if (!type) {
          alert('Для текущего сезона нет доступных катастроф.');
          return;
        }
        const { lat, lng } = disasterEngine.randomLandPoint();
        disasterEngine.spawn(type, lat, lng);
      });
    }
  }

  // ─────────────────────────────────────────────────────
  // СТАРТ
  // ─────────────────────────────────────────────────────
  function init() {
    bindUI();
    timeEngine.start();
    disasterEngine.start();
    console.log('[weather.js] Движок природы запущен.');
  }

  // Ждём, пока Leaflet и карта полностью инициализируются
  if (MAP._loaded) {
    init();
  } else {
    MAP.whenReady(init);
  }

  // Экспорт для других модулей (например, будущего слоя климата)
  window.NatureEngine = { timeEngine, disasterEngine, environment, DISASTERS, CONFIG };
})();
