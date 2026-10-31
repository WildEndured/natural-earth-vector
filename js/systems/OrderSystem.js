import { applyFormationOrder } from '../util/formation.js';

export class OrderSystem {
  constructor(ctx) {
    this.ctx = ctx;
  }

  issueMove(worldX, worldY) {
    const units = this.ctx.world.selectedUnits;
    if (units.length === 0) return;

    const leader = units.find(
      u => u.role === 'commander' || u.role === 'squad_leader'
    );

    if (leader && leader.squad) {
      leader.squad.setOrder('move', { x: worldX, y: worldY });
      const formationId = leader.squad.formation || 'line';
      applyFormationOrder(leader.squad, { x: worldX, y: worldY }, formationId);
      this.ctx.bus.emit('order:issued', {
        squad: leader.squad,
        order: 'move',
        target: { x: worldX, y: worldY },
        formation: formationId,
      });
    } else {
      const offsets = [];
      for (let i = 0; i < units.length; i++) {
        const angle = (i / units.length) * Math.PI * 2;
        const r = 3 + Math.floor(i / 6) * 3;
        offsets.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      }
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        u.moveTarget = { x: worldX + offsets[i].x, y: worldY + offsets[i].y };
        u.formationSlot = null;
      }
    }
  }

  issueAttack(worldX, worldY) {
    const enemy = this._findEnemyAt(worldX, worldY);
    if (!enemy) {
      this.issueMove(worldX, worldY);
      return;
    }
    const units = this.ctx.world.selectedUnits;
    for (const u of units) {
      u.target = enemy;
      u.moveTarget = null;
      u.formationSlot = null;
    }
  }

  issueHold() {
    const units = this.ctx.world.selectedUnits;
    for (const u of units) {
      u.moveTarget = null;
      u.formationSlot = null;
      u.state = 'hold';
    }
  }

  _findEnemyAt(worldX, worldY) {
    const tapRadius = 20;
    for (const u of this.ctx.world.units) {
      if (u.dead || u.team === 'RU') continue;
      const d = Math.hypot(u.x - worldX, u.y - worldY);
      if (d < u.radius + tapRadius) return u;
    }
    return null;
  }
}
