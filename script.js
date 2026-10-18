// ═══════════════════════════════════════════════════════
// 1. Инициализация карты
// ═══════════════════════════════════════════════════════
const map = L.map('map', {
  center: [20, 0],
  zoom: 2,
  minZoom: 2,
  maxZoom: 8,
  worldCopyJump: true,
  preferCanvas: true   // критично для 10m-данных
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

// ═══════════════════════════════════════════════════════
// 2. Конфигурация слоёв (по реальным именам файлов)
// ═══════════════════════════════════════════════════════
const GEOJSON_DIR = 'geojson';

const LAYERS = {
  // ─── Группа «Страны» ───
  countries: {
    file: 'ne_10m_admin_0_countries.geojson',
    group: 'Политическая',
    label: 'Страны',
    defaultOn: true,
    type: 'polygon',
    style: { fillColor: '#4a90e2', weight: 0.6, color: '#2c5f8a', fillOpacity: 0.55 },
    hoverStyle: { weight: 2, color: '#1a3d5c', fillColor: '#f39c12', fillOpacity: 0.85 },
    onChange: onCountryFeature
  },
  boundaries: {
    file: 'ne_10m_admin_0_boundary_lines_land.geojson',
    group: 'Политическая',
    label: 'Границы (линии)',
    defaultOn: false,
    type: 'line',
    style: { color: '#2c3e50', weight: 1.2, opacity: 0.85 }
  },
  disputed: {
    file: 'ne_10m_admin_0_disputed_areas.geojson',
    group: 'Политическая',
    label: 'Спорные территории',
    defaultOn: false,
    type: 'polygon',
    style: { fillColor: '#e74c3c', weight: 1, color: '#8b1a1a', fillOpacity: 0.45 },
    hoverStyle: { weight: 2, fillOpacity: 0.7 },
    onChange: onDisputedFeature
  },
  states: {
    file: 'ne_10m_admin_1_states_provinces_lines.geojson',
    group: 'Политическая',
    label: 'Границы регионов',
    defaultOn: false,
    type: 'line',
    style: { color: '#7f8c8d', weight: 0.6, opacity: 0.7, dashArray: '3,3' }
  },

  // ─── Группа «Гидрография» ───
  lakes: {
    file: 'ne_10m_lakes.geojson',
    group: 'Гидрография',
    label: 'Озёра',
    defaultOn: true,
    type: 'polygon',
    style: { fillColor: '#3498db', weight: 0.5, color: '#1f5f8b', fillOpacity: 0.8 },
    hoverStyle: { weight: 2, color: '#0d3d5c', fillOpacity: 0.95 },
    onChange: onLakeFeature
  },
  rivers: {
    file: 'ne_10m_rivers_lake_centerlines.geojson',
    group: 'Гидрография',
    label: 'Реки',
    defaultOn: false,
    type: 'line',
    style: { color: '#2980b9', weight: 0.9, opacity: 0.85 }
  },
  coastline: {
    file: 'ne_10m_coastline.geojson',
    group: 'Гидрография',
    label: 'Береговая линия',
    defaultOn: false,
    type: 'line',
    style: { color: '#34495e', weight: 0.8, opacity: 0.9 }
  },
  marine: {
    file: 'ne_10m_geography_marine_polys.geojson',
    group: 'Гидрография',
    label: 'Моря и океаны',
    defaultOn: false,
    type: 'polygon',
    style: { fillColor: '#5dade2', weight: 0.5, color: '#2e86c1', fillOpacity: 0.3 },
    hoverStyle: { weight: 1.5, fillOpacity: 0.5 },
    onChange: onMarineFeature
  },

  // ─── Группа «Население и инфраструктура» ───
  cities: {
    file: 'ne_10m_populated_places_simple.geojson',
    group: 'Инфраструктура',
    label: 'Города',
    defaultOn: true,
    type: 'point',
    pointRadius: 3,
    pointColor: '#e74c3c',
    hoverPointRadius: 6,
    onChange: onCityFeature
  },
  airports: {
    file: 'ne_10m_airports.geojson',
    group: 'Инфраструктура',
    label: 'Аэропорты',
    defaultOn: false,
    type: 'point',
    pointRadius: 3,
    pointColor: '#8e44ad',
    hoverPointRadius: 6,
    onChange: onAirportFeature
  },
  ports: {
    file: 'ne_10m_ports.geojson',
    group: 'Инфраструктура',
    label: 'Порты',
    defaultOn: false,
    type: 'point',
    pointRadius: 3,
    pointColor: '#16a085',
    hoverPointRadius: 6,
    onChange: onPortFeature
  },
  urban: {
    file: 'ne_10m_urban_areas.geojson',
    group: 'Инфраструктура',
    label: 'Урбан-зоны',
    defaultOn: false,
    type: 'polygon',
    style: { fillColor: '#bdc3c7', weight: 0.3, color: '#7f8c8d', fillOpacity: 0.6 }
  },

  // ─── Группа «Природа» ───
  glaciers: {
    file: 'ne_10m_glaciated_areas.geojson',
    group: 'Природа',
    label: 'Ледники',
    defaultOn: false,
    type: 'polygon',
    style: { fillColor: '#ecf0f1', weight: 0.5, color: '#95a5a6', fillOpacity: 0.85 }
  },
  parks: {
    file: 'ne_10m_parks_and_protected_lands_area.geojson',
    group: 'Природа',
    label: 'Заповедники',
    defaultOn: false,
    type: 'polygon',
    style: { fillColor: '#27ae60', weight: 0.6, color: '#1e8449', fillOpacity: 0.4 },
    hoverStyle: { weight: 1.5, fillOpacity: 0.6 },
    onChange: onParkFeature
  },
  reefs: {
    file: 'ne_10m_reefs.geojson',
    group: 'Природа',
    label: 'Рифы',
    defaultOn: false,
    type: 'polygon',
    style: { fillColor: '#f39c12', weight: 0.5, color: '#b9770e', fillOpacity: 0.5 }
  },

  // ─── Группа «Справочные» ───
  graticules: {
    file: 'ne_10m_graticules_10.geojson',
    group: 'Справочные',
    label: 'Сетка 10°',
    defaultOn: false,
    type: 'line',
    style: { color: '#95a5a6', weight: 0.4, opacity: 0.6, dashArray: '2,4' }
  }
};

// ═══════════════════════════════════════════════════════
// 3. Хранилище и загрузка
// ═══════════════════════════════════════════════════════
const loadedLayers = {};
const loadingPromises = {};

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function loadLayer(key) {
  if (loadedLayers[key]) return Promise.resolve(loadedLayers[key]);
  if (loadingPromises[key]) return loadingPromises[key];

  const cfg = LAYERS[key];
  const url = `${GEOJSON_DIR}/${cfg.file}`;
  setStatus(`Загрузка: ${cfg.file}…`);

  loadingPromises[key] = fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`${url} → ${r.status}`);
      return r.json();
    })
    .then(data => {
      const options = { onEachFeature: cfg.onChange };

      if (cfg.type === 'point') {
        options.pointToLayer = (f, latlng) =>
          L.circleMarker(latlng, {
            radius: cfg.pointRadius || 3,
            fillColor: cfg.pointColor || '#e74c3c',
            color: '#333',
            weight: 0.8,
            fillOpacity: 0.85
          });
      } else {
        options.style = () => cfg.style;
      }

      const layer = L.geoJSON(data, options);
      loadedLayers[key] = layer;
      setStatus(`${cfg.file}: ${data.features.length} объектов`);
      console.log(`[${key}] загружено: ${data.features.length}`);
      return layer;
    })
    .catch(err => {
      console.error(err);
      setStatus(`Ошибка: ${err.message}`);
      throw err;
    })
    .finally(() => { delete loadingPromises[key]; });

  return loadingPromises[key];
}

function toggleLayer(key, on) {
  if (on) {
    loadLayer(key).then(layer => { if (!map.hasLayer(layer)) layer.addTo(map); });
  } else if (loadedLayers[key] && map.hasLayer(loadedLayers[key])) {
    map.removeLayer(loadedLayers[key]);
  }
}

// ═══════════════════════════════════════════════════════
// 4. UI: генерация чекбоксов по группам
// ═══════════════════════════════════════════════════════
function buildUI() {
  const controls = document.getElementById('controls');
  const groups = {};

  // Группируем
  Object.entries(LAYERS).forEach(([key, cfg]) => {
    const g = cfg.group || 'Прочее';
    if (!groups[g]) groups[g] = [];
    groups[g].push({ key, cfg });
  });

  // Рендерим
  Object.entries(groups).forEach(([groupName, items]) => {
    const div = document.createElement('div');
    div.className = 'group';
    div.innerHTML = `<div class="group-title">${groupName}</div>`;

    items.forEach(({ key, cfg }) => {
      const label = document.createElement('label');
      label.innerHTML = `
        <input type="checkbox" data-key="${key}" ${cfg.defaultOn ? 'checked' : ''} />
        <span>${cfg.label}</span>
      `;
      div.appendChild(label);
    });

    controls.insertBefore(div, document.getElementById('status'));
  });

  // Обработчики
  controls.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', e => toggleLayer(e.target.dataset.key, e.target.checked));
  });
}

// ═══════════════════════════════════════════════════════
// 5. Утилиты
// ═══════════════════════════════════════════════════════
function updateInfo(html) {
  document.getElementById('countryInfo').innerHTML = html;
}

function pick(obj, ...keys) {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  return '—';
}

function fmtNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('ru-RU') : '—';
}

function hoverBind(layer, cfg, infoHTML) {
  layer.on('mouseover', () => {
    if (cfg.hoverStyle) layer.setStyle(cfg.hoverStyle);
    else if (cfg.hoverPointRadius) layer.setStyle({ radius: cfg.hoverPointRadius });
    if (layer.bringToFront) layer.bringToFront();
    updateInfo(infoHTML);
  });

  layer.on('mouseout', () => {
    if (cfg.hoverStyle) {
      const parent = loadedLayers[Object.keys(loadedLayers).find(k => LAYERS[k] === cfg)];
      if (parent) parent.resetStyle(layer);
    } else if (cfg.hoverPointRadius) {
      layer.setStyle({ radius: cfg.pointRadius || 3 });
    }
  });
}

// ═══════════════════════════════════════════════════════
// 6. Обработчики конкретных фич
// ═══════════════════════════════════════════════════════
function onCountryFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'NAME_RU', 'NAME', 'ADMIN', 'name');
  const code = pick(p, 'ISO_A3', 'ADM0_A3', 'ISO_A2', 'iso_a3');
  const cont = pick(p, 'CONTINENT', 'REGION_UN');
  const pop  = fmtNum(pick(p, 'POP_EST', 'pop_est'));
  const area = fmtNum(pick(p, 'AREA_KM2'));
  const gdp  = fmtNum(pick(p, 'GDP_MD', 'gdp_md'));

  layer.bindPopup(`
    <strong>${name}</strong><br>
    Код: ${code}<br>
    Континент: ${cont}<br>
    Население: ${pop}<br>
    Площадь: ${area} км²
  `);

  hoverBind(layer, LAYERS.countries, `
    <p><strong>Страна:</strong> ${name}</p>
    <p><strong>Код:</strong> ${code}</p>
    <p><strong>Континент:</strong> ${cont}</p>
    <p><strong>Население:</strong> ${pop}</p>
    <p><strong>Площадь:</strong> ${area} км²</p>
    <p><strong>ВВП (млн $):</strong> ${gdp}</p>
  `);
}

function onDisputedFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'NAME_RU', 'NAME', 'name');
  const note = pick(p, 'NOTE_BRK', 'note_brk');
  layer.bindPopup(`<strong>Спорная:</strong> ${name}<br>${note}`);
  hoverBind(layer, LAYERS.disputed, `<p><strong>Спорная территория:</strong> ${name}</p><p>${note}</p>`);
}

function onLakeFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'name_ru', 'NAME_RU', 'name', 'NAME');
  const area = fmtNum(pick(p, 'scalerank'));
  layer.bindPopup(`<strong>Озеро:</strong> ${name}`);
  hoverBind(layer, LAYERS.lakes, `<p><strong>Озеро:</strong> ${name}</p>`);
}

function onMarineFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'name_ru', 'NAME_RU', 'name', 'NAME', 'featurecla');
  layer.bindPopup(`<strong>${name}</strong>`);
  hoverBind(layer, LAYERS.marine, `<p><strong>Море/океан:</strong> ${name}</p>`);
}

function onParkFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'name_ru', 'NAME_RU', 'name', 'NAME', 'unit_name');
  layer.bindPopup(`<strong>Заповедник:</strong> ${name}`);
  hoverBind(layer, LAYERS.parks, `<p><strong>Заповедник:</strong> ${name}</p>`);
}

function onCityFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'name_ru', 'NAME_RU', 'name', 'NAME');
  const pop  = fmtNum(pick(p, 'pop_max', 'POP_MAX', 'POP_MIN'));
  const adm  = pick(p, 'adm0name', 'ADM0NAME', 'ADM0_A3');
  const rank = pick(p, 'scalerank', 'SCALERANK');

  // Фильтр по рангу — оставляем только значимые города
  const maxRank = 5;
  if (rank !== '—' && Number(rank) > maxRank) {
    layer.setStyle({ radius: 0, fillOpacity: 0, weight: 0 });
    return;
  }

  layer.bindPopup(`
    <strong>${name}</strong><br>
    Страна: ${adm}<br>
    Население: ${pop}
  `);

  hoverBind(layer, LAYERS.cities, `
    <p><strong>Город:</strong> ${name}</p>
    <p><strong>Страна:</strong> ${adm}</p>
    <p><strong>Население:</strong> ${pop}</p>
  `);
}

function onAirportFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'name_ru', 'NAME_RU', 'name', 'NAME');
  const iata = pick(p, 'iata_code', 'IATA_CODE');
  const type = pick(p, 'type', 'TYPE');
  layer.bindPopup(`<strong>${name}</strong> (${iata})<br>Тип: ${type}`);
  hoverBind(layer, LAYERS.airports, `<p><strong>Аэропорт:</strong> ${name}</p><p>IATA: ${iata}</p><p>Тип: ${type}</p>`);
}

function onPortFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'name_ru', 'NAME_RU', 'name', 'NAME');
  layer.bindPopup(`<strong>Порт:</strong> ${name}`);
  hoverBind(layer, LAYERS.ports, `<p><strong>Порт:</strong> ${name}</p>`);
}

// ═══════════════════════════════════════════════════════
// 7. Старт
// ═══════════════════════════════════════════════════════
buildUI();

// Загружаем обязательные слои (страны + озёра + города)
Promise.all([
  loadLayer('countries'),
  loadLayer('lakes').catch(() => null),
  loadLayer('cities').catch(() => null)
]).then(([countries]) => {
  if (countries) {
    countries.addTo(map);
    map.fitBounds(countries.getBounds(), { padding: [20, 20] });
  }
  setStatus('Готово. Включайте нужные слои слева.');
}).catch(() => {});

// Загружаем остальные defaultOn слои
Object.entries(LAYERS).forEach(([key, cfg]) => {
  if (cfg.defaultOn && !['countries', 'lakes', 'cities'].includes(key)) {
    loadLayer(key).then(l => l.addTo(map)).catch(() => {});
  }
});
