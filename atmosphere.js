// ═══════════════════════════════════════════════════════
// atmosphere.js — Температура, ветер, движущиеся циклоны
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const MAP = window.map;
  if (!MAP) {
    console.error('[atmosphere.js] window.map не найден.');
    return;
  }

  const CONFIG = {
    updateIntervalMs: 2000,
    windGridStep: 15,
    cycloneSpawnChance: 0.08,
    cycloneMaxActive: 4,
    cycloneLifeMs: 120000,
    cycloneSpeedDeg: 0.3
  };

  const TemperatureModel = {
    getBaseTemp(lat) {
      const a = Math.abs(lat);
      if (a >= 80) return -20;
      if (a >= 60) return -5;
      if (a >= 40) return 12;
      if (a >= 20) return 24;
      return 28;
    },
    getSeasonalOffset(lat, season) {
      const map = { winter: -12, spring: -2, summer: 10, autumn: -2 };
      const off = map[season] || 0;
      return lat >= 0 ? off : -off;
    },
    getDiurnalOffset(lat, lng, utcHours) {
      const localHour = (utcHours + lng / 15 + 24) % 24;
      return Math.cos((localHour - 15) / 24 * 2 * Math.PI) * 6;
    },
    getTemp(lat, lng, date, season) {
      const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
      let altitude = 0;
      if (window.ClimateEngine) {
        const elev = window.ClimateEngine.getElevationAt(lat, lng);
        if (elev && elev.elevation) altitude = elev.elevation;
      }
      return this.getBaseTemp(lat)
        + this.getSeasonalOffset(lat, season)
        + this.getDiurnalOffset(lat, lng, utcHours)
        - altitude * 0.0065;
    }
  };

  const WindModel = {
    getWind(lat, lng, date) {
      const a = Math.abs(lat);
      let dir, speed;
      if (a < 30)      { dir = 90;  speed = 8 + Math.random() * 4; }
      else if (a < 60) { dir = 270; speed = 10 + Math.random() * 6; }
      else             { dir = 90;  speed = 6 + Math.random() * 4; }
      dir += (Math.random() - 0.5) * 30;
      speed += (Math.random() - 0.5) * 2;
      return { dir, speed: Math.max(0, speed) };
    },
    getArrowAngle(lat, lng, date) {
      return (this.getWind(lat, lng, date).dir + 180) % 360;
    }
  };

  const CycloneEngine = {
    active: [],
    layerGroup: null,
    started: false,

    start() {
      if (this.started) return;
      this.started = true;
      if (!this.layerGroup) this.layerGroup = L.layerGroup().addTo(MAP);
      setInterval(() => this.tick(), CONFIG.updateIntervalMs);
    },

    tick() {
      this.active.forEach(c => {
        const drift = WindModel.getWind(c.lat, c.lng, new Date());
        const rad = (drift.dir + 180) * Math.PI / 180;
        c.lat += Math.cos(rad) * CONFIG.cycloneSpeedDeg;
        c.lng += Math.sin(rad) * CONFIG.cycloneSpeedDeg;
        c.lat = Math.max(-70, Math.min(70, c.lat));
        if (c.marker) c.marker.setLatLng([c.lat, c.lng]);
        if (Date.now() - c.bornAt > CONFIG.cycloneLifeMs) this.despawn(c);
      });

      if (this.active.length < CONFIG.cycloneMaxActive &&
          Math.random() < CONFIG.cycloneSpawnChance) {
        this.spawn();
      }
    },

    spawn() {
      const isNorth = Math.random() > 0.5;
      const lat = (isNorth ? 1 : -1) * (8 + Math.random() * 17);
      const lng = (Math.random() * 360) - 180;

      const icon = L.divIcon({
        className: 'cyclone-marker',
        html: '🌀',
        iconSize: [28, 28]
      });
      const marker = L.marker([lat, lng], { icon }).addTo(this.layerGroup);
      marker.bindPopup(`
        <strong>Циклон</strong><br>
        Координаты: ${lat.toFixed(2)}, ${lng.toFixed(2)}<br>
        Скорость ветра: ~${(15 + Math.random() * 10).toFixed(0)} м/с
      `);

      const cyclone = {
        lat, lng, marker, bornAt: Date.now(),
        name: `C-${Date.now().toString().slice(-4)}`
      };
      this.active.push(cyclone);
      console.log(`[CYCLONE] Рождён ${cyclone.name}`);
    },

    despawn(c) {
      if (c.marker) this.layerGroup.removeLayer(c.marker);
      this.active = this.active.filter(x => x !== c);
      console.log(`[CYCLONE] Умер ${c.name}`);
    }
  };

  const WindField = {
    layer: null,
    visible: false,

    init() { if (!this.layer) this.layer = L.layerGroup(); },

    render(date) {
      if (!this.visible) return;
      this.init();
      this.layer.clearLayers();
      for (let lat = -60; lat <= 60; lat += CONFIG.windGridStep) {
        for (let lng = -180; lng <= 180; lng += CONFIG.windGridStep) {
          const angle = WindModel.getArrowAngle(lat, lng, date);
          const wind = WindModel.getWind(lat, lng, date);
          const len = 3 + wind.speed * 0.3;
          const rad = angle * Math.PI / 180;
          const dLat = Math.cos(rad) * len * 0.5;
          const dLng = Math.sin(rad) * len * 0.5;
          this.layer.addLayer(L.polyline(
            [[lat - dLat, lng - dLng], [lat + dLat, lng + dLng]],
            { color: '#9b59b6', weight: 1.5, opacity: 0.6,
              className: 'wind-arrow', interactive: false }
          ));
        }
      }
    },

    setVisible(v) {
      this.visible = v;
      if (v) this.layer.addTo(MAP);
      else if (this.layer) MAP.removeLayer(this.layer);
    }
  };

  const Atmosphere = {
    CONFIG, TemperatureModel, WindModel, CycloneEngine, WindField,
    getAtPoint(lat, lng, date, season) {
      return {
        temp: TemperatureModel.getTemp(lat, lng, date, season),
        wind: WindModel.getWind(lat, lng, date)
      };
    },
    start() {
      CycloneEngine.start();
      setInterval(() => {
        const date = window.NatureEngine && window.NatureEngine.timeEngine
          ? window.NatureEngine.timeEngine.current
          : new Date();
        WindField.render(date);
      }, CONFIG.updateIntervalMs * 2);
    }
  };

  window.Atmosphere = Atmosphere;
  console.log('[atmosphere.js] Модуль атмосферы загружен.');

  if (MAP._loaded) Atmosphere.start();
  else MAP.whenReady(() => Atmosphere.start());
})();
