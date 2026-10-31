const AK74M_BASE = {
  name: 'АК-74М',
  caliber: '5.45×39',
  magSize: 30,
  maxAmmo: 180,
  fireRate: 0.6,
  damage: 28,
  accuracy: 0.85,
  effRange: 300,
  maxRange: 1000,
  reloadTime: 2.5,
  weight: 3.6,
};

const M4A1_BASE = {
  name: 'M4A1',
  caliber: '5.56×45',
  magSize: 30,
  maxAmmo: 210,
  fireRate: 0.55,
  damage: 26,
  accuracy: 0.85,
  effRange: 300,
  maxRange: 800,
  reloadTime: 2.2,
  weight: 3.4,
};

export const WEAPONS = {
  ak74m: { ...AK74M_BASE },
  m4a1:  { ...M4A1_BASE },
};
