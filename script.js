// ─────────── Инициализация карты ───────────
const map = L.map('map', {
  center: [20, 0],
  zoom: 2,
  minZoom: 2,
  maxZoom: 8,
  worldCopyJump: true,
  preferCanvas: true   // canvas быстрее для 10m-данных
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

// ─────────── Конфиг слоёв ───────────
const GEOJSON_DIR = 'geojson';

const LAYERS = {
  countries: {
    file: 'ne_10m_admin_0_countries.geojson',
    style: {
      fillColor: '#4a90e2', weight: 0.6, opacity: 1,
      color: '#2c5f8a', fillOpacity: 0.55
    },
    hoverStyle: {
      weight: 2, color: '#1a3d5c',
      fillColor: '#f39c12', fillOpacity: 0.85
    },
    onChange: onCountryFeature
  },
  cities: {
    file: 'ne_10m_populated_places.geojson',
    isPoints: true,
    onChange: onCityFeature
  },
  lakes: {
    file: 'ne_10m_lakes.geojson',
    style: {
      fillColor: '#3498db', weight: 0.5,
      color: '#1f5f8b', fillOpacity: 0.8
    },
    hoverStyle: { weight: 2, color: '#0d3d5c', fillOpacity: 0.95 },
    onChange: onLakeFeature
  }
};

// ─────────── Хранилище загруженных слоёв ───────────
const loadedLayers = {};  // { key: L.geoJSON }
const loadingPromises = {};

// ─────────── Универсальная загрузка ───────────
function loadLayer(key) {
  if (loadedLayers[key]) return Promise.resolve(loadedLayers[key]);
  if (loadingPromises[key]) return loadingPromises[key];

  const cfg = LAYERS[key];
  const url = `${GEOJSON_DIR}/${cfg.file}`;
  setStatus(`Загрузка ${cfg.file}…`);

  loadingPromises[key] = fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`${url} → ${r.status}`);
      return r.json();
    })
    .then(data => {
      const options = { onEachFeature: cfg.onChange };
      if (!cfg.isPoints) options.style = () => cfg.style;
      else {
        options.pointToLayer = (f, latlng) =>
          L.circleMarker(latlng, { radius: 3, fillColor: '#e74c3c',
            color: '#8b1a1a', weight: 1, fillOpacity: 0.8 });
      }

      const layer = L.geoJSON(data, options);
      loadedLayers[key] = layer;
      setStatus(`${cfg.file}: ${data.features.length} объектов`);
      console.log(`[${key}] загружено:`, data.features.length);
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

// ─────────── Управление видимостью ───────────
function toggleLayer(key, on) {
  if (on) {
    loadLayer(key).then(layer => { if (!map.hasLayer(layer)) layer.addTo(map); });
  } else if (loadedLayers[key] && map.hasLayer(loadedLayers[key])) {
    map.removeLayer(loadedLayers[key]);
  }
}

document.getElementById('toggleCountries').addEventListener('change', e =>
  toggleLayer('countries', e.target.checked));
document.getElementById('toggleCities').addEventListener('change', e =>
  toggleLayer('cities', e.target.checked));
document.getElementById('toggleLakes').addEventListener('change', e =>
  toggleLayer('lakes', e.target.checked));

// ─────────── Утилиты ───────────
function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function updateInfoPanel(html) {
  document.getElementById('countryInfo').innerHTML = html;
}

function pick(obj, ...keys) {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return '—';
}

function fmtNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('ru-RU') : '—';
}

// ─────────── Обработчики фич ───────────
function onCountryFeature(feature, layer) {
  const p = feature.properties || {};
  const name    = pick(p, 'NAME_RU', 'NAME', 'ADMIN', 'name');
  const code    = pick(p, 'ISO_A3', 'ADM0_A3', 'ISO_A2', 'iso_a3');
  const cont    = pick(p, 'CONTINENT', 'REGION_UN');
  const pop     = fmtNum(pick(p, 'POP_EST', 'pop_est'));
  const iso2    = pick(p, 'ISO_A2_EH', 'ISO_A2', 'iso_a2');

  layer.bindPopup(`
    <strong>${name}</strong><br>
    Код: ${code}${iso2 !== '—' ? ' / ' + iso2 : ''}<br>
    Континент: ${cont}<br>
    Население: ${pop}
  `);

  layer.on('mouseover', () => {
    layer.setStyle(LAYERS.countries.hoverStyle);
    layer.bringToFront();
    updateInfoPanel(`
      <p><strong>Страна:</strong> ${name}</p>
      <p><strong>Код:</strong> ${code}</p>
      <p><strong>Континент:</strong> ${cont}</p>
      <p><strong>Население:</strong> ${pop}</p>
    `);
  });

  layer.on('mouseout', () => {
    if (loadedLayers.countries) loadedLayers.countries.resetStyle(layer);
  });
}

function onCityFeature(feature, layer) {
  const p = feature.properties || {};
  const name  = pick(p, 'NAME_RU', 'NAME', 'name');
  const pop   = fmtNum(pick(p, 'POP_MAX', 'pop_max', 'POP_MIN'));
  const admin = pick(p, 'ADM0NAME', 'adm0name');
  const rank  = pick(p, 'SCALERANK', 'scalerank');

  // Показываем только крупные города
  if (rank !== '—' && Number(rank) > 5) {
    layer.setStyle({ display: 'none' });
    return;
  }

  layer.bindPopup(`
    <strong>${name}</strong><br>
    Страна: ${admin}<br>
    Население: ${pop}
  `);

  layer.on('mouseover', () => {
    layer.setStyle({ radius: 6, fillColor: '#c0392b' });
    updateInfoPanel(`
      <p><strong>Город:</strong> ${name}</p>
      <p><strong>Страна:</strong> ${admin}</p>
      <p><strong>Население:</strong> ${pop}</p>
    `);
  });

  layer.on('mouseout', () => {
    layer.setStyle({ radius: 3, fillColor: '#e74c3c' });
  });
}

function onLakeFeature(feature, layer) {
  const p = feature.properties || {};
  const name = pick(p, 'name', 'NAME', 'NAME_RU');

  layer.bindPopup(`<strong>Озеро:</strong> ${name}`);

  layer.on('mouseover', () => {
    layer.setStyle(LAYERS.lakes.hoverStyle);
    updateInfoPanel(`<p><strong>Озеро:</strong> ${name}</p>`);
  });

  layer.on('mouseout', () => {
    if (loadedLayers.lakes) loadedLayers.lakes.resetStyle(layer);
  });
}

// ─────────── Первая загрузка ───────────
loadLayer('countries')
  .then(layer => {
    layer.addTo(map);
    map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  })
  .catch(() => {});
