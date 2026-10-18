// ═══════════════════════════════════════════════════════
// precipitation.js — Осадки и облачность
// Зависимости: window.map, window.Atmosphere
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const MAP = window.map;
  if (!MAP) {
    console.error('[precipitation.js] window.map не найден.');
    return;
  }

  const CONFIG = {
    updateIntervalMs: 2000,
    cloudsPerCyclone: 3,
    precipMarkersPerCyclone: 6,
    cloudRadiusKm: 120,
    precipRadiusKm: 90,
    spreadDeg: 0.8
  };

  // ─────────────────────────────────────────────────────
  // ОСАДКИ И ОБЛАКА
  // ─────────────────────────────────────────────────────
  const PrecipitationEngine = {
    cloudLayer: null,
    precipLayer: null,
    active: [],          // { cyclone, clouds[], precipMarkers[] }

    init() {
      if (!this.cloudLayer) this.cloudLayer = L.layerGroup().addTo(MAP);
      if (!this.precipLayer) this.precipLayer = L.layerGroup().addTo(MAP);
    },

    start() {
      this.init();
      setInterval(() => this.tick(), CONFIG.updateIntervalMs);
    },

    tick() {
      this.init();
      const cyclones = (window.Atmosphere && window.Atmosphere.CycloneEngine)
        ? window.Atmosphere.CycloneEngine.active
        : [];

      // Удаляем «потерянные» системы
      this.active = this.active.filter(sys => {
        const stillAlive = cyclones.includes(sys.cyclone);
        if (!stillAlive) this.destroy(sys);
        return stillAlive;
      });

      // Создаём системы для новых циклонов
      cyclones.forEach(c => {
        const exists = this.active.find(sys => sys.cyclone === c);
        if (!exists) this.createFor(c);
      });

      // Обновляем позиции
      this.active.forEach(sys => this.updatePositions(sys));
    },

    createFor(cyclone) {
      const sys = { cyclone, clouds: [], precipMarkers: [] };

      // Облака — вокруг циклона
      for (let i = 0; i < CONFIG.cloudsPerCyclone; i++) {
        const offset = this.randomOffset(CONFIG.spreadDeg);
        const lat = cyclone.lat + offset.lat;
        const lng = cyclone.lng + offset.lng;

        const cloud = L.circle([lat, lng], {
          radius: CONFIG.cloudRadiusKm * 1000,
          className: 'cloud-circle',
          interactive: false
        }).addTo(this.cloudLayer);

        sys.clouds.push({ layer: cloud, offset });
      }

      // Осадки — в зависимости от температуры
      const temp = this.getTempAt(cyclone.lat, cyclone.lng);
      const isSnow = temp < 0;

      for (let i = 0; i < CONFIG.precipMarkersPerCyclone; i++) {
        const offset = this.randomOffset(CONFIG.spreadDeg * 0.8);
        const lat = cyclone.lat + offset.lat;
        const lng = cyclone.lng + offset.lng;

        const icon = L.divIcon({
          className: 'precip-marker',
          html: isSnow ? '❄' : '💧',
          iconSize: [14, 14]
        });

        const marker = L.marker([lat, lng], {
          icon, interactive: false
        }).addTo(this.precipLayer);

        sys.precipMarkers.push({ layer: marker, offset, isSnow });
      }

      this.active.push(sys);
      console.log(
        `[PRECIP] Система для ${cyclone.name}: ${isSnow ? 'снег' : 'дождь'} (T=${temp.toFixed(1)}°C)`
      );
    },

    updatePositions(sys) {
      const c = sys.cyclone;

      sys.clouds.forEach(cl => {
        cl.layer.setLatLng([c.lat + cl.offset.lat, c.lng + cl.offset.lng]);
      });

      // Периодически пересчитываем тип осадков
      if (Math.random() < 0.3) {
        const temp = this.getTempAt(c.lat, c.lng);
        const isSnow = temp < 0;
        sys.precipMarkers.forEach(pm => {
          if (pm.isSnow !== isSnow) {
            pm.isSnow = isSnow;
            const icon = L.divIcon({
              className: 'precip-marker',
              html: isSnow ? '❄' : '💧',
              iconSize: [14, 14]
            });
            pm.layer.setIcon(icon);
          }
        });
      }

      sys.precipMarkers.forEach(pm => {
        pm.layer.setLatLng([c.lat + pm.offset.lat, c.lng + pm.offset.lng]);
      });
    },

    randomOffset(maxDeg) {
      return {
        lat: (Math.random() - 0.5) * 2 * maxDeg,
        lng: (Math.random() - 0.5) * 2 * maxDeg
      };
    },

    getTempAt(lat, lng) {
      if (!window.Atmosphere) return 20;
      const te = window.NatureEngine && window.NatureEngine.timeEngine;
      if (!te) return 20;
      return window.Atmosphere.TemperatureModel.getTemp(
        lat, lng, te.current, te.season
      );
    },

    destroy(sys) {
      sys.clouds.forEach(cl => this.cloudLayer.removeLayer(cl.layer));
      sys.precipMarkers.forEach(pm => this.precipLayer.removeLayer(pm.layer));
      console.log(`[PRECIP] Система ${sys.cyclone.name} расформирована`);
    },

    // Публичный API для HUD
    getPrecipAt(lat, lng) {
      // Проверяем, есть ли система рядом
      for (const sys of this.active) {
        const c = sys.cyclone;
        const dist = Math.sqrt(
          Math.pow(lat - c.lat, 2) + Math.pow(lng - c.lng, 2)
        );
        if (dist < CONFIG.spreadDeg * 2) {
          const temp = this.getTempAt(lat, lng);
          return temp < 0 ? 'Снег' : 'Дождь';
        }
      }
      return null;
    },

    setVisible(v) {
      if (!this.cloudLayer) return;
      if (v) {
        this.cloudLayer.addTo(MAP);
        this.precipLayer.addTo(MAP);
      } else {
        MAP.removeLayer(this.cloudLayer);
        MAP.removeLayer(this.precipLayer);
      }
    }
  };

  window.PrecipitationEngine = PrecipitationEngine;
  console.log('[precipitation.js] Модуль осадков загружен.');

  if (MAP._loaded) PrecipitationEngine.start();
  else MAP.whenReady(() => PrecipitationEngine.start());
})();
