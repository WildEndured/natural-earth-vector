import { CONFIG } from './config.js';
import { ruUnits } from './state.js';

export const Formation = {
    current: 'march',
    apply(commander) {
        if (!commander || commander.dead) return;
        let dir = commander.facing;
        if (commander.moveTarget) {
            dir = Math.atan2(commander.moveTarget.y - commander.y, commander.moveTarget.x - commander.x);
        }
        const alive = ruUnits.filter(u => !u.dead);
        const followers = alive.filter(u => u !== commander);
        followers.sort((a, b) => a.roleName.localeCompare(b.roleName));
        const total = followers.length;

        if (this.current === 'march') {
            const backAngle = dir + Math.PI;
            followers.forEach((u, i) => {
                const distBack = (i + 1) * CONFIG.marchColumnGap;
                const lateralOffset = (i % 2 === 0 ? 1 : -1) * 2;
                const px = commander.x + Math.cos(backAngle) * distBack + Math.cos(backAngle + Math.PI/2) * lateralOffset;
                const py = commander.y + Math.sin(backAngle) * distBack + Math.sin(backAngle + Math.PI/2) * lateralOffset;
                u.moveTarget = { x: px, y: py };
                u.followTarget = null;
                u.holding = false;
                u.formationPos = { x: px, y: py };
            });
        } else {
            const perpAngle = dir + Math.PI / 2;
            followers.forEach((u, i) => {
                const idx = i - (total - 1) / 2;
                const lateral = idx * CONFIG.formationInterval;
                const backOffset = 4;
                const px = commander.x + Math.cos(perpAngle) * lateral + Math.cos(dir + Math.PI) * backOffset;
                const py = commander.y + Math.sin(perpAngle) * lateral + Math.sin(dir + Math.PI) * backOffset;
                u.moveTarget = { x: px, y: py };
                u.followTarget = null;
                u.holding = false;
                u.formationPos = { x: px, y: py };
            });
        }
    }
};
