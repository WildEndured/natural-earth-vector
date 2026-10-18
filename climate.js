// ═══════════════════════════════════════════════════════
// climate.js — Климатические зоны и биомы
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const BIOME_COMPATIBILITY = {
    'Forest':          { fire: true,  flood: true,  storm: true,  blizzard: false, tornado: true  },
    'Boreal forest':   { fire: true,  flood: false, storm: false, blizzard: true,  tornado: false },
    'Tropical forest': { fire: false, flood: true,  storm: true,  blizzard: false, tornado: false },
    'Dry forest':      { fire: true,  flood: false, storm: false, blizzard: false, tornado: false },
    'Woodland':        { fire: true,  flood: false, storm: true,  blizzard: false, tornado: true  },
    'Grassland':       { fire: true,  flood: false, storm: true,  blizzard: true,  tornado: true  },
    'Savanna':         { fire: true,  flood: false, storm: true,  blizzard: false, tornado: false },
    'Scrubland':       { fire: true,  flood: false, storm: false, blizzard: false, tornado: false },
    'Shrubland':       { fire: true,  flood: false, storm: false, blizzard: false, tornado: false },
    'Desert':          { fire: false, flood: false, storm: false, blizzard: false, tornado: false },
    'Semi-desert':     { fire: false, flood: false, storm: true,  blizzard: false, tornado: false },
    'Polar desert':    { fire: false, flood: false, storm: false, blizzard: true,  tornado: false },
    'Tundra':          { fire: false, flood: false, storm: false, blizzard: true,  tornado: false },
    'Ice':             { fire: false, flood: false, storm: false, blizzard: true,  tornado: false },
    'Glacier':         { fire: false, flood: false, storm: false, blizzard: true,  tornado: false },
    'Mountain':        { fire: true,  flood: false, storm: true,  blizzard: true,  tornado: false },
    'Alpine':          { fire: false, flood: false, storm: true,  blizzard: true,  tornado: false },
    'Wetland':         { fire: false, flood: true,  storm: true,  blizzard: false, tornado: false },
    'Marsh':           { fire: false, flood: true,  storm: true,  blizzard: false, tornado: false },
    '_default':        { fire: true,  flood: true,  storm: true,  blizzard: true,  tornado: true  }
  };

  const ClimateEngine = {
    biomesLayer: null,
    elevationLayer: null,
    biomesData: [],
    loaded: false,

    register(biomesLayer, elevationLayer) {
      this.biomesLayer = biomesLayer;
      this.elevationLayer = elevationLayer;
      if (biomesLayer) {
        this.biomesData = [];
        biomesLayer.eachLayer(layer => {
          const p = layer.feature && layer.feature.properties;
          if (!p) return;
          const clazz = p.FEATURECLA || p.featurecla || 'Unknown';
          this.biomesData.push({ clazz, bounds: layer.getBounds(), layer });
        });
      }
      this.loaded = true;
      console.log(`[climate.js] Зарегистрировано биомов: ${this.biomesData.length}`);
    },

    getBiomeAt(lat, lng) {
      if (!this.biomesData.length) return 'Unknown';
      const point = L.latLng(lat, lng);
      for (const biome of this.biomesData) {
        if (biome.bounds.contains(point)) return biome.clazz;
      }
      return 'Unknown';
    },

    canDisasterHappen(type, lat, lng) {
      const biome = this.getBiomeAt(lat, lng);
      if (!this.loaded) return true;
      const normalizedType = type === 'tropical_storm' ? 'storm' : type;
      const rules = BIOME_COMPATIBILITY[biome] || BIOME_COMPATIBILITY._default;
      return rules[normalizedType] === true;
    },

    getValidDisasters(lat, lng) {
      const biome = this.getBiomeAt(lat, lng);
      const rules = BIOME_COMPATIBILITY[biome] || BIOME_COMPATIBILITY._default;
      return Object.entries(rules).filter(([, a]) => a).map(([t]) => t);
    },

    getElevationAt(lat, lng) {
      if (!this.elevationLayer) return null;
      let nearest = null;
      let minDist = Infinity;
      const target = L.latLng(lat, lng);
      this.elevationLayer.eachLayer(layer => {
        if (!layer.getLatLng) return;
        const d = target.distanceTo(layer.getLatLng());
        if (d < minDist) { minDist = d; nearest = layer.feature.properties; }
      });
      return nearest;
    }
  };

  window.ClimateEngine = ClimateEngine;
  console.log('[climate.js] Модуль климата загружен.');
})();
