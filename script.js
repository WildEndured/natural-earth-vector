// ═══════════════════════════════════════════════════════
// 1. Инициализация карты
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

// HUD координат
map.on('mousemove', (e) => {
  document.getElementById('hud-lat').textContent = e.latlng.lat.toFixed(4);
  document.getElementById('hud-lng').textContent = e.latlng.lng.toFixed(4);
});

// ═══════════════════════════════════════════════════════
// 2. Конфигурация слоёв
// ═══════════════════════════════════════════════════════
const GEOJSON_DIR = 'geojson';

const LAYERS = {
  // Политические
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

  // Гидрография
  lakes: {
    file: 'ne_10m_lakes.geojson',
    group: 'Гидрография', label: 'Озёра', defaultOn: false, type: 'polygon',
    style: { fillColor: '#2980b9', weight: 0.4, color: '#1f618d', fillOpacity: 0.7 },
    hoverStyle: { weight: 1, fillOpacity: 0.9 }
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

  // Инфраструктура
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

  // Природа
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

  // Климат (для движка природы)
  biomes: {
    file: 'ne_10m_geography_regions_polys.geojson',
    group: 'Климат', label: 'Биомы (регионы)', defaultOn: false, type: 'polygon',
    style: { fillColor: 'transparent', weight: 0.6, color: '#27ae60', fillOpacity: 0 },
    // Этот слой нужен движку — загружаем в фоне
    registerToClimate: true
  },
  elevation: {
    file: 'ne_10m_geography_regions_elevation_points.geojson',
    group: 'Климат', label: 'Высоты (точки)', defaultOn: false, type: 'point',
    pointRadius: 2, pointColor: '#e67e22', hoverPointRadius: 4,
    registerToClimate: true
  },

  // Тактические
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
// 3. Прогресс и загрузка
// ═══════════════════════════════════════════════════════
const loadedLayers = {};
const loadingPromises = {};
window.loadedLayers = loadedLayers;

const progress = {
  totalFiles: 0, completedFiles: 0, currentFile: '', hasError: false,
  reset(total) {
    this.totalFiles = total;
    this.completedFiles = 0;
    this.currentFile = '';
    this.hasError = false;
    this.render();
  },
  setCurrent(name) { this.currentFile = name; this.render(); },
  completeFile(err = false) {
    this.completedFiles++;
    if (err) this.hasError = true;
    this.currentFile = '';
    this.render();
  },
  get overallPercent() {
    if (this.totalFiles === 0) return 0;
    return Math.round((this.completedFiles / this.totalFiles) * 100);
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

async function loadLayer(key) {
  if (loadedLayers[key]) return loadedLayers[key];
  if (loadingPromises[key]) return loadingPromises[key];

  const cfg = LAYERS[key];
  const url = `${GEOJSON_DIR}/${cfg.file}`;
  progress.setCurrent(cfg.file);

  loadingPromises[key] = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`404: ${cfg.file}`);
      const data = await response.json();

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

      const layer = L.geoJSON(data, options);
      loadedLayers[key] = layer;
      progress.completeFile();

      // Регистрируем в ClimateEngine, если нужно
      if (cfg.registerToClimate && window.ClimateEngine) {
        if (key === 'biomes') {
          window.ClimateEngine.register(layer, window.ClimateEngine.elevationLayer);
        } else if (key === 'elevation') {
          window.ClimateEngine.register(window.ClimateEngine.biomesLayer, layer);
        }
      }

      return layer;
    } catch (err) {
      console.error(err);
      progress.completeFile(true);
      throw err;
    } finally {
      delete loadingPromises[key];
    }
  })();

  return loadingPromises[key];
}

function toggleLayer(key, on) {
  if (on) {
    loadLayer(key).then(layer => {
      if (!map.hasLayer(layer)) layer.addTo(map);
    }).catch(() => {});
  } else if (loadedLayers[key] && map.hasLayer(loadedLayers[key])) {
    map.removeLayer(loadedLayers[key]);
  }
}

// ═══════════════════════════════════════════════════════
// 4. UI
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

  container.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', e => toggleLayer(e.target.dataset.key, e.target.checked));
  });
}

// ═══════════════════════════════════════════════════════
// 5. Утилиты
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

// ═══════════════════════════════════════════════════════
// 6. Обработчики фич
// ═══════════════════════════════════════════════════════
function onCountryFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'NAME_RU', 'NAME', 'ADMIN');
  const iso = pick(p, 'ISO_A3', 'ADM0_A3');
  const pop = fmtNum(pick(p, 'POP_EST'));

  const html = `
    <table class="info-table">
      <tr><td>Страна</td><td>${name}</td></tr>
      <tr><td>Код ISO</td><td>${iso}</td></tr>
      <tr><td>Население</td><td>${pop}</td></tr>
      <tr><td>Континент</td><td>${pick(p, 'CONTINENT')}</td></tr>
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
// 7. HUD биома при наведении
// ═══════════════════════════════════════════════════════
map.on('mousemove', (e) => {
  const biomeEl = document.getElementById('hud-biome');
  if (!biomeEl || !window.ClimateEngine || !window.ClimateEngine.loaded) return;
  const biome = window.ClimateEngine.getBiomeAt(e.latlng.lat, e.latlng.lng);
  biomeEl.textContent = biome || '—';
  biomeEl.style.color = biome === 'Unknown' ? '#888' : '#58d68d';
});

// ═══════════════════════════════════════════════════════
// 8. Сброс вида
// ═══════════════════════════════════════════════════════
document.getElementById('btn-reset-view').addEventListener('click', () => {
  if (loadedLayers.countries) {
    map.fitBounds(loadedLayers.countries.getBounds(), { padding: [20, 20] });
  }
});

// ═══════════════════════════════════════════════════════
// 9. Старт
// ═══════════════════════════════════════════════════════
buildUI();

// Обязательные слои для движка климата грузим в фоне,
// даже если они не включены в UI
const backgroundKeys = ['biomes', 'elevation'];
const initialKeys = Object.keys(LAYERS).filter(k => LAYERS[k].defaultOn);
const allToLoad = [...new Set([...initialKeys, ...backgroundKeys])];

progress.reset(allToLoad.length);

allToLoad.forEach(key => {
  loadLayer(key).then(layer => {
    // На карту добавляем только defaultOn
    if (LAYERS[key].defaultOn && !map.hasLayer(layer)) {
      layer.addTo(map);
    }
  }).catch(() => {});
});

loadLayer('countries').then(countries => {
  if (countries) map.fitBounds(countries.getBounds(), { padding: [20, 20] });
}).catch(() => {});
