// ==================== ИИ ВСЕХ ОТДЕЛЕНИЙ ====================

// ==================== ГРУППЫ США ====================
const USGroups = {
    A: 'fire', B: 'maneuver', roleNames: { fire: 'огонь', maneuver: 'маневр' }, _lastSwitch: 0,
    reset() { this.A = 'fire'; this.B = 'maneuver'; this._lastSwitch = 0; },
    switchRoles() {
        const now = performance.now();
        if (now - this._lastSwitch < 2000) return;
        this._lastSwitch = now;
        this.A = this.A === 'fire' ? 'maneuver' : 'fire';
        this.B = this.B === 'fire' ? 'maneuver' : 'fire';
        (typeof usUnits !== 'undefined' ? usUnits : []).forEach(u => {
            u._reachedFirePos = false; u._reachedManeuver = false; u._reachedBound = false;
            u._boundIndex = 0; u._bounds = null; u._firePos = null; u._maneuverPos = null;
            u.isSuppressing = false; u.phaseTimer = 0;
        });
        showStatus('🇺🇸 Смена ролей: огонь ↔ маневр');
        addReport('🇺🇸 Смена ролей', '#66ff66');
        const el = document.getElementById('us-groups');
        if (el) el.textContent = `А: ${this.roleNames[this.A]} · Б: ${this.roleNames[this.B]}`;
    },
    evaluateAndSwitch(usUnits) {
        const manGroupId = this.A === 'maneuver' ? 'A' : 'B';
        const manLeader = usUnits.find(u => u.groupId === manGroupId && u.role === 'team_leader' && !u.dead);
        if (manLeader && manLeader._bounds && !manLeader._reachedBound) return;
        const aliveA = usUnits.filter(u => !u.dead && u.groupId === 'A');
        const aliveB = usUnits.filter(u => !u.dead && u.groupId === 'B');
        if (this.A === 'fire' && aliveA.length < 2 && aliveB.length >= 2) this.switchRoles();
        else if (this.B === 'fire' && aliveB.length < 2 && aliveA.length >= 2) this.switchRoles();
        const el = document.getElementById('us-groups');
        if (el) el.textContent = `А: ${this.roleNames[this.A]} · Б: ${this.roleNames[this.B]}`;
    }
};

// ==================== ПРИНУДИТЕЛЬНЫЙ СБРОС MOVE TARGET ====================
// Если у подчинённого есть moveTarget, но он далеко (> 20 м) и это не ручной приказ,
// сбрасываем его. Это лечит "кучку" и "застревание".
function cleanupStaleOrders(alive, leader, isRussian, groupLeaders) {
    const leaderSet = new Set([leader]);
    if (isRussian) {
        if (groupLeaders.fire) leaderSet.add(groupLeaders.fire);
        if (groupLeaders.maneuver) leaderSet.add(groupLeaders.maneuver);
    } else {
        if (groupLeaders.A) leaderSet.add(groupLeaders.A);
        if (groupLeaders.B) leaderSet.add(groupLeaders.B);
    }
    
    alive.forEach(u => {
        if (leaderSet.has(u)) return;  // лидеров не трогаем
        if (u.manualControl) return;
        if (u._hasActiveOrder) return;
        if (u.moveTarget) {
            const d = Math.hypot(u.x - u.moveTarget.x, u.y - u.moveTarget.y);
            if (d > 20 || pointInObstacle(u.moveTarget.x, u.moveTarget.y)) {
                u.moveTarget = null;
            }
        }
    });
}

// ==================== ОСНОВНОЙ ИИ ====================
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
            u.radioJamTimer = CONFIG.radio.signalLossTime; 
        });
        showStatus(isRussian ? '🇷🇺 Потерян командир!' : '🇺🇸 Потерян командир!');
        addReport(isRussian ? 'Потерян командир РФ! Связь на 3 сек' : 'Потерян командир США!', '#ff4444');
    }
    if (leader.manualControl) return;

    leader.knownEnemies = leader.knownEnemies.filter(e => performance.now() - e.time < CONFIG.radio.enemyMemory * 1000);
    
    let groupLeaders = { A: null, B: null, fire: null, maneuver: null };
    if (!isRussian) {
        ['A', 'B'].forEach(g => {
            let gl = alive.find(u => u.groupId === g && u.role === 'team_leader');
            if (!gl) { 
                const cands = alive.filter(u => u.groupId === g); 
                if (cands.length) { 
                    gl = cands[0]; 
                    gl.role = 'team_leader'; 
                    gl.roleName = `И.о. ком. ${g}`; 
                } 
            }
            groupLeaders[g] = gl;
        });
    } else {
        groupLeaders.fire = alive.find(u => u.groupId === 'fire') || null;
        groupLeaders.maneuver = alive.find(u => u.groupId === 'maneuver') || null;
    }

    // === СБРОС УСТАРЕВШИХ ПРИКАЗОВ ===
    cleanupStaleOrders(alive, leader, isRussian, groupLeaders);

    // === КОМАНДИР ИДЁТ К ТОЧКЕ ===
    if (leader && !leader.target && !leader.manualControl) {
        if (leader.knownEnemies.length > 0) {
            const nearest = leader.knownEnemies.reduce((a, b) => (Math.hypot(a.x - leader.x, a.y - leader.y) < Math.hypot(b.x - leader.x, b.y - leader.y) ? a : b));
            leader.moveTarget = { x: nearest.x, y: nearest.y };
        } else { 
            leader.moveTarget = { x: objective.x, y: objective.y }; 
        }
    }

    // === ТАКТИКА ===
    if (isRussian) {
        const fl = groupLeaders.fire, ml = groupLeaders.maneuver;
        if (fl && !fl.manualControl) {
            if (!fl._firePos) {
                let fx = objective.x + 150, fy = objective.y - 150;
                if (pointInObstacle(fx, fy)) { fx = objective.x + 80; fy = objective.y - 80; }
                fl._firePos = { x: fx, y: fy };
            }
            if (!fl._reachedFirePos) {
                if (!fl.moveTarget) fl.moveTarget = { ...fl._firePos };
                if (Math.hypot(fl.x - fl._firePos.x, fl.y - fl._firePos.y) < 30) { 
                    fl._reachedFirePos = true; fl.moveTarget = null; fl.holding = true; fl.phaseTimer = 2.5; 
                    fl.report('position_reached', { group: 'fire' }); 
                    addReport('🇷🇺 Огневая группа на позиции', '#ffaa55'); 
                }
            } else {
                alive.filter(u => u.groupId === 'fire' && (!u.target || u.distanceTo(u.target) > u.weapon.effRange) && !u.manualControl).forEach(u => { 
                    u.isSuppressing = true; 
                    u.suppressionTargetPos = { x: objective.x, y: objective.y }; 
                });
            }
        }
        if (ml && !ml.manualControl) {
            const fireReady = fl && fl._reachedFirePos && fl.phaseTimer <= 0;
            if (!fireReady) { ml.holding = true; }
            else {
                ml.holding = false;
                if (!ml._bounds) { 
                    ml._bounds = [{ x: objective.x - 80, y: objective.y + 80 }, { x: objective.x - 40, y: objective.y + 40 }, { x: objective.x, y: objective.y }]; 
                    ml._boundIndex = 0; ml._reachedBound = false; 
                }
                const bound = ml._bounds[ml._boundIndex];
                if (!bound) {
                    alive.forEach(u => {
                        if (u.groupId === 'fire') u.groupId = 'maneuver'; 
                        else if (u.groupId === 'maneuver') u.groupId = 'fire';
                        u._reachedFirePos = false; u._reachedManeuver = false; u._reachedBound = false; 
                        u._boundIndex = 0; u._bounds = null; u._firePos = null; u._maneuverPos = null; 
                        u.isSuppressing = false; u.phaseTimer = 0;
                    });
                    addReport('🇷🇺 Смена ролей: огонь ↔ маневр', '#66ff66');
                } else if (!ml._reachedBound) {
                    if (!ml.moveTarget) ml.moveTarget = { ...bound };
                    if (Math.hypot(ml.x - bound.x, ml.y - bound.y) < 25) { 
                        ml._reachedBound = true; ml.moveTarget = null; ml.phaseTimer = 1.5; 
                        ml.report('position_reached', { group: 'maneuver', bound: ml._boundIndex }); 
                    }
                } else if (ml.phaseTimer <= 0) { ml._boundIndex++; ml._reachedBound = false; }
            }
        }
    } else {
        const fireGroupId = USGroups.A === 'fire' ? 'A' : 'B';
        const manGroupId = USGroups.A === 'maneuver' ? 'A' : 'B';
        const fireLeader = groupLeaders[fireGroupId], manLeader = groupLeaders[manGroupId];

        if (fireLeader && !fireLeader.manualControl) {
            if (!fireLeader._firePos) {
                const angle = fireGroupId === 'A' ? -Math.PI/4 : Math.PI/4;
                let fx = objective.x + Math.cos(angle) * 150, fy = objective.y + Math.sin(angle) * 150;
                if (pointInObstacle(fx, fy)) { fx = objective.x + Math.cos(angle) * 80; fy = objective.y + Math.sin(angle) * 80; }
                fireLeader._firePos = { x: fx, y: fy };
            }
            if (!fireLeader._reachedFirePos) {
                if (!fireLeader.moveTarget) fireLeader.moveTarget = { ...fireLeader._firePos };
                if (Math.hypot(fireLeader.x - fireLeader._firePos.x, fireLeader.y - fireLeader._firePos.y) < 30) { 
                    fireLeader._reachedFirePos = true; fireLeader.moveTarget = null; fireLeader.holding = true; fireLeader.phaseTimer = 2.5; 
                    fireLeader.report('position_reached', { group: fireGroupId }); 
                    addReport('🇺🇸 Fire-группа на позиции', '#66aaff'); 
                }
            } else {
                alive.filter(u => u.groupId === fireGroupId && (!u.target || u.distanceTo(u.target) > u.weapon.effRange) && !u.manualControl).forEach(u => { 
                    u.isSuppressing = true; 
                    u.suppressionTargetPos = { x: objective.x, y: objective.y }; 
                });
            }
        }
        if (manLeader && !manLeader.manualControl) {
            const fireReady = fireLeader && fireLeader._reachedFirePos && fireLeader.phaseTimer <= 0;
            if (!fireReady) { manLeader.holding = true; }
            else {
                manLeader.holding = false;
                if (!manLeader._bounds) {
                    const angle = manGroupId === 'A' ? -Math.PI/3 : Math.PI/3;
                    const bp = [{ x: objective.x + Math.cos(angle) * 80, y: objective.y + Math.sin(angle) * 80 }, { x: objective.x + Math.cos(angle) * 40, y: objective.y + Math.sin(angle) * 40 }, { x: objective.x, y: objective.y }];
                    manLeader._bounds = bp.map(p => pointInObstacle(p.x, p.y) ? { x: objective.x, y: objective.y } : p);
                    manLeader._boundIndex = 0; manLeader._reachedBound = false;
                }
                const bound = manLeader._bounds[manLeader._boundIndex];
                if (!bound) { 
                    addReport('🇺🇸 Maneuver достигла объекта', '#66ff66'); 
                    USGroups.switchRoles(); 
                } else if (!manLeader._reachedBound) {
                    if (!manLeader.moveTarget) manLeader.moveTarget = { ...bound };
                    if (Math.hypot(manLeader.x - bound.x, manLeader.y - bound.y) < 25) { 
                        manLeader._reachedBound = true; manLeader.moveTarget = null; manLeader.phaseTimer = 1.5; 
                        manLeader.report('position_reached', { group: manGroupId, bound: manLeader._boundIndex }); 
                    }
                } else if (manLeader.phaseTimer <= 0) { manLeader._boundIndex++; manLeader._reachedBound = false; }
            }
        }
    }

    // === ФОРМАЦИЯ ПО ГРУППАМ ===
    const clearStaleMove = (u) => {
        if (u.moveTarget && Math.hypot(u.x - u.moveTarget.x, u.y - u.moveTarget.y) > 50) u.moveTarget = null;
        if (u.moveTarget && pointInObstacle(u.moveTarget.x, u.moveTarget.y)) u.moveTarget = null;
    };

    if (isRussian) {
        const cmd = leader;
        const fl = groupLeaders.fire;
        const ml = groupLeaders.maneuver;
        
        if (cmd && !cmd.manualControl) {
            const cmdGroup = alive.filter(u => u !== cmd && u !== fl && u !== ml && u.groupId === 'cmd' && !u.manualControl && !u._hasActiveOrder);
            const total = Math.max(1, cmdGroup.length);
            cmdGroup.forEach((u, i) => {
                clearStaleMove(u);
                const angle = (i / total) * Math.PI * 2 + cmd.facing;
                u.formationPos = { x: cmd.x + Math.cos(angle) * 10, y: cmd.y + Math.sin(angle) * 10 };
            });
        }
        if (fl && !fl.manualControl) {
            const fireGroup = alive.filter(u => u !== fl && u.groupId === 'fire' && !u.manualControl && !u.isSuppressing && !u._hasActiveOrder);
            const total = Math.max(1, fireGroup.length);
            fireGroup.forEach((u, i) => {
                clearStaleMove(u);
                const angle = (i / total) * Math.PI * 2 + fl.facing;
                u.formationPos = { x: fl.x + Math.cos(angle) * 8, y: fl.y + Math.sin(angle) * 8 };
            });
        }
        if (ml && !ml.manualControl) {
            const manGroup = alive.filter(u => u !== ml && u.groupId === 'maneuver' && !u.manualControl && !u._hasActiveOrder);
            const total = Math.max(1, manGroup.length);
            manGroup.forEach((u, i) => {
                clearStaleMove(u);
                const angle = (i / total) * Math.PI * 2 + ml.facing;
                u.formationPos = { x: ml.x + Math.cos(angle) * 8, y: ml.y + Math.sin(angle) * 8 };
            });
        }
        if (cmd && !cmd.manualControl) {
            const crewGroup = alive.filter(u => u.groupId === 'crew' && !u.manualControl && !u._hasActiveOrder);
            crewGroup.forEach((u, i) => {
                clearStaleMove(u);
                const angle = cmd.facing + Math.PI + (i - 0.5) * 0.5;
                u.formationPos = { x: cmd.x + Math.cos(angle) * 15, y: cmd.y + Math.sin(angle) * 15 };
            });
        }
    } else {
        ['A', 'B'].forEach(gid => {
            const gl = groupLeaders[gid];
            if (!gl || gl.dead) return;
            const groupUnits = alive.filter(u => u.groupId === gid && u !== gl && !u.manualControl && !u.isSuppressing && !(u._bounds && u._bounds.length > 0) && !u._hasActiveOrder);
            const total = Math.max(1, groupUnits.length);
            groupUnits.forEach((u, i) => {
                clearStaleMove(u);
                const angle = (i / total) * Math.PI * 2 + gl.facing;
                u.formationPos = { x: gl.x + Math.cos(angle) * 8, y: gl.y + Math.sin(angle) * 8 };
            });
        });
        if (leader && !leader.manualControl) {
            const cmdGroup = alive.filter(u => u.groupId === 'cmd' && u !== leader && !u.manualControl && !u._hasActiveOrder);
            cmdGroup.forEach((u, i) => {
                clearStaleMove(u);
                const angle = leader.facing + Math.PI + (i - 0.5) * 0.5;
                u.formationPos = { x: leader.x + Math.cos(angle) * 10, y: leader.y + Math.sin(angle) * 10 };
            });
        }
        if (leader && !leader.manualControl) {
            ['A', 'B'].forEach(gid => {
                const gl = groupLeaders[gid];
                if (gl && !gl.dead && !gl.manualControl) {
                    const d = Math.hypot(gl.x - leader.x, gl.y - leader.y);
                    if (d > 60) {
                        gl.moveTarget = { x: leader.x + (Math.random()-0.5)*20, y: leader.y + (Math.random()-0.5)*20 };
                        gl._hasActiveOrder = true;
                        gl._reachedFirePos = false;
                        gl._reachedManeuver = false;
                        gl._bounds = null;
                        gl._boundIndex = 0;
                        gl.isSuppressing = false;
                    }
                }
            });
        }
    }

    const sniper = alive.find(u => u.weaponId === 'm110');
    if (sniper && leader && !sniper._hasSniperPos && !sniper.manualControl) { 
        const backAngle = leader.facing + Math.PI; 
        sniper.moveTarget = { x: leader.x + Math.cos(backAngle) * 40, y: leader.y + Math.sin(backAngle) * 40 }; 
        sniper._hasSniperPos = true; 
    }

    // === ОТЛАДКА (раскомментируйте для диагностики) ===
    /*
    if (!window._debugTimer) window._debugTimer = 0;
    window._debugTimer += dt;
    if (window._debugTimer > 0.5) {
        window._debugTimer = 0;
        const side = isRussian ? '🔴 РФ' : '🔵 США';
        console.groupCollapsed(`${side} | cmd=(${leader.x.toFixed(0)},${leader.y.toFixed(0)}) | fire=${groupLeaders.fire ? groupLeaders.fire.roleName : 'null'}, man=${groupLeaders.maneuver ? groupLeaders.maneuver.roleName : 'null'}`);
        alive.forEach(u => {
            const hasMove = u.moveTarget ? `(${u.moveTarget.x.toFixed(0)},${u.moveTarget.y.toFixed(0)})` : 'no';
            const hasForm = u.formationPos ? `(${u.formationPos.x.toFixed(0)},${u.formationPos.y.toFixed(0)})` : 'no';
            console.log(`${u.roleName.padEnd(25)} [${(u.groupId||'?').padEnd(8)}] pos=(${u.x.toFixed(0)},${u.y.toFixed(0)}) move=${hasMove.padEnd(12)} form=${hasForm.padEnd(12)} active=${u._hasActiveOrder} supp=${u.isSuppressing} state=${u.state}`);
        });
        console.groupEnd();
    }
    */
}

function updateUSAI(dt) { updateSquadAI(dt, usUnits, false); }
function updateRUAI(dt) { updateSquadAI(dt, ruUnits, true); }
