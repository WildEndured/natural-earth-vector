import { applyFormationOrder } from '../util/formation.js';

export class OrderSystem {
  constructor(ctx) {
    this.ctx = ctx;
  }

  _isPlayerUnit(u) {
    return u.team === this.ctx.playerTeam && !u.dead;
  }

  issueMove(worldX, worldY) {
    const units = this.ctx.world.selectedUnits.filter(u => this._isPlayerUnit(u));
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
      for (const u of units) {
        u.moveTarget = { x: worldX, y: worldY };
        u.formationSlot = null;
      }
    }
  }

  issueAttack(worldX, worldY) {
    const enemy = this._findEnemyAt(worldX, worldY);
    const units = this.ctx.world.selectedUnits.filter(u => this._isPlayerUnit(u));
    if (units.length === 0) return;

    if (!enemy) {
      this.issueMove(worldX, worldY);
      return;
    }
    for (const u of units) {
      u.target = enemy;
      u.moveTarget = null;
      u.formationSlot = null;
    }
  }

  issueHold() {
    const units = this.ctx.world.selectedUnits.filter(u => this._isPlayerUnit(u));
    for (const u of units) {
      u.moveTarget = null;
      u.formationSlot = null;
      u.state = 'hold';
    }
  }

  _findEnemyAt(worldX, worldY) {
    const tapRadius = 20;
    const myTeam = this.ctx.playerTeam;
    for (const u of this.ctx.world.units) {
      if (u.dead || u.team === myTeam) continue;
      const d = Math.hypot(u.x - worldX, u.y - worldY);
      if (d < u.radius + tapRadius) return u;
    }
    return null;
  }
}
