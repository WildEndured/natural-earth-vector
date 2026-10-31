// Радиус кольца — 5 м, расстояние между юнитами ~3 м
export function computeFormation(slot, { radius = 5, spacing = 1.6 } = {}) {
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
