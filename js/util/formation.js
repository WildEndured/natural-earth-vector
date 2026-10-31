// Радиус кольца — 7 м, spacing 1.3
// 10 юнитов: центр (1) + первое кольцо (8) + второе кольцо (1 слот)
// По факту для 10: лидер + 9 вокруг, радиус первого кольца ~9 м
export function computeFormation(slot, { radius = 7, spacing = 1.3 } = {}) {
  if (slot === 0) return { x: 0, y: 0 };
  const angle = ((slot - 1) / 8) * Math.PI * 2;
  const ring = Math.floor((slot - 1) / 8) + 1;
  const r = radius * ring * spacing;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

export function applyFormationOrder(squad, target) {
  const alive = squad.aliveUnits;
  for (let i = 0; i < alive.length; i++) {
    const u = alive[i];
    const offset = computeFormation(i);
    u.formationSlot = { x: target.x + offset.x, y: target.y + offset.y };
    u.moveTarget = { x: u.formationSlot.x, y: u.formationSlot.y };
  }
}
