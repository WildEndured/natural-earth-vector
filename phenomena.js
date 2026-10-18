// ═══════════════════════════════════════════════════════
// phenomena.js — Молнии, туман, дым, видимость
// Зависимости: window.map, window.Atmosphere,
//              window.PrecipitationEngine, window.TerrainEngine
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const MAP = window.map;
  if (!MAP) {
    console.error('[phenomena.js] window.map не найден.');
    return;
  }

  const CONFIG = {
    updateIntervalMs: 1500,
    lightningChance: 0.35,       // шанс молнии за тик при грозе
    lightningDurationMs: 180,
    fogChance: 0.4,              // шанс появления тумана
    fogLifeMs: 60000,
    fogRadiusKm: 90,
    smokeDriftDeg: 0.15,         // смещение дыма за тик
    smokeLifeMs: 45000,
    smokeRadiusKm: 50
  };

  // ─────────────────────────────────────────────────────
  // МОЛНИИ
  // ─────────────────────────────────────────────────────
  const LightningEngine = {
    layer: null,
    flashEl: null,

    init() {
      if (!this.layer) this.layer = L.layerGroup().addTo(MAP);
      if (!this.flashEl) {
        this.flashEl = document.createElement('div');
        this.flashEl.className = 'lightning-flash';
        document.body.appendChild(this.flashEl);
      }
    },

    // Возможна ли гроза: лето/осень + циклон + дождь
    canThunderAt(lat, lng) {
      if (!window.PrecipitationEngine) return false;
      const p = window.PrecipitationEngine.getPrecipAt(lat, lng);
      if (p !== 'Дождь') return false;
      if (!window.Atmosphere) return false;
      const te = window.NatureEngine && window.NatureEngine.timeEngine;
      if (!te) return false;
      const temp = window.Atmosphere.TemperatureModel.getTemp(
        lat, lng, te.current, te.season
      );
      return temp > 8; // гроза только при тёплом дожде
    },

    maybeStrike() {
      if (!window.Atmosphere) return;
      const cyclones = window.Atmosphere.CycloneEngine.active;
      if (!cyclones.length) return;

      // Берём случайный циклон
      const c = cyclones[Math.floor(Math.random() * cyclones.length)];
      if (!this.canThunderAt(c.lat, c.lng)) return;

      // Внутри циклона — случайная точка
      const lat = c.lat + (Math.random() - 0.5) * 1.5;
      const lng = c.lng + (Math.random() - 0.5) * 1.5;

      this.strike(lat, lng);
    },

    strike(lat, lng) {
      this.init();

      // Зигзаг: 4-6 точек
      const points = [[lat, lng]];
      let curLat = lat, curLng = lng;
      const segments = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < segments; i++) {
        curLat -= 0.15 + Math.random() * 0.15;
        curLng += (Math.random() - 0.5) * 0.3;
        points.push([curLat, curLng]);
      }

      const line = L.polyline(points, {
        color: '#fff8c4',
        weight: 2.5,
        opacity: 1,
        className: 'lightning',
        interactive: false
      }).addTo(this.layer);

      // Вспышка
      this.flashEl.classList.add('active');
      setTimeout(() => this.flashEl.classList.remove('active'),
        CONFIG.lightningDurationMs);

      // Удаление
      setTimeout(() => this.layer.removeLayer(line), CONFIG.lightningDurationMs);
    }
  };

  // ─────────────────────────────────────────────────────
  // ТУМАН
  // ─────────────────────────────────────────────────────
  const FogEngine = {
    layer: null,
    active: [],

    init() {
      if (!this.layer) this.layer = L.layerGroup().addTo(MAP);
    },

    // Туман появляется утром/вечером над влажной почвой
    canFogAt(lat, lng) {
      if (!window.TerrainEngine) return false;
      if (!window.TerrainEngine.isWetAt(lat, lng)) return false;
      if (!window.NatureEngine || !window.NatureEngine.timeEngine) return false;

      const date = window.NatureEngine.timeEngine.current;
      const hour = date.getUTCHours() + lng / 15;
      const local = ((hour % 24) + 24) % 24;

      // Туман только в утренние/вечерние часы
      return (local >= 4 && local <= 9) || (local >= 18 && local <= 22);
    },

    maybeSpawn() {
      if (!window.TerrainEngine) return;

      const lat = (Math.random() * 140) - 70;
      const lng = (Math.random() * 360) - 180;
      if (!this.canFogAt(lat, lng)) return;

      const circle = L.circle([lat, lng], {
        radius: CONFIG.fogRadiusKm * 1000,
        className: 'fog-circle',
        interactive: false
      }).addTo(this.layer);

      const fog = { layer: circle, bornAt: Date.now(), lat, lng };
      this.active.push(fog);

      setTimeout(() => this.despawn(fog), CONFIG.fogLifeMs);
    },

    despawn(fog) {
      if (this.layer) this.layer.removeLayer(fog.layer);
      this.active = this.active.filter(f => f !== fog);
    },

    getFogAt(lat, lng) {
      for (const fog of this.active) {
        const dist = Math.sqrt(
          Math.pow(lat - fog.lat, 2) + Math.pow(lng - fog.lng, 2)
        );
        if (dist * 111 < CONFIG.fogRadiusKm) return true;
      }
      return false;
    },

    setVisible(v) {
      if (!this.layer) return;
      if (v) this.layer.addTo(MAP);
      else MAP.removeLayer(this.layer);
    }
  };

  // ─────────────────────────────────────────────────────
  // ДЫМ ОТ ПОЖАРОВ
  // ─────────────────────────────────────────────────────
  const SmokeEngine = {
    layer: null,
    active: [],

    init() {
      if (!this.layer) this.layer = L.layerGroup().addTo(MAP);
    },

    tick() {
      this.init();
      if (!window.NatureEngine || !window.NatureEngine.disasterEngine) return;

      const fires = window.NatureEngine.disasterEngine.active
        .filter(e => e.type === 'fire');

      // Для каждого пожара — дым
      fires.forEach(fire => {
        const exists = this.active.find(s => s.fire === fire);
        if (!exists) this.spawnFor(fire);
      });

      // Удаляем «потерянные»
      this.active = this.active.filter(s => {
        const alive = fires.includes(s.fire) && Date.now() - s.bornAt < CONFIG.smokeLifeMs;
        if (!alive) this.layer.removeLayer(s.layer);
        return alive;
      });

      // Двигаем по ветру
      this.active.forEach(s => {
        const wind = window.Atmosphere
          ? window.Atmosphere.WindModel.getWind(s.lat, s.lng, new Date())
          : { dir: 270 };

        const rad = (wind.dir + 180) * Math.PI / 180;
        s.lat += Math.cos(rad) * CONFIG.smokeDriftDeg;
        s.lng += Math.sin(rad) * CONFIG.smokeDriftDeg;
        s.layer.setLatLng([s.lat, s.lng]);
      });
    },

    spawnFor(fire) {
      // 3-4 «клуба» дыма с нарастающим радиусом
      const puffs = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < puffs; i++) {
        const offset = (i - (puffs - 1) / 2) * 0.3;
        const lat = fire.lat + offset * 0.5;
        const lng = fire.lng + offset * 0.5;

        const circle = L.circle([lat, lng], {
          radius: CONFIG.smokeRadiusKm * 1000 * (0.7 + i * 0.2),
          className: 'smoke-circle',
          interactive: false
        }).addTo(this.layer);

        this.active.push({
          fire, layer: circle, lat, lng, bornAt: Date.now()
        });
      }
    }
  };

  // ─────────────────────────────────────────────────────
  // ВИДИМОСТЬ
  // ─────────────────────────────────────────────────────
  const Visibility = {
    // Возвращает видимость в км
    getAt(lat, lng) {
      let vis = 25; // базовая — 25 км

      // Осадки
      if (window.PrecipitationEngine) {
        const p = window.PrecipitationEngine.getPrecipAt(lat, lng);
        if (p === 'Дождь') vis = Math.min(vis, 8);
        else if (p === 'Снег') vis = Math.min(vis, 5);
      }

      // Туман
      if (FogEngine.getFogAt(lat, lng)) vis = Math.min(vis, 1.5);

      // Дым (в радиусе)
      for (const s of SmokeEngine.active) {
        const dist = Math.sqrt(
          Math.pow(lat - s.lat, 2) + Math.pow(lng - s.lng, 2)
        ) * 111;
        if (dist < CONFIG.smokeRadiusKm) {
          vis = Math.min(vis, 3);
        }
      }

      // Ночь
      if (window.NatureEngine && window.NatureEngine.timeEngine) {
        const te = window.NatureEngine.timeEngine;
        const utcHours = te.current.getUTCHours() + te.current.getUTCMinutes() / 60;
        const local = ((utcHours + lng / 15) % 24 + 24) % 24;
        const isNight = local < 6 || local > 20;
        if (isNight) vis = Math.min(vis, 12);
      }

      // Снежный покров сильно снижает видимость при ветре
      if (window.TerrainEngine) {
        const snow = window.TerrainEngine.getSnowAt(lat, lng);
        if (snow > 20 && window.Atmosphere) {
          const wind = window.Atmosphere.WindModel.getWind(lat, lng, new Date());
          if (wind.speed > 12) vis = Math.min(vis, 2); // метель
        }
      }

      return Math.max(0.5, vis);
    },

    getLabel(vis) {
      if (vis >= 20) return 'Отличная';
      if (vis >= 10) return 'Хорошая';
      if (vis >= 5)  return 'Средняя';
      if (vis >= 2)  return 'Плохая';
      return 'Критическая';
    }
  };

  // ─────────────────────────────────────────────────────
  // ГЛАВНЫЙ ОБЪЕКТ
  // ─────────────────────────────────────────────────────
  const PhenomenaEngine = {
    CONFIG, LightningEngine, FogEngine, SmokeEngine, Visibility,

    start() {
      LightningEngine.init();
      FogEngine.init();
      SmokeEngine.init();

      setInterval(() => this.tick(), CONFIG.updateIntervalMs);
      console.log('[phenomena.js] Модуль явлений запущен.');
    },

    tick() {
      // Молнии
      if (Math.random() < CONFIG.lightningChance) {
        LightningEngine.maybeStrike();
      }
      // Туман
      if (Math.random() < CONFIG.fogChance * 0.3) {
        FogEngine.maybeSpawn();
      }
      // Дым
      SmokeEngine.tick();
    }
  };

  window.PhenomenaEngine = PhenomenaEngine;
  console.log('[phenomena.js] Модуль явлений загружен.');

  if (MAP._loaded) PhenomenaEngine.start();
  else MAP.whenReady(() => PhenomenaEngine.start());
})();
