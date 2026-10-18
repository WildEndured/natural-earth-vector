// ═══════════════════════════════════════════════════════
// terrain.js — Снежный покров и влажность почвы
// Оставляет «следы» погоды на карте и влияет на события
// Зависимости: window.map, window.Atmosphere, window.PrecipitationEngine
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const MAP = window.map;
  if (!MAP) {
    console.error('[terrain.js] window.map не найден.');
    return;
  }

  const CONFIG = {
    gridStepDeg: 4,              // размер клетки — 4° × 4°
    snowAccumulatePerTick: 0.5,  // см за тик в снежных условиях
    snowMeltPerTick: 0.8,        // см тает за тик в тёплых условиях
    wetDurationMs: 180000,       // 3 минуты влажность держится
    dampDurationMs: 120000,
    updateIntervalMs: 2000,
    maxSnowCm: 80
  };

  // ─────────────────────────────────────────────────────
  // СЕТКА «СЛЕДОВ»
  // Ключ: "lat_lng" (округлённые), значение: { lat, lng, snow, wet, updated }
  // ─────────────────────────────────────────────────────
  const grid = new Map();

  function keyOf(lat, lng) {
    const la = Math.round(lat / CONFIG.gridStepDeg) * CONFIG.gridStepDeg;
    const ln = Math.round(lng / CONFIG.gridStepDeg) * CONFIG.gridStepDeg;
    return la.toFixed(2) + '_' + ln.toFixed(2);
  }

  function getCell(lat, lng) {
    const key = keyOf(lat, lng);
    let cell = grid.get(key);
    if (!cell) {
      const la = Math.round(lat / CONFIG.gridStepDeg) * CONFIG.gridStepDeg;
      const ln = Math.round(lng / CONFIG.gridStepDeg) * CONFIG.gridStepDeg;
      cell = { lat: la, lng: ln, snow: 0, wet: 0, updated: Date.now() };
      grid.set(key, cell);
    }
    return cell;
  }

  // ─────────────────────────────────────────────────────
  // СЛОИ
  // ─────────────────────────────────────────────────────
  const TerrainEngine = {
    snowLayer: null,
    wetLayer: null,
    visible: { snow: true, wet: false },

    init() {
      if (!this.snowLayer) {
        this.snowLayer = L.layerGroup().addTo(MAP);
      }
      if (!this.wetLayer) {
        this.wetLayer = L.layerGroup();
      }
    },

    start() {
      this.init();
      setInterval(() => this.tick(), CONFIG.updateIntervalMs);
    },

    tick() {
      this.updateCells();
      this.render();
    },

    // ───────────────────────────────────────────────────
    // Обновление данных в клетках
    // ───────────────────────────────────────────────────
    updateCells() {
      const te = window.NatureEngine && window.NatureEngine.timeEngine;
      const date = te ? te.current : new Date();
      const season = te ? te.season : 'summer';

      const now = Date.now();

      // 1. Снег: накапливается там, где T<0 и идут осадки
      // 2. Снег тает там, где T>5
      grid.forEach(cell => {
        if (!window.Atmosphere) return;

        const temp = window.Atmosphere.TemperatureModel.getTemp(
          cell.lat, cell.lng, date, season
        );

        // Прирост снега
        const precip = window.PrecipitationEngine
          ? window.PrecipitationEngine.getPrecipAt(cell.lat, cell.lng)
          : null;

        if (temp < 0 && precip === 'Снег') {
          cell.snow = Math.min(CONFIG.maxSnowCm, cell.snow + CONFIG.snowAccumulatePerTick);
        } else if (temp > 5 && cell.snow > 0) {
          cell.snow = Math.max(0, cell.snow - CONFIG.snowMeltPerTick);
        } else if (temp > 0 && temp <= 5 && cell.snow > 0) {
          cell.snow = Math.max(0, cell.snow - CONFIG.snowMeltPerTick * 0.3);
        }

        // Влажность почвы
        if (precip === 'Дождь') {
          cell.wet = 2; // «мокро»
          cell.updated = now;
        } else if (cell.wet > 0) {
          const elapsed = now - cell.updated;
          if (elapsed > CONFIG.wetDurationMs) {
            cell.wet = 1; // «влажно»
            cell.updated = now;
          }
          if (elapsed > CONFIG.wetDurationMs + CONFIG.dampDurationMs) {
            cell.wet = 0;
          }
        }
      });
    },

    // ───────────────────────────────────────────────────
    // Отрисовка
    // ───────────────────────────────────────────────────
    render() {
      if (!this.snowLayer || !this.wetLayer) return;

      // Снег
      this.snowLayer.clearLayers();
      if (this.visible.snow) {
        grid.forEach(cell => {
          if (cell.snow > 0.5) {
            const half = CONFIG.gridStepDeg / 2;
            const opacity = Math.min(0.75, 0.15 + cell.snow / 100);
            const rect = L.rectangle(
              [[cell.lat - half, cell.lng - half], [cell.lat + half, cell.lng + half]],
              {
                className: 'snow-cover',
                color: 'transparent',
                fillColor: '#ffffff',
                fillOpacity: opacity,
                interactive: false
              }
            );
            this.snowLayer.addLayer(rect);
          }
        });
      }

      // Влажность
      this.wetLayer.clearLayers();
      if (this.visible.wet) {
        grid.forEach(cell => {
          if (cell.wet > 0) {
            const half = CONFIG.gridStepDeg / 2;
            const cls = cell.wet === 2 ? 'soil-wet' : 'soil-damp';
            const rect = L.rectangle(
              [[cell.lat - half, cell.lng - half], [cell.lat + half, cell.lng + half]],
              {
                className: cls,
                color: 'transparent',
                interactive: false
              }
            );
            this.wetLayer.addLayer(rect);
          }
        });
      }
    },

    // ───────────────────────────────────────────────────
    // Публичный API
    // ───────────────────────────────────────────────────
    getSnowAt(lat, lng) {
      return getCell(lat, lng).snow;
    },

    getSoilAt(lat, lng) {
      const c = getCell(lat, lng);
      if (c.wet === 2) return 'Мокрая';
      if (c.wet === 1) return 'Влажная';
      return 'Сухая';
    },

    isWetAt(lat, lng) {
      return getCell(lat, lng).wet > 0;
    },

    // Пожар не начинается на влажной почве
    canStartFire(lat, lng) {
      const cell = getCell(lat, lng);
      if (cell.wet > 0) return false;
      if (cell.snow > 5) return false;
      return true;
    },

    // Замедление для юнитов (когда появятся)
    getMovementPenalty(lat, lng) {
      const cell = getCell(lat, lng);
      let penalty = 1.0;
      if (cell.snow > 0) penalty += Math.min(1.5, cell.snow / 40);
      if (cell.wet === 2) penalty += 0.3;
      else if (cell.wet === 1) penalty += 0.15;
      return penalty;
    },

    setVisible(kind, v) {
      this.visible[kind] = v;
      this.init();
      if (kind === 'snow') {
        if (v) this.snowLayer.addTo(MAP);
        else MAP.removeLayer(this.snowLayer);
      } else if (kind === 'wet') {
        if (v) this.wetLayer.addTo(MAP);
        else MAP.removeLayer(this.wetLayer);
      }
      this.render();
    },

    // Для отладки
    stats() {
      let snowCells = 0, wetCells = 0, totalSnow = 0;
      grid.forEach(c => {
        if (c.snow > 0.5) { snowCells++; totalSnow += c.snow; }
        if (c.wet > 0) wetCells++;
      });
      return { snowCells, wetCells, avgSnow: snowCells ? totalSnow / snowCells : 0 };
    }
  };

  window.TerrainEngine = TerrainEngine;
  console.log('[terrain.js] Модуль поверхности загружен.');

  if (MAP._loaded) TerrainEngine.start();
  else MAP.whenReady(() => TerrainEngine.start());
})();
