// ==================== AI.JS ====================
// Весь ИИ: тактика отделений (fire/maneuver), формация, обновление юнитов.
// Зависимости: config.js (TACTICS, STANCES, WORLD), entities.js (Soldier, Squad, dist, ...)
// GAME передаётся как аргумент — не глобальная зависимость.

const AI = {
    // ---------- Главный вход ----------
    updateAll(game, dt) {
        for (const squad of game.squads) AI.updateSquad(game, squad, dt);
    },
    
    // ---------- Отделение ----------
    updateSquad(game, squad, dt) {
        const alive = squad.aliveUnits();
        if (alive.length === 0) return;
        
        if (!squad.leader || squad.leader.dead) {
            if (!AI.promoteLeader(squad, game)) return;
            game.showStatus(squad.team === 'RU' ? '🇷🇺 Потерян командир!' : '🇺🇸 Потерян командир!');
        }
        
        const leader = squad.leader;
        if (leader.manualControl) return;
        
        // Память о врагах
        const now = performance.now();
        leader.knownEnemies = leader.knownEnemies.filter(e => now - e.time < TACTICS.radio.enemyMemory * 1000);
        
        // Приказ командиру
        if (!leader.target) {
            if (leader.knownEnemies.length > 0) {
                let nearest = leader.knownEnemies[0];
                let bestD = dist(leader, nearest);
                for (let i = 1; i < leader.knownEnemies.length; i++) {
                    const d = dist(leader, leader.knownEnemies[i]);
                    if (d < bestD) { bestD = d; nearest = leader.knownEnemies[i]; }
                }
                leader.moveTarget = { x: nearest.x, y: nearest.y };
            } else if (!leader.holding) {
                leader.moveTarget = { x: game.objective.x, y: game.objective.y };
            }
        }
        
        // Тактика
        if (squad.team === 'RU') AI.updateRUTactics(game, squad, dt);
        else AI.updateUSTactics(game, squad, dt);
        
        // Формация
        AI.updateFormation(squad);
    },
    
    // ---------- Назначение командира ----------
    promoteLeader(squad, game) {
        const alive = squad.aliveUnits();
        if (alive.length === 0) return false;
        // Приоритет: deputy > senior > любой
        const priorities = ['deputy', 'senior', 'rifleman', 'mg', 'grenadier', 'medic'];
        let newLeader = null;
        for (const role of priorities) {
            newLeader = alive.find(u => u.role === role);
            if (newLeader) break;
        }
        if (!newLeader) newLeader = alive[0];
        squad.leader = newLeader;
        newLeader.role = squad.team === 'RU' ? 'commander' : 'squad_leader';
        newLeader.roleName = 'И.о. ком. отделения';
        for (const u of alive) {
            u.panicTimer = 3.0;
            u.morale = Math.max(0, u.morale - TACTICS.morale.decayLeaderLoss);
            u.combatStress = Math.min(100, u.combatStress + 20);
            u.radioJamTimer = TACTICS.radio.signalLossTime;
        }
        return true;
    },
    
    // ---------- РФ: fire/maneuver ----------
    updateRUTactics(game, squad, dt) {
        const fireGroup = squad.aliveInGroup('fire');
        const manGroup = squad.aliveInGroup('maneuver');
        if (fireGroup.length === 0 || manGroup.length === 0) return;
        
        const fireLeader = fireGroup[0];
        const manLeader = manGroup[0];
        
        // Fire-группа: занять позицию и подавлять
        if (!fireLeader.manualControl && !fireLeader.target) {
            if (!squad._firePos) {
                let fx = game.objective.x + 150, fy = game.objective.y - 150;
                if (pointInAnyObstacle(fx, fy, game.obstacles)) { fx = game.objective.x + 80; fy = game.objective.y - 80; }
                squad._firePos = { x: fx, y: fy };
            }
            if (!fireLeader._reachedFirePos) {
                fireLeader.moveTarget = { ...squad._firePos };
                if (dist(fireLeader, squad._firePos) < 30) {
                    fireLeader._reachedFirePos = true;
                    fireLeader.moveTarget = null;
                    fireLeader.holding = true;
                    squad.phaseTimer = 2.5;
                }
            } else {
                for (const u of fireGroup) {
                    if (!u.target || dist(u, u.target) > u.weapon.effRange) {
                        u.isSuppressing = true;
                        u.suppressionTargetPos = { x: game.objective.x, y: game.objective.y };
                    }
                }
            }
        }
        
        // Maneuver-группа: ждать подавления, потом бросками
        if (!manLeader.manualControl && !manLeader.target) {
            const fireReady = squad._firePos && fireLeader._reachedFirePos && squad.phaseTimer <= 0;
            if (!fireReady) {
                manLeader.holding = true;
            } else {
                manLeader.holding = false;
                if (!squad._manBounds) {
                    squad._manBounds = [
                        { x: game.objective.x - 80, y: game.objective.y + 80 },
                        { x: game.objective.x - 40, y: game.objective.y + 40 },
                        { x: game.objective.x, y: game.objective.y }
                    ];
                    squad._manBoundIndex = 0;
                    manLeader._reachedBound = false;
                }
                if (squad._manBoundIndex >= squad._manBounds.length) {
                    AI.swapRURoles(squad, game);
                    return;
                }
                const bound = squad._manBounds[squad._manBoundIndex];
                if (!manLeader._reachedBound) {
                    manLeader.moveTarget = { ...bound };
                    if (dist(manLeader, bound) < 25) {
                        manLeader._reachedBound = true;
                        manLeader.moveTarget = null;
                        squad.phaseTimer = 1.5;
                    }
                } else if (squad.phaseTimer <= 0) {
                    squad._manBoundIndex++;
                    manLeader._reachedBound = false;
                }
            }
        }
    },
    
    swapRURoles(squad, game) {
        for (const u of squad.units) {
            if (u.dead) continue;
            if (u.groupId === 'fire') u.groupId = 'maneuver';
            else if (u.groupId === 'maneuver') u.groupId = 'fire';
        }
        squad.groups = {};
        for (const u of squad.units) {
            if (u.dead) continue;
            if (!squad.groups[u.groupId]) squad.groups[u.groupId] = [];
            squad.groups[u.groupId].push(u);
        }
        for (const u of squad.units) {
            u._reachedFirePos = false;
            u._reachedBound = false;
            u.isSuppressing = false;
            u.holding = false;
            u.moveTarget = null;
        }
        squad._firePos = null;
        squad._manBounds = null;
        squad._manBoundIndex = 0;
        game.showStatus('🇷🇺 Смена ролей: огонь ↔ маневр');
    },
    
    // ---------- США: fire/maneuver ----------
    updateUSTactics(game, squad, dt) {
        if (!squad._usRoles) squad._usRoles = { A: 'fire', B: 'maneuver' };
        const roles = squad._usRoles;
        const fireGroupId = roles.A === 'fire' ? 'A' : 'B';
        const manGroupId = roles.A === 'maneuver' ? 'A' : 'B';
        const fireGroup = squad.aliveInGroup(fireGroupId);
        const manGroup = squad.aliveInGroup(manGroupId);
        if (fireGroup.length === 0 || manGroup.length === 0) return;
        
        const fireLeader = fireGroup[0];
        const manLeader = manGroup[0];
        
        if (!fireLeader.manualControl && !fireLeader.target) {
            if (!squad._firePos) {
                const angle = fireGroupId === 'A' ? -Math.PI / 4 : Math.PI / 4;
                let fx = game.objective.x + Math.cos(angle) * 150;
                let fy = game.objective.y + Math.sin(angle) * 150;
                if (pointInAnyObstacle(fx, fy, game.obstacles)) { fx = game.objective.x; fy = game.objective.y; }
                squad._firePos = { x: fx, y: fy };
            }
            if (!fireLeader._reachedFirePos) {
                fireLeader.moveTarget = { ...squad._firePos };
                if (dist(fireLeader, squad._firePos) < 30) {
                    fireLeader._reachedFirePos = true;
                    fireLeader.moveTarget = null;
                    fireLeader.holding = true;
                    squad.phaseTimer = 2.5;
                }
            } else {
                for (const u of fireGroup) {
                    if (!u.target || dist(u, u.target) > u.weapon.effRange) {
                        u.isSuppressing = true;
                        u.suppressionTargetPos = { x: game.objective.x, y: game.objective.y };
                    }
                }
            }
        }
        
        if (!manLeader.manualControl && !manLeader.target) {
            const fireReady = squad._firePos && fireLeader._reachedFirePos && squad.phaseTimer <= 0;
            if (!fireReady) {
                manLeader.holding = true;
            } else {
                manLeader.holding = false;
                if (!squad._manBounds) {
                    const angle = manGroupId === 'A' ? -Math.PI / 3 : Math.PI / 3;
                    squad._manBounds = [
                        { x: game.objective.x + Math.cos(angle) * 80, y: game.objective.y + Math.sin(angle) * 80 },
                        { x: game.objective.x + Math.cos(angle) * 40, y: game.objective.y + Math.sin(angle) * 40 },
                        { x: game.objective.x, y: game.objective.y }
                    ];
                    squad._manBoundIndex = 0;
                    manLeader._reachedBound = false;
                }
                if (squad._manBoundIndex >= squad._manBounds.length) {
                    AI.swapUSRoles(squad, game);
                    return;
                }
                const bound = squad._manBounds[squad._manBoundIndex];
                if (!manLeader._reachedBound) {
                    manLeader.moveTarget = { ...bound };
                    if (dist(manLeader, bound) < 25) {
                        manLeader._reachedBound = true;
                        manLeader.moveTarget = null;
                        squad.phaseTimer = 1.5;
                    }
                } else if (squad.phaseTimer <= 0) {
                    squad._manBoundIndex++;
                    manLeader._reachedBound = false;
                }
            }
        }
    },
    
    swapUSRoles(squad, game) {
        squad._usRoles.A = squad._usRoles.A === 'fire' ? 'maneuver' : 'fire';
        squad._usRoles.B = squad._usRoles.B === 'fire' ? 'maneuver' : 'fire';
        for (const u of squad.units) {
            u._reachedFirePos = false;
            u._reachedBound = false;
            u.isSuppressing = false;
            u.holding = false;
            u.moveTarget = null;
        }
        squad._firePos = null;
        squad._manBounds = null;
        squad._manBoundIndex = 0;
        game.showStatus('🇺🇸 Смена ролей: огонь ↔ маневр');
    },
    
    // ---------- Формация (без O(n²)) ----------
    updateFormation(squad) {
        const alive = squad.aliveUnits();
        const leader = squad.leader;
        if (!leader || leader.dead) return;
        
        const excluded = new Set([leader]);
        if (squad.team === 'RU') {
            const fl = squad.aliveInGroup('fire')[0];
            const ml = squad.aliveInGroup('maneuver')[0];
            if (fl) excluded.add(fl);
            if (ml) excluded.add(ml);
        } else {
            const roles = squad._usRoles || { A: 'fire', B: 'maneuver' };
            const fId = roles.A === 'fire' ? 'A' : 'B';
            const mId = roles.A === 'maneuver' ? 'A' : 'B';
            const fl = squad.aliveInGroup(fId)[0];
            const ml = squad.aliveInGroup(mId)[0];
            if (fl) excluded.add(fl);
            if (ml) excluded.add(ml);
        }
        
        const followers = [];
        for (const u of alive) {
            if (excluded.has(u)) continue;
            if (u.manualControl) continue;
            if (u._hasActiveOrder) continue;
            if (u.isSuppressing) continue;
            if (u.moveTarget) continue;
            followers.push(u);
        }
        
        const total = Math.max(1, followers.length);
        for (let i = 0; i < followers.length; i++) {
            const u = followers[i];
            const angle = (i / total) * Math.PI * 2 + leader.facing;
            const radius = TACTICS.formationRadius * (i % 2 === 0 ? 1 : TACTICS.formationSpacing);
            u.formationSlot = {
                x: leader.x + Math.cos(angle) * radius,
                y: leader.y + Math.sin(angle) * radius
            };
        }
        for (const u of alive) {
            if (u === leader) continue;
            if (u.formationSlot && followers.indexOf(u) === -1) u.formationSlot = null;
        }
    },
    
    // ---------- Обновление одного юнита ----------
    updateUnit(game, u, dt) {
        if (u.dead) return;
        
        if (u.panicTimer > 0) u.panicTimer -= dt;
        if (u.radioJamTimer > 0) u.radioJamTimer -= dt;
        
        // Подавление
        if (u.suppressionLevel > 0) {
            u.suppressionLevel = Math.max(0, u.suppressionLevel - dt * TACTICS.suppressionDecay);
            u.suppressionTimer = Math.max(0, u.suppressionTimer - dt);
        }
        if (u.suppressionLevel > 10 && u.suppressionLevel <= 40 && u.recoveryTimer <= 0) u.recoveryTimer = TACTICS.suppressionRecovery;
        if (u.recoveryTimer > 0) u.recoveryTimer -= dt;
        
        // Мораль
        u.updateMorale(dt, game.allUnits);
        
        // Surrendered
        if (u.moraleState === 'surrendered') {
            u.state = 'surrendered';
            u.moveTarget = null; u.holding = false; u.target = null;
            u.setStance('stand');
            return;
        }
        
        // Routing
        if (u.moraleState === 'routing') {
            u.suppressionLevel = 0;
            const enemy = u.findEnemy(game.allUnits, game.obstacles, game.mapType, game._spatialHash);
            if (enemy) {
                const fleeAngle = Math.atan2(u.y - enemy.y, u.x - enemy.x);
                u.setStance('stand');
                u.facing = fleeAngle;
                if (!u._routingCover || Math.hypot(u._routingCover.x - u.x, u._routingCover.y - u.y) < 5) {
                    u._routingCover = nearestCoverPoint(u.x + Math.cos(fleeAngle) * 80, u.y + Math.sin(fleeAngle) * 80, game.obstacles, 80);
                }
                let tx, ty;
                if (u._routingCover) { tx = u._routingCover.x; ty = u._routingCover.y; }
                else {
                    const margin = 50;
                    const dL = u.x, dR = WORLD.width - u.x, dT = u.y, dB = WORLD.height - u.y;
                    if (dR > dL && dR > dT && dR > dB) { tx = WORLD.width - margin; ty = u.y; }
                    else if (dL > dT && dL > dB) { tx = margin; ty = u.y; }
                    else if (dT > dB) { tx = u.x; ty = margin; }
                    else { tx = u.x; ty = WORLD.height - margin; }
                }
                u.state = 'routing';
                u.moveTo(tx, ty, dt, game.obstacles);
            }
            return;
        }
        
        // Panicked
        if (u.moraleState === 'panicked') {
            u.setStance('prone');
            u.state = 'panicked';
            u.target = u.findEnemy(game.allUnits, game.obstacles, game.mapType, game._spatialHash);
            if (u.target && u.cooldown <= 0 && !u.isReloading && Math.random() < 0.3) {
                u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
                const shot = u.fire(game.allUnits);
                if (shot) game.handleShot(shot);
            }
            if (u.cooldown > 0) u.cooldown -= dt;
            return;
        }
        
        // Suppressed
        if (u.suppressionLevel > 40) {
            u.setStance('prone');
            u.state = 'suppressed';
            u.target = u.findEnemy(game.allUnits, game.obstacles, game.mapType, game._spatialHash);
            if (!u._coverTarget || dist(u, u._coverTarget) < 3) {
                u._coverTarget = nearestCoverPoint(u.x, u.y, game.obstacles, 20);
            }
            if (u._coverTarget) u.moveTo(u._coverTarget.x, u._coverTarget.y, dt * 0.5, game.obstacles);
            if (u.target && u.cooldown <= 0 && !u.isReloading && Math.random() < 0.5) {
                u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
                const shot = u.fire(game.allUnits);
                if (shot) game.handleShot(shot);
            }
            if (u.cooldown > 0) u.cooldown -= dt;
            return;
        }
        
        // Reload
        if (u.isReloading) {
            u.reloadTimer -= dt * (u.suppressionLevel > 40 ? 0.5 : 1.0);
            if (u.reloadTimer <= 0) u.isReloading = false;
            return;
        }
        
        // Отложенный приказ
        if (u.pendingOrder && (u.role === 'commander' || u.role === 'squad_leader')) {
            u.pendingOrder.time -= dt;
            if (u.pendingOrder.time <= 0) {
                if (u.pendingOrder.type === 'move') {
                    u.moveTarget = { x: u.pendingOrder.x, y: u.pendingOrder.y };
                    u.facing = Math.atan2(u.pendingOrder.y - u.y, u.pendingOrder.x - u.x);
                }
                u.pendingOrder = null;
            }
        }
        
        // Подавление огнём
        if (u.isSuppressing && u.suppressionTargetPos) {
            u.setStance('prone');
            u.facing = Math.atan2(u.suppressionTargetPos.y - u.y, u.suppressionTargetPos.x - u.x);
            if (u.cooldown <= 0 && !u.isReloading) {
                const shot = u.fireSuppression(game.allUnits);
                if (shot) game.bullets.spawn({ ...shot, life: 0.15, color: u.team === 'RU' ? '#ffdd55' : '#66ddff', isMG: true });
            }
            if (u.cooldown > 0) u.cooldown -= dt;
            return;
        }
        
        // Поиск цели
        u.target = u.findEnemy(game.allUnits, game.obstacles, game.mapType, game._spatialHash);
        if (u.target && !u._reportedTarget) {
            u.report('enemy_spotted', { x: u.target.x, y: u.target.y });
            u._reportedTarget = true;
        }
        
        // Прицеливание
        const moving = Math.hypot(u.x - u._lastX, u.y - u._lastY) > 0.05;
        u._lastX = u.x; u._lastY = u.y;
        const canAim = u.target && !moving && u.state !== 'moving' && u.suppressionLevel <= 40 && !u.isReloading && u.stance === u.desiredStance;
        if (canAim) u.aimTimer = Math.min(TACTICS.aimTime, u.aimTimer + dt);
        else u.aimTimer = Math.max(0, u.aimTimer - dt * 3);
        const aimT = u.aimTimer / TACTICS.aimTime;
        u.aimLevel = aimT * aimT * (3 - 2 * aimT);
        
        // Стойка
        u.autoSelectStance();
        if (u.stance !== u.desiredStance) {
            u.stanceTimer -= dt;
            if (u.stanceTimer <= 0) u.stance = u.desiredStance;
        }
        
        if (u.cooldown > 0) u.cooldown -= dt;
        if (u.muzzleFlash > 0) u.muzzleFlash -= dt;
        
        // Приоритет 1: ручной приказ
        if (u.moveTarget) {
            u.state = 'moving';
            const reached = u.moveTo(u.moveTarget.x, u.moveTarget.y, dt, game.obstacles);
            if (reached || pointInAnyObstacle(u.moveTarget.x, u.moveTarget.y, game.obstacles)) {
                u.moveTarget = null;
                u._hasActiveOrder = false;
            }
            return;
        }
        
        // Приоритет 2: атака
        if (u.target && dist(u, u.target) <= u.weapon.maxRange) {
            u.state = 'attacking';
            u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
            if (dist(u, u.target) <= u.weapon.effRange) {
                if (u.cooldown <= 0) {
                    const shot = u.fire(game.allUnits);
                    if (shot) game.handleShot(shot);
                }
            } else if (!u.holding) {
                u.moveTo(u.target.x, u.target.y, dt, game.obstacles);
            }
            return;
        }
        
        // Приоритет 3: держать
        if (u.holding) { u.state = 'holding'; return; }
        
        // Приоритет 4: формация
        if (u.formationSlot) {
            const d = Math.hypot(u.formationSlot.x - u.x, u.formationSlot.y - u.y);
            if (d > 3) {
                u.state = 'moving';
                u.moveTo(u.formationSlot.x, u.formationSlot.y, dt, game.obstacles);
            } else u.state = 'idle';
            return;
        }
        
        u.state = 'idle';
    }
};
