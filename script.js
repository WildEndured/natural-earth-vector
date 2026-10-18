// ═══════════════════════════════════════════════════════
// 1. Карта
// ═══════════════════════════════════════════════════════
const map = L.map('map', {
  center: [20, 0], zoom: 2, minZoom: 2, maxZoom: 10,
  worldCopyJump: true, preferCanvas: true, zoomControl: false
});
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap', maxZoom: 19
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
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' КБ';
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' МБ';
  return (b / 1024 / 1024 / 1024).toFixed(2) + ' ГБ';
}

async function refreshCacheInfo() {
  const el = document.getElementById('cacheInfo');
  if (!el) return;
  if (!CacheManager.supported) {
    el.innerHTML = 'Кэш: <span class="empty">не поддерживается</span>';
    return;
  }
  const [files, size] = await Promise.all([CacheManager.list(), CacheManager.size()]);
  el.innerHTML = files.length === 0
    ? 'Кэш: <span class="empty">пуст</span>'
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
    style: { fillColor: '#2c3e50', weight: 0.5, color: '#1a252f', fillOpacity: 0.4 },
    hoverStyle: { weight: 1.5, color: '#e74c3c', fillColor: '#c0392b', fillOpacity: 0.6 },
    onChange: onCountryFeature
  },
  boundaries: {
    file: 'ne_10m_admin_0_boundary_lines_land.geojson',
    group: 'Политические', label: 'Гос. границы', defaultOn: true, type: 'line',
    style: { color: '#e74c3c', weight: 1, opacity: 0.7 }
  },
  states: {
    file: 'ne_10m_admin_1_states_provinces_lines.geojson',
    group: 'Политические', label: 'Границы регионов', defaultOn: false, type: 'line',
    style: { color: '#7f8c8d', weight: 0.5, opacity: 0.6, dashArray: '3,3' }
  },
  disputed: {
    file: 'ne_10m_admin_0_disputed_areas.geojson',
    group: 'Политические', label: 'Спорные зоны', defaultOn: false, type: 'polygon',
    style: { fillColor: '#f1c40f', weight: 0.8, color: '#f39c12', fillOpacity: 0.5 }
  },
  lakes: {
    file: 'ne_10m_lakes.geojson',
    group: 'Гидрография', label: 'Озёра', defaultOn: false, type: 'polygon',
    style: { fillColor: '#2980b9', weight: 0.4, color: '#1f618d', fillOpacity: 0.7 }
  },
  rivers: {
    file: 'ne_10m_rivers_lake_centerlines.geojson',
    group: 'Гидрография', label: 'Реки', defaultOn: true, type: 'line',
    style: { color: '#3498db', weight: 0.8, opacity: 0.8 }
  },
  coastline: {
    file: 'ne_10m_coastline.geojson',
    group: 'Гидрография', label: 'Береговая линия', defaultOn: true, type: 'line',
    style: { color: '#ecf0f1', weight: 0.8, opacity: 0.6 }
  },
  ocean: {
    file: 'ne_10m_ocean.geojson',
    group: 'Гидрография', label: 'Океаны (заливка)', defaultOn: false, type: 'polygon',
    style: { fillColor: '#0e2f44', weight: 0, fillOpacity: 0.6 }
  },
  cities: {
    file: 'ne_10m_populated_places_simple.geojson',
    group: 'Инфраструктура', label: 'Населённые пункты', defaultOn: true, type: 'point',
    pointRadius: 2, pointColor: '#f1c40f', hoverPointRadius: 4,
    onChange: onCityFeature
  },
  airports: {
    file: 'ne_10m_airports.geojson',
    group: 'Инфраструктура', label: 'Аэропорты', defaultOn: false, type: 'point',
    pointRadius: 3, pointColor: '#9b59b6', hoverPointRadius: 5
  },
  ports: {
    file: 'ne_10m_ports.geojson',
    group: 'Инфраструктура', label: 'Порты', defaultOn: false, type: 'point',
    pointRadius: 3, pointColor: '#16a085', hoverPointRadius: 5
  },
  roads: {
    file: 'ne_10m_roads.geojson',
    group: 'Инфраструктура', label: 'Дороги', defaultOn: false, type: 'line',
    style: { color: '#bdc3c7', weight: 0.5, opacity: 0.6 }
  },
  railroads: {
    file: 'ne_10m_railroads.geojson',
    group: 'Инфраструктура', label: 'Ж/Д', defaultOn: false, type: 'line',
    style: { color: '#95a5a6', weight: 0.6, opacity: 0.7, dashArray: '5,5' }
  },
  urban: {
    file: 'ne_10m_urban_areas.geojson',
    group: 'Инфраструктура', label: 'Городская застройка', defaultOn: false, type: 'polygon',
    style: { fillColor: '#7f8c8d', weight: 0.2, fillOpacity: 0.5 }
  },
  land: {
    file: 'ne_10m_land.geojson',
    group: 'Природа', label: 'Суша (базовая)', defaultOn: false, type: 'polygon',
    style: { fillColor: '#27ae60', weight: 0.3, color: '#1e8449', fillOpacity: 0.3 }
  },
  glaciers: {
    file: 'ne_10m_glaciated_areas.geojson',
    group: 'Природа', label: 'Ледники', defaultOn: false, type: 'polygon',
    style: { fillColor: '#ecf0f1', weight: 0.5, color: '#bdc3c7', fillOpacity: 0.8 }
  },
  parks: {
    file: 'ne_10m_parks_and_protected_lands_area.geojson',
    group: 'Природа', label: 'Заповедники', defaultOn: false, type: 'polygon',
    style: { fillColor: '#2ecc71', weight: 0.4, fillOpacity: 0.3 }
  },
  biomes: {
    file: 'ne_10m_geography_regions_polys.geojson',
    group: 'Климат', label: 'Биомы (регионы)', defaultOn: false, type: 'polygon',
    style: { fillColor: 'transparent', weight: 0.6, color: '#27ae60', fillOpacity: 0 },
    registerToClimate: true
  },
  elevation: {
    file: 'ne_10m_geography_regions_elevation_points.geojson',
    group: 'Климат', label: 'Высоты (точки)', defaultOn: false, type: 'point',
    pointRadius: 2, pointColor: '#e67e22', hoverPointRadius: 4,
    registerToClimate: true
  },
  graticules: {
    file: 'ne_10m_graticules_10.geojson',
    group: 'Тактические', label: 'Сетка 10°', defaultOn: false, type: 'line',
    style: { color: '#ecf0f1', weight: 0.3, opacity: 0.3, dashArray: '2,4' }
  },
  timezones: {
    file: 'ne_10m_time_zones.geojson',
    group: 'Тактические', label: 'Часовые пояса', defaultOn: false, type: 'polygon',
    style: { fillColor: 'transparent', weight: 0.5, color: '#f39c12', dashArray: '5,5', fillOpacity: 0 }
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
      cur.textContent = '✅ Все данные загружены';
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
      const options = { onEachFeature: cfg.onChange };
      if (cfg.type === 'point') {
        options.pointToLayer = (f, latlng) =>
          L.circleMarker(latlng, {
            radius: cfg.pointRadius || 3,
            fillColor: cfg.pointColor || '#fff',
            color: '#000', weight: 0.5, fillOpacity: 0.9
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
// 6. UI
// ═══════════════════════════════════════════════════════
function buildUI() {
  const container = document.getElementById('layerControls');
  const groups = {};
  Object.entries(LAYERS).forEach(([key, cfg]) => {
    const g = cfg.group || 'Прочее';
    if (!groups[g]) groups[g] = [];
    groups[g].push({ key, cfg });
  });

  Object.entries(groups).forEach(([groupName, items], index) => {
    const div = document.createElement('div');
    div.className = 'layer-group' + (index > 1 ? ' collapsed' : '');
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

  const atmoDiv = document.createElement('div');
  atmoDiv.className = 'layer-group';
  atmoDiv.innerHTML = `
    <div class="layer-group-header"><span>Атмосфера и явления</span><span class="arrow">▼</span></div>
    <div class="layer-group-content">
      <label class="layer-item"><input type="checkbox" id="toggle-wind-field" /><span>Ветровое поле</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-cyclones" checked /><span>Циклоны</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-precip" checked /><span>Осадки и облака</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-snow" checked /><span>Снежный покров</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-wet" /><span>Влажность почвы</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-fog" checked /><span>Туман</span></label>
      <label class="layer-item"><input type="checkbox" id="toggle-smoke" checked /><span>Дым от пожаров</span></label>
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
// 7. Утилиты
// ═══════════════════════════════════════════════════════
function updateInfo(html) { document.getElementById('countryInfo').innerHTML = html; }
function pick(obj, ...keys) { for (const k of keys) if (obj[k]) return obj[k]; return '—'; }
function fmtNum(v) { const n = Number(v); return isFinite(n) ? n.toLocaleString('ru-RU') : '—'; }

function hoverBind(layer, cfg, infoHTML) {
  layer.on('mouseover', () => {
    if (cfg.hoverStyle) layer.setStyle(cfg.hoverStyle);
    else if (cfg.hoverPointRadius) layer.setStyle({ radius: cfg.hoverPointRadius });
    if (layer.bringToFront) layer.bringToFront();
  });
  layer.on('mouseout', () => {
    const parentKey = Object.keys(loadedLayers).find(k => LAYERS[k] === cfg);
    if (parentKey) loadedLayers[parentKey].resetStyle(layer);
  });
  layer.on('click', () => updateInfo(infoHTML));
}

function onCountryFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'NAME_RU', 'NAME', 'ADMIN');
  const iso = pick(p, 'ISO_A3', 'ADM0_A3');
  const pop = fmtNum(pick(p, 'POP_EST'));

  let weatherInfo = '';
  if (window.Atmosphere && window.NatureEngine && window.NatureEngine.timeEngine) {
    const te = window.NatureEngine.timeEngine;
    const c = layer.getBounds().getCenter();
    const atmC = window.Atmosphere.getAtPoint(c.lat, c.lng, te.current, te.season);
    const precip = window.PrecipitationEngine
      ? window.PrecipitationEngine.getPrecipAt(c.lat, c.lng) : null;
    const snow = window.TerrainEngine ? window.TerrainEngine.getSnowAt(c.lat, c.lng) : 0;
    const soil = window.TerrainEngine ? window.TerrainEngine.getSoilAt(c.lat, c.lng) : '—';
    const vis = window.PhenomenaEngine
      ? window.PhenomenaEngine.Visibility.getAt(c.lat, c.lng) : 25;

    weatherInfo = `
      <tr><td>Темп.</td><td>${atmC.temp.toFixed(1)}°C</td></tr>
      <tr><td>Ветер</td><td>${atmC.wind.speed.toFixed(0)} м/с</td></tr>
      ${precip ? `<tr><td>Осадки</td><td>${precip}</td></tr>` : ''}
      ${snow > 0.5 ? `<tr><td>Снег</td><td>${snow.toFixed(1)} см</td></tr>` : ''}
      <tr><td>Почва</td><td>${soil}</td></tr>
      <tr><td>Видимость</td><td>${vis.toFixed(1)} км</td></tr>
    `;
  }

  const html = `
    <table class="info-table">
      <tr><td>Страна</td><td>${name}</td></tr>
      <tr><td>Код ISO</td><td>${iso}</td></tr>
      <tr><td>Население</td><td>${pop}</td></tr>
      <tr><td>Континент</td><td>${pick(p, 'CONTINENT')}</td></tr>
      ${weatherInfo}
    </table>`;

  layer.bindPopup(`<strong>${name}</strong><br>Код: ${iso}`);
  hoverBind(layer, LAYERS.countries, html);
}

function onCityFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'name_ru', 'NAME');
  const pop = fmtNum(pick(p, 'pop_max'));
  const adm = pick(p, 'adm0name');
  if (Number(pick(p, 'scalerank')) > 3) {
    layer.setStyle({ radius: 0, opacity: 0, fillOpacity: 0 });
    return;
  }
  const html = `
    <table class="info-table">
      <tr><td>Населённый пункт</td><td>${name}</td></tr>
      <tr><td>Страна</td><td>${adm}</td></tr>
      <tr><td>Население</td><td>${pop}</td></tr>
    </table>`;
  layer.bindPopup(`<strong>${name}</strong>`);
  hoverBind(layer, LAYERS.cities, html);
}

// ═══════════════════════════════════════════════════════
// 8. HUD
// ═══════════════════════════════════════════════════════
map.on('mousemove', (e) => {
  const lat = e.latlng.lat, lng = e.latlng.lng;

  if (window.ClimateEngine && window.ClimateEngine.loaded) {
    const biome = window.ClimateEngine.getBiomeAt(lat, lng);
    const el = document.getElementById('hud-biome');
    if (el) {
      el.textContent = biome || '—';
      el.style.color = biome === 'Unknown' ? '#888' : '#58d68d';
    }
  }

  if (window.Atmosphere && window.NatureEngine && window.NatureEngine.timeEngine) {
    const te = window.NatureEngine.timeEngine;
    const atm = window.Atmosphere.getAtPoint(lat, lng, te.current, te.season);

    const tempEl = document.getElementById('hud-temp');
    if (tempEl) {
      tempEl.textContent = atm.temp.toFixed(1) + '°C';
      tempEl.style.color =
        atm.temp < 0 ? '#85c1e9' :
        atm.temp < 15 ? '#58d68d' :
        atm.temp < 28 ? '#f1c40f' : '#e74c3c';
    }

    const windEl = document.getElementById('hud-wind');
    if (windEl) {
      const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
      const idx = Math.round(((atm.wind.dir % 360) / 45)) % 8;
      windEl.textContent = `${atm.wind.speed.toFixed(0)} м/с ${dirs[idx]}`;
    }
  }

  const precipEl = document.getElementById('hud-precip');
  if (precipEl && window.PrecipitationEngine) {
    const p = window.PrecipitationEngine.getPrecipAt(lat, lng);
    precipEl.textContent = p || '—';
    precipEl.style.color = p === 'Снег' ? '#85c1e9' : p === 'Дождь' ? '#4a90e2' : '#888';
  }

  const snowEl = document.getElementById('hud-snow');
  if (snowEl && window.TerrainEngine) {
    const s = window.TerrainEngine.getSnowAt(lat, lng);
    snowEl.textContent = s > 0.5 ? s.toFixed(1) + ' см' : '0 см';
    snowEl.style.color = s > 0.5 ? '#ecf0f1' : '#888';
  }

  const soilEl = document.getElementById('hud-soil');
  if (soilEl && window.TerrainEngine) {
    const s = window.TerrainEngine.getSoilAt(lat, lng);
    soilEl.textContent = s;
    soilEl.style.color =
      s === 'Мокрая' ? '#6e5032' : s === 'Влажная' ? '#8c6e46' : '#888';
  }

  const visEl = document.getElementById('hud-vis');
  if (visEl && window.PhenomenaEngine) {
    const v = window.PhenomenaEngine.Visibility.getAt(lat, lng);
    visEl.textContent = v.toFixed(1) + ' км';
    visEl.style.color =
      v >= 15 ? '#27ae60' :
      v >= 5  ? '#f1c40f' :
      v >= 2  ? '#e67e22' : '#e74c3c';
  }
});

// ═══════════════════════════════════════════════════════
// 9. Кнопки
// ═══════════════════════════════════════════════════════
document.getElementById('btn-reset-view').addEventListener('click', () => {
  if (loadedLayers.countries) map.fitBounds(loadedLayers.countries.getBounds(), { padding: [20, 20] });
});

document.getElementById('btn-clear-cache').addEventListener('click', async () => {
  const btn = document.getElementById('btn-clear-cache');
  if (!CacheManager.supported) { alert('Cache API не поддерживается.'); return; }
  if (!confirm('Очистить кэш GeoJSON?')) return;
  btn.disabled = true; btn.textContent = '⏳...';
  await CacheManager.clear();
  await refreshCacheInfo();
  btn.disabled = false; btn.textContent = '🗑 Кэш';
});

// ═══════════════════════════════════════════════════════
// 10. Старт
// ═══════════════════════════════════════════════════════
buildUI();
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
