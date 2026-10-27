import { CONFIG, USGroups } from './config.js';
import { getRuUnits, getUsUnits } from './state.js';

function updateSquadAI(dt, units, isRussian) {
    const alive = units.filter(u => !u.dead);
    if (alive.length === 0) return;

    if (!isRussian) USGroups.evaluateAndSwitch(units);

    let leader = alive.find(u => u.role === 'commander' || u.role === 'squad_leader');
    if (!leader) {
        leader = alive[0];
        leader.role = isRussian ? 'commander' : 'squad_leader';
        leader.roleName = 'И.о. ком. отделения';
        alive.forEach(u => {
            u.panicTimer = 3.0;
            u.morale = Math.max(0, u.morale - CONFIG.morale.decayLeaderLoss);
            u.combatStress = Math.min(100, u.combatStress + 20);
        });
        if (window.showStatus) window.showStatus(isRussian ? '🇷🇺 Потерян командир!' : '🇺🇸 Потерян командир!');
    }
    if (leader.manualControl) return;

    let groupLeaders = { A: null, B: null };
    if (!isRussian) {
        ['A', 'B'].forEach(g => {
            let gl = alive.find(u => u.groupId === g && u.role === 'team_leader');
            if (!gl) {
                const cands = alive.filter(u => u.groupId === g);
                if (cands.length) { gl = cands[0]; gl.role = 'team_leader'; gl.roleName = `И.о. ком. ${g}`; }
            }
            groupLeaders[g] = gl;
        });
    } else {
        groupLeaders.fire = alive.find(u => u.groupId === 'fire' && u.role !== 'commander') || null;
        groupLeaders.maneuver = alive.find(u => u.groupId === 'maneuver' && u.role !== 'commander') || null;
    }

    // ... (полный код ИИ из game.js)
    // Скопируйте из game.js блок updateSquadAI() целиком.
}

export function updateUSAI(dt) { updateSquadAI(dt, getUsUnits(), false); }
export function updateRUAI(dt) { updateSquadAI(dt, getRuUnits(), true); }
