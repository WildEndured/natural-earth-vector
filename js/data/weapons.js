export const WEAPONS = {
  ak74m: {
    name: 'АК-74М',
    caliber: '5.45×39',
    damage: 28,
    fireRate: 0.6,          // сек между выстрелами (100 выстр/мин)
    range: 300,             // метров — эффективная
    maxRange: 1000,         // метров — технический максимум
    accuracy: 0.85,
    magSize: 30,
    maxAmmo: 180,
    reloadTime: 2.5,
    bulletSpeed: 900,       // м/с
  },
  m4a1: {
    name: 'M4A1',
    caliber: '5.56×45',
    damage: 26,
    fireRate: 0.55,
    range: 300,
    maxRange: 800,
    accuracy: 0.85,
    magSize: 30,
    maxAmmo: 210,
    reloadTime: 2.2,
    bulletSpeed: 880,
  },
};
