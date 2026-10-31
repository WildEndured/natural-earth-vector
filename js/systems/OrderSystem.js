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
      applyFormationOrder(leader.squad, { x: worldX, y: worldY });
      this.ctx.bus.emit('order:issued', {
        squad: leader.squad,
        order: 'move',
        target: { x: worldX, y: worldY },
      });
    } else {
      for (const u of units) {
        u.moveTarget = { x: worldX, y: worldY };
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
    // радиус тапа 20 м — с учётом масштаба
    const tapRadius = 20;
    for (const u of this.ctx.world.units) {
      if (u.dead || u.team === 'RU') continue;
      const d = Math.hypot(u.x - worldX, u.y - worldY);
      if (d < u.radius + tapRadius) return u;
    }
    return null;
  }
}
