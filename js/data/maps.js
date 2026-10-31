import { OBSTACLE_TYPES } from './obstacles.js';

// ===== ГЕНЕРАТОР ПРЕПЯТСТВИЙ =====

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, a, b) {
  return a + (b - a) * rng();
}

function makeObstacle(type, x, y, w, h) {
  return { type, x, y, w, h };
}

// Проверить, пересекается ли прямоугольник с существующими
function overlaps(a, b, padding = 5) {
  return (
    a.x - a.w / 2 - padding < b.x + b.w / 2 &&
    a.x + a.w / 2 + padding > b.x - b.w / 2 &&
    a.y - a.h / 2 - padding < b.y + b.h / 2 &&
    a.y + a.h / 2 + padding > b.y - b.h / 2
  );
}

function tryPlace(rng, list, type, w, h, zone, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    const x = randRange(rng, zone.x0 + w / 2 + 5, zone.x1 - w / 2 - 5);
    const y = randRange(rng, zone.y0 + h / 2 + 5, zone.y1 - h / 2 - 5);
    const candidate = makeObstacle(type, x, y, w, h);
    // не ставим на точку
    const ox = zone.objectiveX, oy = zone.objectiveY, or = zone.objectiveR + 8;
    if (Math.hypot(candidate.x - ox, candidate.y - oy) < or + Math.max(w, h) / 2) continue;
    // не ставим на существующие
    let collide = false;
    for (const o of list) {
      if (overlaps(candidate, o)) { collide = true; break; }
    }
    if (!collide) return candidate;
  }
  return null;
}

// ===== ТЕСТОВАЯ КАРТА (200×200) — вручную =====
function generateTestObstacles() {
  return [
    // Дома в углах у spawn
    makeObstacle('house', 30, 170, 20, 15),
    makeObstacle('house', 170, 30, 20, 15),
    // Стены в центре
    makeObstacle('wall', 70, 100, 20, 2),
    makeObstacle('wall', 130, 100, 20, 2),
    makeObstacle('wall', 100, 70, 2, 20),
    makeObstacle('wall', 100, 130, 2, 20),
    // Деревья
    makeObstacle('tree', 50, 50, 3, 3),
    makeObstacle('tree', 150, 50, 3, 3),
    makeObstacle('tree', 50, 150, 3, 3),
    makeObstacle('tree', 150, 150, 3, 3),
    makeObstacle('tree', 100, 40, 3, 3),
    makeObstacle('tree', 100, 160, 3, 3),
  ];
}

// ===== ОТКРЫТАЯ (1000×1000) — 6 домов, 8 стен, 4 машины, 6 деревьев =====
function generateOpenObstacles(seed = 1) {
  const rng = mulberry32(seed);
  const list = [];
  const zone = {
    x0: 0, y0: 0, x1: 1000, y1: 1000,
    objectiveX: 500, objectiveY: 500, objectiveR: 30,
  };

  // 6 домов — крупных
  const housePlacements = [
    [250, 250], [750, 250], [250, 750], [750, 750], [500, 200], [500, 800],
  ];
  for (const [hx, hy] of housePlacements) {
    const w = randRange(rng, 25, 40);
    const h = randRange(rng, 18, 30);
    const candidate = makeObstacle('house', hx, hy, w, h);
    let collide = false;
    for (const o of list) if (overlaps(candidate, o, 10)) { collide = true; break; }
    if (!collide) list.push(candidate);
  }

  // 4 машины — где-то в поле
  for (let i = 0; i < 4; i++) {
    const c = tryPlace(rng, list, 'car', 5, 2.5, zone, 50);
    if (c) list.push(c);
  }

  // 8 стен
  for (let i = 0; i < 8; i++) {
    const horizontal = rng() < 0.5;
    const w = horizontal ? randRange(rng, 15, 30) : 2;
    const h = horizontal ? 2 : randRange(rng, 15, 30);
    const c = tryPlace(rng, list, 'wall', w, h, zone, 50);
    if (c) list.push(c);
  }

  // 6 деревьев
  for (let i = 0; i < 6; i++) {
    const c = tryPlace(rng, list, 'tree', 3, 3, zone, 50);
    if (c) list.push(c);
  }

  return list;
}

// ===== ЛЕС (1000×1000) — 80 деревьев, 15 кустов, 3 дома =====
function generateForestObstacles(seed = 2) {
  const rng = mulberry32(seed);
  const list = [];
  const zone = {
    x0: 0, y0: 0, x1: 1000, y1: 1000,
    objectiveX: 500, objectiveY: 500, objectiveR: 30,
  };

  // 3 дома — укрытия получше
  const housePlacements = [[300, 300], [700, 700], [500, 150]];
  for (const [hx, hy] of housePlacements) {
    const candidate = makeObstacle('house', hx, hy, 25, 20);
    let collide = false;
    for (const o of list) if (overlaps(candidate, o, 15)) { collide = true; break; }
    if (!collide) list.push(candidate);
  }

  // 80 деревьев
  for (let i = 0; i < 80; i++) {
    const c = tryPlace(rng, list, 'tree', 3, 3, zone, 20);
    if (c) list.push(c);
  }

  // 15 кустов (не блокируют движение, только визуал)
  for (let i = 0; i < 15; i++) {
    const c = tryPlace(rng, list, 'bush', 4, 4, zone, 20);
    if (c) list.push(c);
  }

  return list;
}

// ===== ГОРОД (1000×1000) — 12 домов, 20 стен, 10 машин =====
function generateCityObstacles(seed = 3) {
  const rng = mulberry32(seed);
  const list = [];
  const zone = {
    x0: 0, y0: 0, x1: 1000, y1: 1000,
    objectiveX: 500, objectiveY: 500, objectiveR: 30,
  };

  // 12 домов — сеткой
  const gridX = [150, 350, 550, 750, 900];
  const gridY = [150, 350, 550, 750, 900];
  let count = 0;
  for (const gx of gridX) {
    for (const gy of gridY) {
      if (count >= 12) break;
      const w = randRange(rng, 30, 50);
      const h = randRange(rng, 25, 40);
      const candidate = makeObstacle('house', gx, gy, w, h);
      if (Math.hypot(gx - 500, gy - 500) < 45 + Math.max(w, h) / 2) continue;
      let collide = false;
      for (const o of list) if (overlaps(candidate, o, 8)) { collide = true; break; }
      if (!collide) { list.push(candidate); count++; }
    }
    if (count >= 12) break;
  }

  // 10 машин
  for (let i = 0; i < 10; i++) {
    const c = tryPlace(rng, list, 'car', 5, 2.5, zone, 50);
    if (c) list.push(c);
  }

  // 20 стен
  for (let i = 0; i < 20; i++) {
    const horizontal = rng() < 0.5;
    const w = horizontal ? randRange(rng, 10, 25) : 2;
    const h = horizontal ? 2 : randRange(rng, 10, 25);
    const c = tryPlace(rng, list, 'wall', w, h, zone, 50);
    if (c) list.push(c);
  }

  return list;
}

// ===== РЕЕСТР КАРТ =====

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
    generateObstacles: generateTestObstacles,
  },
  open: {
    id: 'open',
    name: '🌾 Открытая (1000×1000 м)',
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
    generateObstacles: () => generateOpenObstacles(1),
  },
  forest: {
    id: 'forest',
    name: '🌲 Лес (1000×1000 м)',
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
    generateObstacles: () => generateForestObstacles(2),
  },
  city: {
    id: 'city',
    name: '🏙 Город (1000×1000 м)',
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
    generateObstacles: () => generateCityObstacles(3),
  },
};

export function getMap(id) {
  return MAPS[id] || MAPS.open;
    }
