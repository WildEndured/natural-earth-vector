import { CONFIG } from './config.js';
import { getAllUnits } from './state.js';

export function resolveCollisions() {
    const allUnits = getAllUnits();
    for (let i = 0; i < allUnits.length; i++) {
        const a = allUnits[i];
        if (a.dead) continue;
        for (let j = i + 1; j < allUnits.length; j++) {
            const b = allUnits[j];
            if (b.dead) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const rA = a.radius * CONFIG.stanceModifiers[a.stance].collisionMult;
            const rB = b.radius * CONFIG.stanceModifiers[b.stance].collisionMult;
            const minDist = rA + rB + 1.5;
            const minDistSq = minDist * minDist;
            if (distSq < minDistSq && distSq > 0.001) {
                const dist = Math.sqrt(distSq);
                const overlap = (minDist - dist) / 2;
                const nx = dx / dist, ny = dy / dist;
                a.x -= nx * overlap; a.y -= ny * overlap;
                b.x += nx * overlap; b.y += ny * overlap;
            }
        }
    }
}
