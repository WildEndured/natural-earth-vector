// ═══════════════════════════════════════════════════════
// climate.js — Климатические зоны и биомы
// Определяет, к какому биому относится точка на карте,
// и позволяет фильтровать катастрофы по географии.
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────
  // СООТВЕТСТВИЕ БИОМОВ И ТИПОВ КАТАСТРОФ
  // ─────────────────────────────────────────────────────
  // Ключи — как в FEATURECLA у Natural Earth
  const BIOME_COMPATIBILITY = {
    // Лесные биомы — пожары
    'Forest':          { fire: true, flood: true, storm: true, blizzard: false, tornado: true },
    'Boreal forest':   { fire: true, flood: false, storm: false, blizzard: true, tornado: false },
    'Tropical forest': { fire: false, flood: true, storm: true, blizzard: false, tornado: false },
    'Dry forest':      { fire: true, flood: false, storm: false, blizzard: false, tornado: false },
    'Woodland':        { fire: true, flood: false, storm: true, blizzard: false, tornado: true },

    // Травы и саванны
    'Grassland':       { fire: true, flood: false, storm: true, blizzard: true, tornado: true },
    'Savanna':         { fire: true, flood: false, storm: true, blizzard: false, tornado: false },
    'Scrubland':       { fire: true, flood: false, storm: false, blizzard: false, tornado: false },
    'Shrubland':       { fire: true, flood: false, storm: false, blizzard: false, tornado: false },

    // Пустыни — почти ничего
    'Desert':          { fire: false, flood: false, storm: false, blizzard: false, tornado: false },
    'Semi-desert':     { fire: false, flood: false, storm: true, blizzard: false, tornado: false },
    'Polar desert':    { fire: false, flood: false, storm: false, blizzard: true, tornado: false },

    // Холод
    'Tundra':          { fire: false, flood: false, storm: false, blizzard: true, tornado: false },
    'Ice':             { fire: false, flood: false, storm: false, blizzard: true, tornado: false },
    'Glacier':         { fire: false, flood: false, storm: false, blizzard: true, tornado: false },

    // Горы
    'Mountain':        { fire: true, flood: false, storm: true, blizzard: true, tornado: false },
    'Alpine':          { fire: false, flood: false, storm: true, blizzard: true, tornado: false },

    // Влажные зоны
    'Wetland':         { fire: false, flood: true, storm: true, blizzard: false, tornado: false },
    'Marsh':           { fire: false, flood: true, storm: true, blizzard: false, tornado: false },

    // По умолчанию — всё разрешено (если биом неизвестен)
    '_default':        { fire: true, flood: true, storm: true, blizzard: true, tornado: true }
  };

  // ─────────────────────────────────────────────────────
  // ОСНОВНОЙ МОДУЛЬ
  // ─────────────────────────────────────────────────────
  const ClimateEngine = {
    biomesLayer: null,     // L.geoJSON с полигонами биомов
    elevationLayer: null,  // L.geoJSON с точками высот
    biomesData: [],        // Упрощённый индекс: [{clazz, bounds, layer}]
    loaded: false,

    // Регистрация слоёв (вызывается из script.js после загрузки)
    register(biomesLayer, elevationLayer) {
      this.biomesLayer = biomesLayer;
      this.elevationLayer = elevationLayer;

      // Строим индекс по bounding box для быстрого поиска
      if (biomesLayer) {
        biomesLayer.eachLayer(layer => {
          const p = layer.feature && layer.feature.properties;
          if (!p) return;
          const clazz = p.FEATURECLA || p.featurecla || 'Unknown';
          this.biomesData.push({
            clazz,
            bounds: layer.getBounds(),
            layer
          });
        });
      }

      this.loaded = true;
      console.log(`[climate.js] Зарегистрировано биомов: ${this.biomesData.length}`);
    },

    // Определить биом по координатам
    getBiomeAt(lat, lng) {
      if (!this.biomesData.length) return 'Unknown';

      const point = L.latLng(lat, lng);

      // Ищем первый биом, чей bounding box содержит точку
      // (быстрее, чем точная геометрическая проверка, для симуляции достаточно)
      for (const biome of this.biomesData) {
        if (biome.bounds.contains(point)) {
          return biome.clazz;
        }
      }
      return 'Unknown';
    },

    // Проверить: допустима ли катастрофа в этой точке
    canDisasterHappen(type, lat, lng) {
      const biome = this.getBiomeAt(lat, lng);

      // Если данных нет — разрешаем всё (fallback)
      if (!this.loaded) return true;

      // Нормализуем тип (например, 'tropical storm' → 'storm')
      const normalizedType =
        type === 'tropical_storm' ? 'storm' : type;

      const rules = BIOME_COMPATIBILITY[biome] || BIOME_COMPATIBILITY._default;
      return rules[normalizedType] === true;
    },

    // Получить все допустимые типы катастроф в точке
    getValidDisasters(lat, lng) {
      const biome = this.getBiomeAt(lat, lng);
      const rules = BIOME_COMPATIBILITY[biome] || BIOME_COMPATIBILITY._default;
      return Object.entries(rules)
        .filter(([, allowed]) => allowed)
        .map(([type]) => type);
    },

    // Найти ближайшую точку с высотой (для горных катастроф)
    getElevationAt(lat, lng) {
      if (!this.elevationLayer) return null;
      let nearest = null;
      let minDist = Infinity;
      const target = L.latLng(lat, lng);

      this.elevationLayer.eachLayer(layer => {
        if (!layer.getLatLng) return;
        const d = target.distanceTo(layer.getLatLng());
        if (d < minDist) {
          minDist = d;
          nearest = layer.feature.properties;
        }
      });

      return nearest;
    }
  };

  // Экспорт
  window.ClimateEngine = ClimateEngine;
  console.log('[climate.js] Модуль климата загружен.');
})();
