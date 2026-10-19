// ═══════════════════════════════════════════════════════
// 1. Карта
// ═══════════════════════════════════════════════════════
const map = L.map('map', {
  center: [20, 0], zoom: 2, minZoom: 2, maxZoom: 8,
  worldCopyJump: true, preferCanvas: true, zoomControl: false,
  updateWhenZooming: false, keepBuffer: 4,
  attributionControl: false
});
L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OSM', maxZoom: 19, keepBuffer: 4
}).addTo(map);
window.map = map;

map.on('mousemove', (e) => {
  document.getElementById('hud-lat').textContent = e.latlng.lat.toFixed(4);
  document.getElementById('hud-lng').textContent = e.latlng.lng.toFixed(4);
});

// ═══════════════════════════════════════════════════════
// 2. Кэш
// ═══════════════════════════════════════════════════════
const CACHE_NAME = 'geojson-cache-v1';
const CacheManager = {
  supported: 'caches' in window,
  async get(url) {
    if (!this.supported) return null;
    try { const c = await caches.open(CACHE_NAME); return await c.match(url) || null; }
    catch (e) { return null; }
  },
  async put(url, r) {
    if (!this.supported) return false;
    try { const c = await caches.open(CACHE_NAME); await c.put(url, r.clone()); return true; }
    catch (e) { return false; }
  },
  async list() {
    if (!this.supported) return [];
    try { const c = await caches.open(CACHE_NAME); return (await c.keys()).map(r => r.url); }
    catch (e) { return []; }
  },
  async clear() {
    if (!this.supported) return false;
    try { await caches.delete(CACHE_NAME); return true; }
    catch (e) { return false; }
  },
  async size() {
    if (!this.supported) return 0;
    try {
      const c = await caches.open(CACHE_NAME);
      const keys = await c.keys();
      let total = 0;
      for (const req of keys) {
        const r = await c.match(req);
        if (r) total += (await r.clone().blob()).size;
      }
      return total;
    } catch (e) { return 0; }
  }
};
window.CacheManager = CacheManager;

function fmtBytes(b) {
  if (b < 1024) return b + ' Б';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' КБ';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' МБ';
  return (b / 1073741824).toFixed(2) + ' ГБ';
}

async function refreshCacheInfo() {
  const el = document.getElementById('cacheInfo');
  if (!el) return;
  if (!CacheManager.supported) {
    el.innerHTML = 'Кэш: не поддерживается';
    return;
  }
  const [files, size] = await Promise.all([CacheManager.list(), CacheManager.size()]);
  el.innerHTML = files.length === 0
    ? 'Кэш: пуст'
    : `Кэш: <span class="cached">${files.length} файлов</span> · ${fmtBytes(size)}`;
}

// ═══════════════════════════════════════════════════════
// 3. Слои
// ═══════════════════════════════════════════════════════
const GEOJSON_DIR = 'geojson';
const LAYERS = {
  countries: {
    file: 'ne_10m_admin_0_countries.geojson',
    group: 'Политические', label: 'Страны', defaultOn: true, type: 'polygon',
    style: { fillColor: '#3a4a3a', weight: 1, color: '#1a1c1e', fillOpacity: 0.5 },
    hoverStyle: { weight: 2, color: '#d4bc82', fillColor: '#5a6a3a', fillOpacity: 0.65 },
    onClick: onCountryClick
  },
  boundaries: {
    file: 'ne_10m_admin_0_boundary_lines_land.geojson',
    group: 'Политические', label: 'Гос. границы', defaultOn: false, type: 'line',
    style: { color: '#2a2e34', weight: 0.8, opacity: 0.6 }
  },
  states: {
    file: 'ne_10m_admin_1_states_provinces_lines.geojson',
    group: 'Политические', label: 'Границы регионов', defaultOn: false, type: 'line',
    style: { color: '#5a4c32', weight: 0.4, opacity: 0.5, dashArray: '3,3' }
  },
  disputed: {
    file: 'ne_10m_admin_0_disputed_areas.geojson',
    group: 'Политические', label: 'Спорные зоны', defaultOn: false, type: 'polygon',
    style: { fillColor: '#a8332f', weight: 0.8, color: '#8b1a1a', fillOpacity: 0.5 }
  },
  lakes: {
    file: 'ne_10m_lakes.geojson',
    group: 'Гидрография', label: 'Озёра', defaultOn: false, type: 'polygon',
    style: { fillColor: '#3a5a6a', weight: 0.4, color: '#2a4a5a', fillOpacity: 0.8 }
  },
  rivers: {
    file: 'ne_10m_rivers_lake_centerlines.geojson',
    group: 'Гидрография', label: 'Реки', defaultOn: true, type: 'line',
    style: { color: '#4a7a9a', weight: 0.8, opacity: 0.7 }
  },
  coastline: {
    file: 'ne_10m_coastline.geojson',
    group: 'Гидрография', label: 'Береговая линия', defaultOn: true, type: 'line',
    style: { color: '#1a1c1e', weight: 1, opacity: 0.7 }
  },
  cities: {
    file: 'ne_10m_populated_places_simple.geojson',
    group: 'Инфраструктура', label: 'Города', defaultOn: true, type: 'point',
    pointRadius: 2, pointColor: '#b8a06a', hoverPointRadius: 4,
    onClick: onCityClick
  },
  airports: {
    file: 'ne_10m_airports.geojson',
    group: 'Инфраструктура', label: 'Аэропорты', defaultOn: false, type: 'point',
    pointRadius: 3, pointColor: '#8a6a9a', hoverPointRadius: 5
  },
  ports: {
    file: 'ne_10m_ports.geojson',
    group: 'Инфраструктура', label: 'Порты', defaultOn: false, type: 'point',
    pointRadius: 3, pointColor: '#4a8a7a', hoverPointRadius: 5
  },
  roads: {
    file: 'ne_10m_roads.geojson',
    group: 'Инфраструктура', label: 'Дороги', defaultOn: false, type: 'line',
    style: { color: '#7a7058', weight: 0.5, opacity: 0.6 }
  },
  railroads: {
    file: 'ne_10m_railroads.geojson',
    group: 'Инфраструктура', label: 'Ж/Д', defaultOn: false, type: 'line',
    style: { color: '#7a7058', weight: 0.6, opacity: 0.7, dashArray: '5,5' }
  },
  biomes: {
    file: 'ne_10m_geography_regions_polys.geojson',
    group: 'Климат', label: 'Биомы', defaultOn: false, type: 'polygon',
    style: { fillColor: 'transparent', weight: 0.5, color: '#4a7a3d', fillOpacity: 0 },
    registerToClimate: true
  },
  elevation: {
    file: 'ne_10m_geography_regions_elevation_points.geojson',
    group: 'Климат', label: 'Высоты', defaultOn: false, type: 'point',
    pointRadius: 2, pointColor: '#b8a06a', hoverPointRadius: 4,
    registerToClimate: true
  },
  graticules: {
    file: 'ne_10m_graticules_10.geojson',
    group: 'Тактические', label: 'Сетка 10°', defaultOn: false, type: 'line',
    style: { color: '#5a4c32', weight: 0.3, opacity: 0.4, dashArray: '2,4' }
  },
  timezones: {
    file: 'ne_10m_time_zones.geojson',
    group: 'Тактические', label: 'Часовые пояса', defaultOn: false, type: 'polygon',
    style: { fillColor: 'transparent', weight: 0.5, color: '#b8a06a', dashArray: '5,5', fillOpacity: 0 }
  }
};

// ═══════════════════════════════════════════════════════
// 4. Прогресс
// ═══════════════════════════════════════════════════════
const loadedLayers = {};
const loadingPromises = {};
window.loadedLayers = loadedLayers;

const progress = {
  totalFiles: 0, completedFiles: 0, currentFile: '', hasError: false,
  reset(t) { this.totalFiles = t; this.completedFiles = 0; this.currentFile = ''; this.hasError = false; this.render(); },
  setCurrent(n) { this.currentFile = n; this.render(); },
  completeFile(err = false) {
    this.completedFiles++;
    if (err) this.hasError = true;
    this.currentFile = '';
    this.render();
    refreshCacheInfo();
  },
  get overallPercent() {
    return this.totalFiles === 0 ? 0
      : Math.round((this.completedFiles / this.totalFiles) * 100);
  },
  render() {
    const fill = document.getElementById('progressFill');
    if (!fill) return;
    fill.style.width = this.overallPercent + '%';
    fill.classList.toggle('error', this.hasError);
    document.getElementById('progressText').textContent =
      `${this.completedFiles} / ${this.totalFiles} файлов`;
    document.getElementById('progressPercent').textContent = this.overallPercent + '%';
    const cur = document.getElementById('progressCurrent');
    if (this.currentFile) cur.textContent = `↓ ${this.currentFile}`;
    else if (this.completedFiles === this.totalFiles && this.totalFiles > 0)
      cur.textContent = '✓ Все данные загружены';
    else cur.textContent = '';
  }
};

// ═══════════════════════════════════════════════════════
// 5. Загрузка
// ═══════════════════════════════════════════════════════
async function fetchWithCache(url) {
  const cached = await CacheManager.get(url);
  if (cached) return { json: await cached.clone().json(), fromCache: true };
  const r = await fetch(url);
  if (!r.ok) throw new Error(`404: ${url}`);
  await CacheManager.put(url, r);
  return { json: await r.clone().json(), fromCache: false };
}

async function loadLayer(key) {
  if (loadedLayers[key]) return loadedLayers[key];
  if (loadingPromises[key]) return loadingPromises[key];

  const cfg = LAYERS[key];
  const url = `${GEOJSON_DIR}/${cfg.file}`;
  progress.setCurrent(cfg.file);

  loadingPromises[key] = (async () => {
    try {
      const { json } = await fetchWithCache(url);
      const options = { onEachFeature: cfg.onClick };
      if (cfg.type === 'point') {
        options.pointToLayer = (f, latlng) =>
          L.circleMarker(latlng, {
            radius: cfg.pointRadius || 3,
            fillColor: cfg.pointColor || '#fff',
            color: '#1a1c1e', weight: 0.7, fillOpacity: 0.9
          });
      } else {
        options.style = () => cfg.style;
      }
      const layer = L.geoJSON(json, options);
      loadedLayers[key] = layer;
      progress.completeFile();

      if (cfg.registerToClimate && window.ClimateEngine) {
        if (key === 'biomes') {
          window.ClimateEngine.register(layer, window.ClimateEngine.elevationLayer);
        } else if (key === 'elevation') {
          window.ClimateEngine.register(window.ClimateEngine.biomesLayer, layer);
        }
      }
      return layer;
    } catch (err) {
      console.error(`[${key}]`, err);
      progress.completeFile(true);
      throw err;
    } finally {
      delete loadingPromises[key];
    }
  })();
  return loadingPromises[key];
}

function toggleLayer(key, on) {
  if (on) loadLayer(key).then(l => { if (!map.hasLayer(l)) l.addTo(map); }).catch(() => {});
  else if (loadedLayers[key] && map.hasLayer(loadedLayers[key])) map.removeLayer(loadedLayers[key]);
}

// ═══════════════════════════════════════════════════════
// 6. UI построение
// ═══════════════════════════════════════════════════════
function buildUI() {
  const container = document.getElementById('layerControls');
  const groups = {};
  Object.entries(LAYERS).forEach(([key, cfg]) => {
    const g = cfg.group || 'Прочее';
    if (!groups[g]) groups[g] = [];
    groups[g].push({ key, cfg });
  });

  Object.entries(groups).forEach(([groupName, items]) => {
    const div = document.createElement('div');
    div.className = 'layer-group collapsed';
    const header = document.createElement('div');
    header.className = 'layer-group-header';
    header.innerHTML = `<span>${groupName}</span><span class="arrow">▼</span>`;
    header.addEventListener('click', () => div.classList.toggle('collapsed'));
    div.appendChild(header);

    const content = document.createElement('div');
    content.className = 'layer-group-content';
    items.forEach(({ key, cfg }) => {
      const label = document.createElement('label');
      label.className = 'layer-item';
      label.innerHTML = `
        <input type="checkbox" data-key="${key}" ${cfg.defaultOn ? 'checked' : ''} />
        <span>${cfg.label}</span>
      `;
      content.appendChild(label);
    });
    div.appendChild(content);
    container.appendChild(div);
  });

  // Атмосфера
  const atmoDiv = document.createElement('div');
  atmoDiv.className = 'layer-group collapsed';
  atmoDiv.innerHTML = `
    <div class="layer-group-header"><span>Атмосфера</span><span class="arrow">▼</span></div>
    <div class="layer-group-content">
      <label class="layer-item"><input type="checkbox" id="toggle-wind-field" /><span>Ветровое поле</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-cyclones" checked /><span>Циклоны</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-precip" checked /><span>Осадки и облака</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-snow" checked /><span>Снежный покров</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-wet" /><span>Влажность почвы</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-fog" checked /><span>Туман</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-smoke" checked /><span>Дым</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-lightning" checked /><span>Молнии</span></label>
    </div>
  `;
  atmoDiv.querySelector('.layer-group-header').addEventListener('click', () =>
    atmoDiv.classList.toggle('collapsed')
  );
  container.appendChild(atmoDiv);

  container.querySelectorAll('input[data-key]').forEach(cb => {
    cb.addEventListener('change', e => toggleLayer(e.target.dataset.key, e.target.checked));
  });

  document.getElementById('toggle-wind-field').addEventListener('change', e => {
    if (window.Atmosphere) window.Atmosphere.WindField.setVisible(e.target.checked);
  });
  document.getElementById('toggle-cyclones').addEventListener('change', e => {
    if (!window.Atmosphere) return;
    const CE = window.Atmosphere.CycloneEngine;
    if (e.target.checked) {
      if (CE.layerGroup) CE.layerGroup.addTo(map);
      CE.start();
    } else {
      CE.active.forEach(c => c.marker && map.removeLayer(c.marker));
      if (CE.layerGroup) map.removeLayer(CE.layerGroup);
    }
  });
  document.getElementById('toggle-precip').addEventListener('change', e => {
    if (window.PrecipitationEngine) window.PrecipitationEngine.setVisible(e.target.checked);
  });
  document.getElementById('toggle-snow').addEventListener('change', e => {
    if (window.TerrainEngine) window.TerrainEngine.setVisible('snow', e.target.checked);
  });
  document.getElementById('toggle-wet').addEventListener('change', e => {
    if (window.TerrainEngine) window.TerrainEngine.setVisible('wet', e.target.checked);
  });
  document.getElementById('toggle-fog').addEventListener('change', e => {
    if (window.PhenomenaEngine) window.PhenomenaEngine.FogEngine.setVisible(e.target.checked);
  });
  document.getElementById('toggle-smoke').addEventListener('change', e => {
    if (!window.PhenomenaEngine) return;
    const SE = window.PhenomenaEngine.SmokeEngine;
    if (e.target.checked) { if (SE.layer) SE.layer.addTo(map); }
    else { if (SE.layer) map.removeLayer(SE.layer); }
  });
  document.getElementById('toggle-lightning').addEventListener('change', e => {
    if (!window.PhenomenaEngine) return;
    const LE = window.PhenomenaEngine.LightningEngine;
    if (e.target.checked) { if (LE.layer) LE.layer.addTo(map); }
    else { if (LE.layer) map.removeLayer(LE.layer); }
  });
}

// ═══════════════════════════════════════════════════════
// 7. Сворачивание панелей
// ═══════════════════════════════════════════════════════
function setupPanelCollapse() {
  const leftPanel = document.getElementById('layerPanel');
  const rightPanel = document.getElementById('infoPanel');
  const btnCollapseLeft = document.getElementById('btn-collapse-left');
  const btnCollapseRight = document.getElementById('btn-collapse-right');
  const btnRestoreLeft = document.getElementById('btn-restore-left');
  const btnRestoreRight = document.getElementById('btn-restore-right');

  btnCollapseLeft.addEventListener('click', () => {
    leftPanel.classList.add('collapsed');
    btnRestoreLeft.classList.add('visible');
  });
  btnRestoreLeft.addEventListener('click', () => {
    leftPanel.classList.remove('collapsed');
    btnRestoreLeft.classList.remove('visible');
  });

  btnCollapseRight.addEventListener('click', () => {
    rightPanel.classList.add('collapsed');
    btnRestoreRight.classList.add('visible');
  });
  btnRestoreRight.addEventListener('click', () => {
    rightPanel.classList.remove('collapsed');
    btnRestoreRight.classList.remove('visible');
  });
}

// ═══════════════════════════════════════════════════════
// 8. Клики по карте
// ═══════════════════════════════════════════════════════
let selectedCountry = null;

function onCountryClick(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'NAME_RU', 'NAME', 'ADMIN');
  const iso = pick(p, 'ISO_A3', 'ADM0_A3');

  layer.on('click', () => {
    if (selectedCountry && selectedCountry.layer !== layer) {
      selectedCountry.layer.setStyle(LAYERS.countries.style);
    }
    layer.setStyle({ weight: 2.5, color: '#d4bc82', fillColor: '#5a6a3a', fillOpacity: 0.7 });
    selectedCountry = { layer, feature };
    updateCountryPanel(feature, layer);
    document.getElementById('countryName').textContent = name;
    document.getElementById('playerCountry').textContent = name;
  });

  layer.on('mouseover', () => {
    if (selectedCountry && selectedCountry.layer === layer) return;
    layer.setStyle(LAYERS.countries.hoverStyle);
  });
  layer.on('mouseout', () => {
    if (selectedCountry && selectedCountry.layer === layer) return;
    layer.setStyle(LAYERS.countries.style);
  });
}

function onCityClick(feature, layer) {
  const p = feature.properties || {};
  if (Number(pick(p, 'scalerank')) > 3) {
    layer.setStyle({ radius: 0, opacity: 0, fillOpacity: 0 });
    return;
  }
  const name = pick(p, 'name_ru', 'NAME');
  layer.bindPopup(`<strong>${name}</strong>`);
}

// ═══════════════════════════════════════════════════════
// 9. Панель страны
// ═══════════════════════════════════════════════════════
function updateCountryPanel(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'NAME_RU', 'NAME', 'ADMIN');
  const iso = pick(p, 'ISO_A3', 'ADM0_A3');
  const pop = fmtNum(pick(p, 'POP_EST'));
  const continent = pick(p, 'CONTINENT');
  const gdp = fmtNum(pick(p, 'GDP_MD'));

  // Погода в центре страны
  let weatherHtml = '';
  if (window.Atmosphere && window.NatureEngine && window.NatureEngine.timeEngine) {
    const te = window.NatureEngine.timeEngine;
    const c = layer.getBounds().getCenter();
    const atm = window.Atmosphere.getAtPoint(c.lat, c.lng, te.current, te.season);
    const precip = window.PrecipitationEngine
      ? window.PrecipitationEngine.getPrecipAt(c.lat, c.lng) : null;
    const snow = window.TerrainEngine ? window.TerrainEngine.getSnowAt(c.lat, c.lng) : 0;
    const soil = window.TerrainEngine ? window.TerrainEngine.getSoilAt(c.lat, c.lng) : '—';
    const vis = window.PhenomenaEngine
      ? window.PhenomenaEngine.Visibility.getAt(c.lat, c.lng) : 25;
    const biome = window.ClimateEngine
      ? window.ClimateEngine.getBiomeAt(c.lat, c.lng) : '—';

    const tempClass = atm.temp < 0 ? 'bad' : atm.temp < 15 ? 'good' : atm.temp < 28 ? 'warn' : 'bad';
    const visClass = vis >= 15 ? 'good' : vis >= 5 ? 'warn' : 'bad';

    weatherHtml = `
      <div class="country-section">
        <div class="country-section-title">Погода (центр)</div>
        <div class="info-row"><span class="key">Биом</span><span class="value">${biome}</span></div>
        <div class="info-row"><span class="key">Температура</span><span class="value ${tempClass}">${atm.temp.toFixed(1)}°C</span></div>
        <div class="info-row"><span class="key">Ветер</span><span class="value">${atm.wind.speed.toFixed(0)} м/с</span></div>
        ${precip ? `<div class="info-row"><span class="key">Осадки</span><span class="value">${precip}</span></div>` : ''}
        ${snow > 0.5 ? `<div class="info-row"><span class="key">Снег</span><span class="value">${snow.toFixed(1)} см</span></div>` : ''}
        <div class="info-row"><span class="key">Почва</span><span class="value">${soil}</span></div>
        <div class="info-row"><span class="key">Видимость</span><span class="value ${visClass}">${vis.toFixed(1)} км</span></div>
      </div>
    `;
  }

  const html = `
    <div class="country-header">
      <div class="country-flag">🏳</div>
      <div class="country-title">${name}</div>
      <div class="country-iso">${iso}</div>
    </div>

    <div class="country-section">
      <div class="country-section-title">Основное</div>
      <div class="info-row"><span class="key">Население</span><span class="value">${pop}</span></div>
      <div class="info-row"><span class="key">Континент</span><span class="value">${continent}</span></div>
      <div class="info-row"><span class="key">ВВП (млн $)</span><span class="value">${gdp}</span></div>
    </div>

    ${weatherHtml}

    <div class="action-buttons">
      <button class="action-btn">Дипломатия</button>
      <button class="action-btn">Производство</button>
      <button class="action-btn">Армия</button>
      <button class="action-btn">Логистика</button>
    </div>
  `;
  document.getElementById('countryInfo').innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// 10. Утилиты
// ═══════════════════════════════════════════════════════
function pick(obj, ...keys) { for (const k of keys) if (obj[k]) return obj[k]; return '—'; }
function fmtNum(v) { const n = Number(v); return isFinite(n) ? n.toLocaleString('ru-RU') : '—'; }

// ═══════════════════════════════════════════════════════
// 11. HUD погоды (плавающий блок)
// ═══════════════════════════════════════════════════════
map.on('mousemove', (e) => {
  const lat = e.latlng.lat, lng = e.latlng.lng;

  if (window.ClimateEngine && window.ClimateEngine.loaded) {
    const biome = window.ClimateEngine.getBiomeAt(lat, lng);
    const el = document.getElementById('hud-biome');
    if (el) {
      el.textContent = biome || '—';
      el.style.color = biome === 'Unknown' ? '#8a8478' : '#b8a06a';
    }
  }

  if (window.Atmosphere && window.NatureEngine && window.NatureEngine.timeEngine) {
    const te = window.NatureEngine.timeEngine;
    const atm = window.Atmosphere.getAtPoint(lat, lng, te.current, te.season);

    const tempEl = document.getElementById('hud-temp');
    if (tempEl) {
      tempEl.textContent = atm.temp.toFixed(1) + '°C';
      tempEl.style.color = atm.temp < 0 ? '#85c1e9' : atm.temp < 15 ? '#58d68d' : atm.temp < 28 ? '#f1c40f' : '#e74c3c';
    }

    const windEl = document.getElementById('hud-wind');
    if (windEl) {
      const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
      const idx = Math.round(((atm.wind.dir % 360) / 45)) % 8;
      windEl.textContent = `${atm.wind.speed.toFixed(0)} ${dirs[idx]}`;
    }
  }

  const precipEl = document.getElementById('hud-precip');
  if (precipEl && window.PrecipitationEngine) {
    const p = window.PrecipitationEngine.getPrecipAt(lat, lng);
    precipEl.textContent = p || '—';
    precipEl.style.color = p === 'Снег' ? '#85c1e9' : p === 'Дождь' ? '#4a90e2' : '#8a8478';
  }

  const snowEl = document.getElementById('hud-snow');
  if (snowEl && window.TerrainEngine) {
    const s = window.TerrainEngine.getSnowAt(lat, lng);
    snowEl.textContent = s > 0.5 ? s.toFixed(1) + 'см' : '0';
    snowEl.style.color = s > 0.5 ? '#ecf0f1' : '#8a8478';
  }

  const soilEl = document.getElementById('hud-soil');
  if (soilEl && window.TerrainEngine) {
    const s = window.TerrainEngine.getSoilAt(lat, lng);
    soilEl.textContent = s;
    soilEl.style.color = s === 'Мокрая' ? '#6e5032' : s === 'Влажная' ? '#8c6e46' : '#8a8478';
  }

  const visEl = document.getElementById('hud-vis');
  if (visEl && window.PhenomenaEngine) {
    const v = window.PhenomenaEngine.Visibility.getAt(lat, lng);
    visEl.textContent = v.toFixed(1) + 'км';
    visEl.style.color = v >= 15 ? '#4a7a3d' : v >= 5 ? '#b8a06a' : v >= 2 ? '#e67e22' : '#a8332f';
  }
});

// ═══════════════════════════════════════════════════════
// 12. Кнопки
// ═══════════════════════════════════════════════════════
document.getElementById('btn-reset-view').addEventListener('click', () => {
  if (loadedLayers.countries) map.fitBounds(loadedLayers.countries.getBounds(), { padding: [20, 20] });
});

document.getElementById('btn-clear-cache').addEventListener('click', async () => {
  if (!CacheManager.supported) { showToast('Cache API не поддерживается', 'warn'); return; }
  if (!confirm('Очистить кэш GeoJSON?')) return;
  await CacheManager.clear();
  await refreshCacheInfo();
  showToast('Кэш очищен');
});

// Режимы карты (заглушки, работают как фильтры)
document.querySelectorAll('.map-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.map-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    // Здесь в будущем можно менять стиль слоёв по режиму
    showToast(`Режим: ${btn.querySelector('.mm-label').textContent}`);
  });
});

// ═══════════════════════════════════════════════════════
// 13. Тосты
// ═══════════════════════════════════════════════════════
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'warn' ? ' warn' : '');
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
window.showToast = showToast;

// ═══════════════════════════════════════════════════════
// 14. Старт
// ═══════════════════════════════════════════════════════
buildUI();
setupPanelCollapse();
refreshCacheInfo();

const backgroundKeys = ['biomes', 'elevation'];
const initialKeys = Object.keys(LAYERS).filter(k => LAYERS[k].defaultOn);
const allToLoad = [...new Set([...initialKeys, ...backgroundKeys])];
progress.reset(allToLoad.length);

allToLoad.forEach(key => {
  loadLayer(key).then(layer => {
    if (LAYERS[key].defaultOn && !map.hasLayer(layer)) layer.addTo(map);
  }).catch(() => {});
});

loadLayer('countries').then(c => {
  if (c) map.fitBounds(c.getBounds(), { padding: [20, 20] });
}).catch(() => {});
