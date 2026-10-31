import { FORMATIONS, DEFAULT_FORMATION, rotateOffset } from '../data/formations.js';

// Применить формацию к отряду относительно точки target.
// facing — куда смотрит лидер (по умолчанию на точку).
export function applyFormationOrder(squad, target, formationId = null) {
  const alive = squad.aliveUnits;
  if (alive.length === 0) return;

  const formation = FORMATIONS[formationId || squad.formation || DEFAULT_FORMATION];
  if (!formation) return;

  // facing — направление от текущего центра отряда к цели
  let facing = 0;
  const leader = squad.leader && !squad.leader.dead ? squad.leader : alive[0];
  if (leader) {
    facing = Math.atan2(target.y - leader.y, target.x - leader.x);
  }

  const offsets = formation.generate(alive.length);

  for (let i = 0; i < alive.length; i++) {
    const u = alive[i];
    const off = rotateOffset(offsets[i], facing);
    u.formationSlot = {
      x: target.x + off.x,
      y: target.y + off.y,
    };
    u.moveTarget = { x: u.formationSlot.x, y: u.formationSlot.y };
  }
}

// Сменить формацию отряда БЕЗ приказа движения —
// пересчитать слоты относительно текущей позиции лидера.
export function reformatInPlace(squad, formationId) {
  const alive = squad.aliveUnits;
  if (alive.length === 0) return;

  const formation = FORMATIONS[formationId];
  if (!formation) return;

  const leader = squad.leader && !squad.leader.dead ? squad.leader : alive[0];
  if (!leader) return;

  const facing = leader.facing || 0;
  const offsets = formation.generate(alive.length);

  for (let i = 0; i < alive.length; i++) {
    const u = alive[i];
    const off = rotateOffset(offsets[i], facing);
    u.formationSlot = {
      x: leader.x + off.x,
      y: leader.y + off.y,
    };
    u.moveTarget = { x: u.formationSlot.x, y: u.formationSlot.y };
  }
}
