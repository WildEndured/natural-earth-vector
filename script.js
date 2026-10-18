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

// Экспорт для weather.js
window.map = map;
window.loadedLayers = {};

// HUD координат
map.on('mousemove', (e) => {
  document.getElementById('hud-lat').textContent = e.latlng.lat.toFixed(4);
  document.getElementById('hud-lng').textContent = e.latlng.lng.toFixed(4);
});

document.getElementById('btn-reset-view').addEventListener('click', () => {
  if (window.loadedLayers.countries) {
    map.fitBounds(window.loadedLayers.countries.getBounds(), { padding: [20, 20] });
  }
});

// ═══════════════════════════════════════════════════════
// 2. Конфигурация слоёв (без изменений)
// ═══════════════════════════════════════════════════════
const GEOJSON_DIR = 'geojson';
const LAYERS = { /* ... оставляем как было ... */ };

// ═══════════════════════════════════════════════════════
// 3-7. Загрузка, UI, обработчики (без изменений)
// ═══════════════════════════════════════════════════════
// (тут оставьте весь старый код progress, loadLayer, toggleLayer, buildUI и т.д.)

// В конце загрузки:
buildUI();
const initialKeys = Object.keys(LAYERS).filter(k => LAYERS[k].defaultOn);
progress.reset(initialKeys.length);

initialKeys.forEach(key => {
  loadLayer(key).then(layer => { if (!map.hasLayer(layer)) layer.addTo(map); }).catch(() => {});
});

loadLayer('countries').then(countries => {
  if (countries) map.fitBounds(countries.getBounds(), { padding: [20, 20] });
}).catch(() => {});

// ═══════════════════════════════════════════════════════
// 8. Экспорт для weather.js
// ═══════════════════════════════════════════════════════
window.loadedLayers = loadedLayers;
