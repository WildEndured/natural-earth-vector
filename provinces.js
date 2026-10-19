// ═══════════════════════════════════════════════════════
// provinces.js — Механика провинций (HoI4-style)
// Зависимости: window.map, window.loadedLayers, window.showToast
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const MAP = window.map;
  if (!MAP) { console.error('[provinces.js] window.map не найден.'); return; }

  const CONFIG = {
    file: 'ne_10m_admin_1_states_provinces.geojson',
    dir: 'geojson',
    // Детерминированный генератор ресурсов
    seed: 1337
  };

  // ─────────────────────────────────────────────────────
  // Детерминированный "рандом" на основе координат
  // ─────────────────────────────────────────────────────
  function hashCode(str) {
    let h = CONFIG.seed;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h);
  }

  function pseudoRandom(seedStr, salt = '') {
    const h = hashCode(seedStr + '|' + salt);
    return (h % 10000) / 10000;
  }

  // ─────────────────────────────────────────────────────
  // Генерация данных провинции
  // ─────────────────────────────────────────────────────
  function generateProvinceData(feature) {
    const p = feature.properties || {};
    const iso = p.iso_3166_2 || p.iso_a2 || p.adm1_code || p.name || 'XX';
    const name = p.name_ru || p.name || p.NAME || 'Неизвестный регион';
    const country = p.admin || p.adm0_name || p.ADMIN || '—';
    const countryIso = p.iso_a2 || p.adm0_a3 || '—';

    // Базовые ресурсы — из хеша координат + ISO
    const key = iso + '_' + name;
    const popEst = p.pop_est || p.population || 0;

    // Если есть население из GeoJSON — используем, иначе генерируем
    const population = popEst > 0 ? popEst :
      Math.floor(50000 + pseudoRandom(key, 'pop') * 5000000);

    // Ресурсы: 0-100
    const resources = {
      oil:    Math.floor(pseudoRandom(key, 'oil')    * 80 * (pseudoRandom(key, 'oil2') > 0.7 ? 1 : 0.2)),
      steel:  Math.floor(pseudoRandom(key, 'steel')  * 80),
      food:   Math.floor(pseudoRandom(key, 'food')   * 100),
      wood:   Math.floor(pseudoRandom(key, 'wood')   * 70)
    };

    // Промышленность, армия, укрепления
    const industry    = Math.floor(population / 500000) + Math.floor(pseudoRandom(key, 'ind') * 10);
    const garrison    = Math.floor(population / 1000000) + Math.floor(pseudoRandom(key, 'gar') * 5);
    const fortLevel   = Math.floor(pseudoRandom(key, 'fort') * 4);

    // Климат — из ClimateEngine, если доступен
    let biome = '—';
    if (window.ClimateEngine && window.ClimateEngine.loaded) {
      const center = feature._layerBounds || null;
      const c = center
        ? { lat: (center.getSouth() + center.getNorth()) / 2,
            lng: (center.getWest() + center.getEast()) / 2 }
        : { lat: 0, lng: 0 };
      biome = window.ClimateEngine.getBiomeAt(c.lat, c.lng);
    }

    return {
      iso, name, country, countryIso,
      population, industry, garrison, fortLevel,
      resources, biome,
      feature
    };
  }

  // ─────────────────────────────────────────────────────
  // Отрисовка панели провинции
  // ─────────────────────────────────────────────────────
  function fmtNum(v) {
    const n = Number(v);
    return isFinite(n) ? n.toLocaleString('ru-RU') : '—';
  }

  function renderProvincePanel(data) {
    const resources = data.resources || {};
    const resIcons = { oil: '⛽', steel: '⚙', food: '🌾', wood: '🪵' };
    const resLabels = { oil: 'Нефть', steel: 'Сталь', food: 'Продовольствие', wood: 'Дерево' };

    const resHtml = Object.entries(resources)
      .map(([k, v]) => `
        <div class="resource-item">
          <span><span class="resource-icon">${resIcons[k] || '•'}</span>${resLabels[k] || k}</span>
          <span class="resource-value">${v}</span>
        </div>
      `).join('');

    // Погода
    let weatherHtml = '';
    if (window.Atmosphere && window.NatureEngine && window.NatureEngine.timeEngine && data.feature._layer) {
      const te = window.NatureEngine.timeEngine;
      const bounds = data.feature._layer.getBounds();
      const c = bounds.getCenter();
      const atm = window.Atmosphere.getAtPoint(c.lat, c.lng, te.current, te.season);
      const precip = window.PrecipitationEngine ? window.PrecipitationEngine.getPrecipAt(c.lat, c.lng) : null;
      const snow = window.TerrainEngine ? window.TerrainEngine.getSnowAt(c.lat, c.lng) : 0;
      const soil = window.TerrainEngine ? window.TerrainEngine.getSoilAt(c.lat, c.lng) : '—';
      const vis = window.PhenomenaEngine ? window.PhenomenaEngine.Visibility.getAt(c.lat, c.lng) : 25;

      const tempClass = atm.temp < 0 ? 'bad' : atm.temp < 15 ? 'good' : atm.temp < 28 ? 'warn' : 'bad';

      weatherHtml = `
        <div class="country-section">
          <div class="country-section-title">Погода (центр)</div>
          <div class="info-row"><span class="key">Температура</span><span class="value ${tempClass}">${atm.temp.toFixed(1)}°C</span></div>
          <div class="info-row"><span class="key">Ветер</span><span class="value">${atm.wind.speed.toFixed(0)} м/с</span></div>
          ${precip ? `<div class="info-row"><span class="key">Осадки</span><span class="value">${precip}</span></div>` : ''}
          ${snow > 0.5 ? `<div class="info-row"><span class="key">Снег</span><span class="value">${snow.toFixed(1)} см</span></div>` : ''}
          <div class="info-row"><span class="key">Почва</span><span class="value">${soil}</span></div>
          <div class="info-row"><span class="key">Видимость</span><span class="value">${vis.toFixed(1)} км</span></div>
        </div>
      `;
    }

    // Заголовок панели
    document.getElementById('countryName').textContent = 'ПРОВИНЦИЯ';

    document.getElementById('countryInfo').innerHTML = `
      <div class="country-header">
        <div class="province-badge">${data.iso}</div>
        <div class="country-title">${data.name}</div>
        <div class="country-iso">${data.country}</div>
      </div>

      <div class="country-section">
        <div class="country-section-title">Демография</div>
        <div class="info-row"><span class="key">Население</span><span class="value">${fmtNum(data.population)}</span></div>
        <div class="info-row"><span class="key">Биом</span><span class="value">${data.biome}</span></div>
      </div>

      <div class="country-section">
        <div class="country-section-title">Ресурсы</div>
        <div class="resource-grid">${resHtml}</div>
      </div>

      <div class="country-section">
        <div class="country-section-title">Военное</div>
        <div class="info-row"><span class="key">Промышленность</span><span class="value">${data.industry}</span></div>
        <div class="info-row"><span class="key">Гарнизон</span><span class="value">${data.garrison}</span></div>
        <div class="info-row"><span class="key">Укрепления</span><span class="value">${'★'.repeat(data.fortLevel) || '—'}</span></div>
      </div>

      ${weatherHtml}

      <div class="action-buttons">
        <button class="action-btn" data-action="build">Строить</button>
        <button class="action-btn" data-action="recruit">Набрать</button>
        <button class="action-btn" data-action="fortify">Укрепить</button>
        <button class="action-btn" data-action="info">Подробнее</button>
      </div>
    `;

    // Кнопки действий (заглушки)
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (window.showToast) {
          const labels = { build: 'Строительство', recruit: 'Набор', fortify: 'Укрепление', info: 'Информация' };
          window.showToast(`${labels[action]}: ${data.name}`);
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // Взаимодействие с картой
  // ─────────────────────────────────────────────────────
  let selectedLayer = null;
  const defaultStyle = {
    fillColor: '#5a6a4a',
    weight: 0.8,
    color: '#2a2e34',
    fillOpacity: 0.55
  };
  const hoverStyle = {
    fillColor: '#7a8a5a',
    weight: 1.5,
    color: '#d4bc82',
    fillOpacity: 0.75
  };
  const selectedStyle = {
    fillColor: '#8a7a4a',
    weight: 2.5,
    color: '#d4bc82',
    fillOpacity: 0.85
  };

  function onEachProvince(feature, layer) {
    // Сохраняем bounds на фиче — для панели
    feature._layer = layer;
    feature._layerBounds = layer.getBounds();

    layer.setStyle(defaultStyle);

    layer.on('mouseover', () => {
      if (selectedLayer === layer) return;
      layer.setStyle(hoverStyle);
      if (layer.bringToFront) layer.bringToFront();
    });

    layer.on('mouseout', () => {
      if (selectedLayer === layer) return;
      layer.setStyle(defaultStyle);
    });

    layer.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (selectedLayer && selectedLayer !== layer) {
        selectedLayer.setStyle(defaultStyle);
      }
      layer.setStyle(selectedStyle);
      if (layer.bringToFront) layer.bringToFront();
      selectedLayer = layer;

      // Генерируем данные и показываем
      const data = generateProvinceData(feature);
      renderProvincePanel(data);

      // Агрегаты в topbar — по стране провинции
      updateCountryAggregates(data.countryIso);
    });
  }

  // ─────────────────────────────────────────────────────
  // Агрегаты страны (topbar)
  // ─────────────────────────────────────────────────────
  function updateCountryAggregates(countryIso) {
    if (!countryIso || countryIso === '—') return;
    let totalPop = 0, totalIndustry = 0, totalFuel = 0, totalTreasury = 0;

    // Считаем по всем провинциям этой страны
    if (window.ProvinceEngine && window.ProvinceEngine.layer) {
      window.ProvinceEngine.layer.eachLayer(l => {
        const p = l.feature.properties;
        const iso = p.iso_a2 || p.adm0_a3;
        if (iso !== countryIso) return;
        const data = generateProvinceData(l.feature);
        totalPop += data.population;
        totalIndustry += data.industry;
        totalFuel += data.resources.oil;
        totalTreasury += data.resources.steel + data.resources.food;
      });
    }

    const manpowerEl = document.getElementById('stat-manpower');
    const industryEl = document.getElementById('stat-industry');
    const fuelEl = document.getElementById('stat-fuel');
    const treasuryEl = document.getElementById('stat-treasury');

    if (manpowerEl) manpowerEl.textContent = fmtNum(Math.floor(totalPop / 1000));
    if (industryEl) industryEl.textContent = fmtNum(totalIndustry);
    if (fuelEl) fuelEl.textContent = fmtNum(totalFuel);
    if (treasuryEl) treasuryEl.textContent = fmtNum(totalTreasury);
  }

  // ─────────────────────────────────────────────────────
  // Загрузка слоя
  // ─────────────────────────────────────────────────────
  const ProvinceEngine = {
    layer: null,
    loaded: false,

    async load() {
      if (this.loaded) return this.layer;
      const url = `${CONFIG.dir}/${CONFIG.file}`;

      try {
        // Используем CacheManager, если доступен
        let json;
        if (window.CacheManager) {
          const cached = await window.CacheManager.get(url);
          if (cached) {
            json = await cached.clone().json();
          } else {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`404: ${url}`);
            await window.CacheManager.put(url, r);
            json = await r.clone().json();
          }
        } else {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`404: ${url}`);
          json = await r.json();
        }

        const layer = L.geoJSON(json, { onEachFeature: onEachProvince });
        this.layer = layer;
        this.loaded = true;
        console.log(`[provinces.js] Загружено провинций: ${json.features.length}`);
        if (window.showToast) window.showToast(`Провинций: ${json.features.length}`);
        return layer;
      } catch (err) {
        console.error('[provinces.js]', err);
        if (window.showToast) window.showToast(`Провинции не загружены: ${err.message}`, 'warn');
        throw err;
      }
    },

    // Показать/скрыть слой
    setVisible(v) {
      if (!this.layer) return;
      if (v) this.layer.addTo(MAP);
      else MAP.removeLayer(this.layer);
    },

    // Получить данные провинции по ISO
    getByIso(iso) {
      if (!this.layer) return null;
      let found = null;
      this.layer.eachLayer(l => {
        if (!found && l.feature.properties.iso_3166_2 === iso) found = l.feature;
      });
      return found ? generateProvinceData(found) : null;
    }
  };

  window.ProvinceEngine = ProvinceEngine;
  console.log('[provinces.js] Модуль провинций загружен.');

  // Автозагрузка после готовности карты
  if (MAP._loaded) {
    setTimeout(() => ProvinceEngine.load().catch(() => {}), 500);
  } else {
    MAP.whenReady(() => setTimeout(() => ProvinceEngine.load().catch(() => {}), 500));
  }
})();
