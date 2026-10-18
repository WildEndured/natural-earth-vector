// ═══════════════════════════════════════════════════════
// atmosphere.js — Температура, ветер, движущиеся циклоны
// Зависимости: window.map, window.NatureEngine.timeEngine (если готов),
//              window.ClimateEngine (для высоты)
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const MAP = window.map;
  if (!MAP) {
    console.error('[atmosphere.js] window.map не найден.');
    return;
  }

  // ─────────────────────────────────────────────────────
  // КОНФИГ
  // ─────────────────────────────────────────────────────
  const CONFIG = {
    updateIntervalMs: 2000,      // как часто пересчитывать
    windGridStep: 15,            // шаг сетки ветра в градусах
    cycloneSpawnChance: 0.08,    // шанс рождения циклона за тик
    cycloneMaxActive: 4,
    cycloneLifeMs: 120000,       // 2 минуты жизни
    cycloneSpeedDeg: 0.3         // насколько смещается циклон за тик
  };

  // ─────────────────────────────────────────────────────
  // ТЕМПЕРАТУРА
  // ─────────────────────────────────────────────────────
  // Упрощённая модель:
  // T = base(широта) + seasonal(широта, сезон) + diurnal(час) - altitude * 0.0065
  const TemperatureModel = {
    // Базовая температура по широте (среднегодовая)
    getBaseTemp(lat) {
      const absLat = Math.abs(lat);
      if (absLat >= 80) return -20;
      if (absLat >= 60) return -5;
      if (absLat >= 40) return 12;
      if (absLat >= 20) return 24;
      return 28;
    },

    // Сезонное отклонение (в зависимости от полушария)
    getSeasonalOffset(lat, season) {
      const isNorth = lat >= 0;
      const seasonMap = {
        winter: -12, spring: -2, summer: +10, autumn: -2
      };
      const offset = seasonMap[season] || 0;
      return isNorth ? offset : -offset;
    },

    // Суточное отклонение: пик около 15:00 местного
    getDiurnalOffset(lat, lng, utcHours) {
      // Местное время: lng / 15 часов от UTC
      const localHour = (utcHours + lng / 15 + 24) % 24;
      // Пик в 15, минимум в 5
      const diurnal = Math.cos((localHour - 15) / 24 * 2 * Math.PI);
      return diurnal * 6;
    },

    // Итоговая температура в точке
    getTemp(lat, lng, date, season) {
      const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
      const base = this.getBaseTemp(lat);
      const seasonal = this.getSeasonalOffset(lat, season);
      const diurnal = this.getDiurnalOffset(lat, lng, utcHours);

      // Высота (если есть климатический движок)
      let altitude = 0;
      if (window.ClimateEngine) {
        const elev = window.ClimateEngine.getElevationAt(lat, lng);
        if (elev && elev.elevation) altitude = elev.elevation;
      }
      const altitudePenalty = altitude * 0.0065;

      return base + seasonal + diurnal - altitudePenalty;
    }
  };

  // ─────────────────────────────────────────────────────
  // ВЕТЕР
  // ─────────────────────────────────────────────────────
  const WindModel = {
    // Упрощённая модель: зональный поток (запад-восток) + пассаты у экватора
    getWind(lat, lng, date) {
      const absLat = Math.abs(lat);
      let dir, speed;

      if (absLat < 30) {
        // Пассаты: с востока на запад
        dir = 90; // в Leaflet: угол от севера по часовой
        speed = 8 + Math.random() * 4;
      } else if (absLat < 60) {
        // Западный перенос
        dir = 270;
        speed = 10 + Math.random() * 6;
      } else {
        // Полярные восточные
        dir = 90;
        speed = 6 + Math.random() * 4;
      }

      // Небольшие локальные колебания
      dir += (Math.random() - 0.5) * 30;
      speed += (Math.random() - 0.5) * 2;

      return { dir, speed: Math.max(0, speed) };
    },

    // Вернуть стрелку направления в градусах (0 = север)
    getArrowAngle(lat, lng, date) {
      const w = this.getWind(lat, lng, date);
      // Ветер "откуда дует", стрелка показывает "куда дует"
      return (w.dir + 180) % 360;
    }
  };

  // ─────────────────────────────────────────────────────
  // ЦИКЛОНЫ
  // ─────────────────────────────────────────────────────
  const CycloneEngine = {
    active: [],
    layerGroup: null,

    start() {
      if (!this.layerGroup) {
        this.layerGroup = L.layerGroup().addTo(MAP);
      }
      setInterval(() => this.tick(), CONFIG.updateIntervalMs);
    },

    tick() {
      // Двигаем существующие
      this.active.forEach(c => {
        const drift = WindModel.getWind(c.lat, c.lng, new Date());
        // Смещаем по ветру
        const rad = (drift.dir + 180) * Math.PI / 180;
        const step = CONFIG.cycloneSpeedDeg;
        c.lat += Math.cos(rad) * step;
        c.lng += Math.sin(rad) * step;

        // Ограничиваем широту
        c.lat = Math.max(-70, Math.min(70, c.lat));

        // Обновляем позицию маркера
        if (c.marker) c.marker.setLatLng([c.lat, c.lng]);

        // Проверяем смерть по времени
        if (Date.now() - c.bornAt > CONFIG.cycloneLifeMs) {
          this.despawn(c);
        }
      });

      // Рождаем новые
      if (this.active.length < CONFIG.cycloneMaxActive &&
          Math.random() < CONFIG.cycloneSpawnChance) {
        this.spawn();
      }
    },

    spawn() {
      // Циклоны рождаются в тропиках (5–25°) и идут к полюсам
      const isNorth = Math.random() > 0.5;
      const lat = (isNorth ? 1 : -1) * (8 + Math.random() * 17);
      const lng = (Math.random() * 360) - 180;

      const icon = L.divIcon({
        className: 'cyclone-marker',
        html: '🌀',
        iconSize: [28, 28]
      });

      const marker = L.marker([lat, lng], {
        icon,
        interactive: true
      }).addTo(this.layerGroup);

      marker.bindPopup(`
        <strong>Циклон</strong><br>
        Координаты: ${lat.toFixed(2)}, ${lng.toFixed(2)}<br>
        Скорость ветра: ~${(15 + Math.random() * 10).toFixed(0)} м/с
      `);

      const cyclone = {
        lat, lng, marker,
        bornAt: Date.now(),
        name: `C-${Date.now().toString().slice(-4)}`
      };
      this.active.push(cyclone);

      console.log(`[CYCLONE] Рождён ${cyclone.name} @ ${lat.toFixed(1)},${lng.toFixed(1)}`);
    },

    despawn(c) {
      if (c.marker) this.layerGroup.removeLayer(c.marker);
      this.active = this.active.filter(x => x !== c);
      console.log(`[CYCLONE] Умер ${c.name}`);
    }
  };

  // ─────────────────────────────────────────────────────
  // ВЕТРОВОЕ ПОЛЕ (визуализация стрелками)
  // ─────────────────────────────────────────────────────
  const WindField = {
    layer: null,
    visible: false,

    init() {
      if (!this.layer) {
        this.layer = L.layerGroup();
      }
    },

    render(date) {
      if (!this.visible) return;
      this.init();
      this.layer.clearLayers();

      for (let lat = -60; lat <= 60; lat += CONFIG.windGridStep) {
        for (let lng = -180; lng <= 180; lng += CONFIG.windGridStep) {
          const angle = WindModel.getArrowAngle(lat, lng, date);
          const wind = WindModel.getWind(lat, lng, date);

          // Стрелка длиной 3° (примерно)
          const len = 3 + wind.speed * 0.3;
          const rad = angle * Math.PI / 180;
          const dLat = Math.cos(rad) * len * 0.5;
          const dLng = Math.sin(rad) * len * 0.5;

          const arrow = L.polyline(
            [[lat - dLat, lng - dLng], [lat + dLat, lng + dLng]],
            {
              color: wind.speed > 15 ? '#8e44ad' : '#9b59b6',
              weight: wind.speed > 15 ? 2.2 : 1.5,
              opacity: 0.6,
              className: 'wind-arrow',
              interactive: false
            }
          );
          this.layer.addLayer(arrow);
        }
      }
    },

    setVisible(v) {
      this.visible = v;
      if (v) {
        this.layer.addTo(MAP);
      } else if (this.layer) {
        MAP.removeLayer(this.layer);
      }
    }
  };

  // ─────────────────────────────────────────────────────
  // ПУБЛИЧНЫЙ API
  // ─────────────────────────────────────────────────────
  const Atmosphere = {
    CONFIG,
    TemperatureModel,
    WindModel,
    CycloneEngine,
    WindField,

    // Точка данных для HUD
    getAtPoint(lat, lng, date, season) {
      return {
        temp: TemperatureModel.getTemp(lat, lng, date, season),
        wind: WindModel.getWind(lat, lng, date)
      };
    },

    start() {
      CycloneEngine.start();
      // Перерисовка поля ветра каждые N сек
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

  // Запуск после готовности карты
  if (MAP._loaded) Atmosphere.start();
  else MAP.whenReady(() => Atmosphere.start());
})();
