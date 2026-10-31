// Части тела. HP в "единицах урона".
// vital — убивает при 0 HP
// hitWeight — вероятность попадания (сумма = 1.0)
// accuracyPenalty — штраф к точности при 0 HP
// speedPenalty — штраф к скорости при 0 HP
// bleedFactor — сколько крови теряется при уроне (×damage)
export const BODY_PARTS = {
  head: {
    name: 'Голова',
    hp: 25,
    vital: true,
    hitWeight: 0.08,
    accuracyPenalty: 0.20,
    speedPenalty: 0.10,
    bleedFactor: 0.5,
  },
  torso: {
    name: 'Торс',
    hp: 40,
    vital: true,
    hitWeight: 0.42,
    accuracyPenalty: 0.00,
    speedPenalty: 0.20,
    bleedFactor: 0.3,
  },
  leftArm: {
    name: 'Левая рука',
    hp: 30,
    vital: false,
    hitWeight: 0.12,
    accuracyPenalty: 0.30,
    speedPenalty: 0.00,
    bleedFactor: 0.25,
  },
  rightArm: {
    name: 'Правая рука',
    hp: 30,
    vital: false,
    hitWeight: 0.12,
    accuracyPenalty: 0.30,
    speedPenalty: 0.00,
    bleedFactor: 0.25,
  },
  leftLeg: {
    name: 'Левая нога',
    hp: 30,
    vital: false,
    hitWeight: 0.13,
    accuracyPenalty: 0.00,
    speedPenalty: 0.30,
    bleedFactor: 0.25,
  },
  rightLeg: {
    name: 'Правая нога',
    hp: 30,
    vital: false,
    hitWeight: 0.13,
    accuracyPenalty: 0.00,
    speedPenalty: 0.30,
    bleedFactor: 0.25,
  },
};

// Суммарный HP = 25 + 40 + 30*2 + 30*2 = 185
// Но "эффективный" = 65 (голова + торс) — убивает при 0

export const HEALTH_CONST = {
  bleedPerSec: 1.5,         // HP крови в секунду, если есть открытая рана
  bloodLossMax: 100,        // при 100 — смерть
  painDecayPerSec: 0.05,    // боль уходит со временем
  painAccuracyMult: 0.3,    // максимум штрафа к точности от боли
  painSpeedMult: 0.2,       // максимум штрафа к скорости от боли
  totalHpForUI: 185,        // для отображения в HUD
};
