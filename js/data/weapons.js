// Все дистанции в метрах.
// accuracyCurve — множители шанса по дистанции:
//   near   — до 50 м
//   mid    — 50-200 м
//   far    — 200-400 м
//   max    — 400+ м (до maxRange)
// spread — разброс в метрах (на 100 м), растёт с дистанцией
// burst — размер очереди (1 = одиночный)
export const WEAPONS = {
  ak74m: {
    name: 'АК-74М',
    caliber: '5.45×39',
    damage: 28,
    fireRate: 0.6,
    range: 400,
    maxRange: 1000,
    accuracy: 0.85,
    accuracyCurve: { near: 1.15, mid: 1.0, far: 0.6, max: 0.3 },
    spread: 2.5,
    burst: 1,
    magSize: 30,
    maxAmmo: 180,
    reloadTime: 2.5,
  },
  m4a1: {
    name: 'M4A1',
    caliber: '5.56×45',
    damage: 26,
    fireRate: 0.55,
    range: 400,
    maxRange: 800,
    accuracy: 0.85,
    accuracyCurve: { near: 1.1, mid: 1.0, far: 0.65, max: 0.35 },
    spread: 2.2,
    burst: 1,
    magSize: 30,
    maxAmmo: 210,
    reloadTime: 2.2,
  },
  pkm: {
    name: 'ПКП «Печенег»',
    caliber: '7.62×54R',
    damage: 22,
    fireRate: 0.12,
    range: 800,
    maxRange: 1500,
    accuracy: 0.70,
    accuracyCurve: { near: 0.85, mid: 1.0, far: 0.85, max: 0.5 },
    spread: 4.0,
    burst: 1,
    magSize: 100,
    maxAmmo: 400,
    reloadTime: 12.0,
  },
  svd: {
    name: 'СВД',
    caliber: '7.62×54R',
    damage: 65,
    fireRate: 1.8,
    range: 800,
    maxRange: 1500,
    accuracy: 0.90,
    accuracyCurve: { near: 0.7, mid: 0.95, far: 1.0, max: 0.7 },
    spread: 0.8,
    burst: 1,
    magSize: 10,
    maxAmmo: 60,
    reloadTime: 4.0,
  },
  m249: {
    name: 'M249 SAW',
    caliber: '5.56×45',
    damage: 18,
    fireRate: 0.10,
    range: 600,
    maxRange: 1000,
    accuracy: 0.75,
    accuracyCurve: { near: 0.8, mid: 1.0, far: 0.75, max: 0.4 },
    spread: 4.5,
    burst: 1,
    magSize: 200,
    maxAmmo: 600,
    reloadTime: 6.0,
  },
  m110: {
    name: 'M110 SASS',
    caliber: '7.62×51',
    damage: 60,
    fireRate: 1.8,
    range: 800,
    maxRange: 1500,
    accuracy: 0.92,
    accuracyCurve: { near: 0.65, mid: 0.95, far: 1.0, max: 0.75 },
    spread: 0.6,
    burst: 1,
    magSize: 10,
    maxAmmo: 60,
    reloadTime: 4.0,
  },
};

// Получить множитель шанса по дистанции
export function accuracyByDistance(weapon, dist) {
  const curve = weapon.accuracyCurve;
  if (dist < 50) return curve.near;
  if (dist < 200) {
    const t = (dist - 50) / 150;
    return curve.near + (curve.mid - curve.near) * t;
  }
  if (dist < 400) {
    const t = (dist - 200) / 200;
    return curve.mid + (curve.far - curve.mid) * t;
  }
  // 400+ — до maxRange
  const maxDist = weapon.maxRange;
  if (dist >= maxDist) return 0;
  const t = (dist - 400) / (maxDist - 400);
  return curve.far + (curve.max - curve.far) * t;
}

// Разброс в метрах на дистанции dist
export function spreadAtDistance(weapon, dist) {
  // базовый spread — на 100 м
  return weapon.spread * (dist / 100);
}
