export const MAPS = {
  test: {
    id: 'test',
    name: '🧪 Тестовая (200×200 м)',
    width: 200,
    height: 200,
    objective: { radius: 20 },
    spawn: {
      RU: { x: 30, y: 170 },
      US: { x: 170, y: 30 },
    },
    cameraStart: { x: 100, y: 100, zoom: 4 },
    minZoom: 1,
    maxZoom: 10,
  },
  standard: {
    id: 'standard',
    name: '🗺 Стандартная (1000×1000 м)',
    width: 1000,
    height: 1000,
    objective: { radius: 30 },
    spawn: {
      RU: { x: 150, y: 850 },
      US: { x: 850, y: 150 },
    },
    cameraStart: { x: 500, y: 500, zoom: 2 },
    minZoom: 0.4,
    maxZoom: 8,
  },
};

export function getMap(id) {
  return MAPS[id] || MAPS.standard;
}
