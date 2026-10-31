export const BODY = {
  head:     { name: 'Голова',      hp: 25, vital: true,  hitWeight: 0.08, accPenalty: 0.20, speedPenalty: 0.10 },
  torso:    { name: 'Торс',        hp: 40, vital: true,  hitWeight: 0.42, accPenalty: 0.00, speedPenalty: 0.20 },
  leftArm:  { name: 'Левая рука',  hp: 30, vital: false, hitWeight: 0.12, accPenalty: 0.30, speedPenalty: 0.00 },
  rightArm: { name: 'Правая рука', hp: 30, vital: false, hitWeight: 0.12, accPenalty: 0.30, speedPenalty: 0.00 },
  leftLeg:  { name: 'Левая нога',  hp: 30, vital: false, hitWeight: 0.13, accPenalty: 0.00, speedPenalty: 0.30 },
  rightLeg: { name: 'Правая нога', hp: 30, vital: false, hitWeight: 0.13, accPenalty: 0.00, speedPenalty: 0.30 },
};

export const HEALTH = {
  bleedPerDamage: 0.3,
  painPerDamage: 0.005,
  painDecayPerSec: 0.02,
  bloodLossDeath: 100,
};
