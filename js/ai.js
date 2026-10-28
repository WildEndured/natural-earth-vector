// ==================== AI.JS ====================

const LEADER_PRIORITIES = ['deputy', 'senior', 'rifleman', 'mg', 'grenadier', 'medic']; // AI-9

const AI = {
    updateAll(game, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        if (dt > 0.1) dt = 0.1; // AI-1
        const squads = game.squads;
        for (let i = 0, n = squads.length; i < n; i++) AI.updateSquad(game, squads[i], dt);
    },

    updateSquad(game, squad, dt) {
        const alive = squad.aliveUnits();
        if (alive.length === 0) return;

        if (!squad.leader || squad.leader.dead) {
            if (!AI.promoteLeader(squad, game)) return;
            game.showStatus(squad.team === 'RU' ? '🇷🇺 Потерян командир!' : '🇺🇸 Потерян командир!');
        }

        const leader = squad.leader;

        const squadVehicle = game.vehicles.find(v => v.team === squad.team && !v.dead);
        if (squadVehicle) {
            if (squadVehicle.driver === leader || (leader.inVehicle === squadVehicle)) {
                if (!squadVehicle.moveTarget && !squadVehicle.engineBroken) squadVehicle.moveTarget = { x: game.objective.x, y: game.objective.y };
                if (squadVehicle.passengers.length > 0) {
                    if (dist(squadVehicle, game.objective) < 120 || squadVehicle.isBurning) {
                        squadVehicle.unloadAll();
                        squadVehicle.moveTarget = null;
                        game.showStatus(squad.team === 'RU' ? '🇷🇺 Десант высадился!' : '🇺🇸 Десант высадился!');
                    }
                }
            }
        }

        if (leader.manualControl) return;
        const now = performance.now();
        // AI-6: in-place filter для knownEnemies
        const memTime = TACTICS.radio.enemyMemory * 1000;
        const ke = leader.knownEnemies;
        let w = 0;
        for (let i = 0, n = ke.length; i < n; i++) {
            if (now - ke[i].time < memTime) ke[w++] = ke[i];
        }
        ke.length = w;

        if (!leader.target) {
            if (leader.knownEnemies.length > 0) {
                let nearest = leader.knownEnemies[0], bestD = dist(leader, nearest);
                for (let i = 1; i < leader.knownEnemies.length; i++) {
                    const d = dist(leader, leader.knownEnemies[i]);
                    if (d < bestD) { bestD = d; nearest = leader.knownEnemies[i]; }
                }
                leader.moveTarget = { x: nearest.x, y: nearest.y };
            } else if (!leader.holding && !leader.inVehicle) leader.moveTarget = { x: game.objective.x, y: game.objective.y };
        }

        if (squad.team === 'RU') AI.updateRUTactics(game, squad, dt);
        else AI.updateUSTactics(game, squad, dt);

        AI.updateFormation(squad);
    },

    promoteLeader(squad, game) {
        const alive = squad.aliveUnits().filter(u => !u.inVehicle);
        if (alive.length === 0) return false;
        let newLeader = null;
        for (let i = 0; i < LEADER_PRIORITIES.length; i++) {
            const role = LEADER_PRIORITIES[i];
            for (let j = 0; j < alive.length; j++) if (alive[j].role === role) { newLeader = alive[j]; break; }
            if (newLeader) break;
        }
        if (!newLeader) newLeader = alive[0];
        squad.leader = newLeader;
        newLeader.role = squad.team === 'RU' ? 'commander' : 'squad_leader';
        newLeader.roleName = 'И.о. ком. отделения';
        for (let i = 0; i < alive.length; i++) {
            const u = alive[i];
            u.panicTimer = 3.0;
            u.morale = Math.max(0, u.morale - TACTICS.morale.decayLeaderLoss);
            u.combatStress = Math.min(100, u.combatStress + 20);
            u.radioJamTimer = TACTICS.radio.signalLossTime;
        }
        return true;
    },

    // AI-8: объединённая тактика
    _updateBoundingTactics(game, squad, fireGroupId, manGroupId, fireAngle, manAngle, swapFn) {
        const fireGroup = squad.aliveInGroup(fireGroupId).filter(u => !u.inVehicle);
        const manGroup = squad.aliveInGroup(manGroupId).filter(u => !u.inVehicle);
        if (fireGroup.length === 0 || manGroup.length === 0) return;

        const fireLeader = fireGroup[0], manLeader = manGroup[0];

        if (!fireLeader.manualControl && !fireLeader.target) {
            if (!squad._firePos) {
                let fx = game.objective.x + Math.cos(fireAngle) * 150;
                let fy = game.objective.y + Math.sin(fireAngle) * 150;
                if (pointInAnyObstacle(fx, fy, game.obstacles)) { fx = game.objective.x; fy = game.objective.y; }
                squad._firePos = { x: fx, y: fy };
            }
            if (!fireLeader._reachedFirePos) {
                fireLeader.moveTarget = { ...squad._firePos };
                if (dist(fireLeader, squad._firePos) < 30) { fireLeader._reachedFirePos = true; fireLeader.moveTarget = null; fireLeader.holding = true; squad.phaseTimer = 2.5; }
            } else {
                for (let i = 0; i < fireGroup.length; i++) {
                    const u = fireGroup[i];
                    if (!u.target || dist(u, u.target) > u.weapon.effRange) {
                        u.isSuppressing = true;
                        u.suppressionTargetPos = { x: game.objective.x, y: game.objective.y };
                    }
                }
            }
        }

        if (!manLeader.manualControl && !manLeader.target) {
            const fireReady = squad._firePos && fireLeader._reachedFirePos && squad.phaseTimer <= 0;
            if (!fireReady) manLeader.holding = true;
            else {
                manLeader.holding = false;
                if (!squad._manBounds) {
                    squad._manBounds = [
                        { x: game.objective.x + Math.cos(manAngle) * 80, y: game.objective.y + Math.sin(manAngle) * 80 },
                        { x: game.objective.x + Math.cos(manAngle) * 40, y: game.objective.y + Math.sin(manAngle) * 40 },
                        { x: game.objective.x, y: game.objective.y }
                    ];
                    squad._manBoundIndex = 0;
                    manLeader._reachedBound = false;
                }
                if (squad._manBoundIndex >= squad._manBounds.length) { swapFn(squad, game); return; }
                const bound = squad._manBounds[squad._manBoundIndex];
                if (!manLeader._reachedBound) {
                    manLeader.moveTarget = { ...bound };
                    if (dist(manLeader, bound) < 25) { manLeader._reachedBound = true; manLeader.moveTarget = null; squad.phaseTimer = 1.5; }
                } else if (squad.phaseTimer <= 0) { squad._manBoundIndex++; manLeader._reachedBound = false; }
            }
        }
    },

    updateRUTactics(game, squad, dt) {
        const fireAngle = Math.atan2(-150, 150);
        const manAngle = Math.atan2(80, -80);
        AI._updateBoundingTactics(game, squad, 'fire', 'maneuver', fireAngle, manAngle, AI.swapRURoles);
    },

    swapRURoles(squad, game) {
        for (let i = 0; i < squad.units.length; i++) {
            const u = squad.units[i];
            if (u.dead || u.inVehicle) continue;
            if (u.groupId === 'fire') u.groupId = 'maneuver';
            else if (u.groupId === 'maneuver') u.groupId = 'fire';
        }
        squad.groups = {};
        for (let i = 0; i < squad.units.length; i++) {
            const u = squad.units[i];
            if (u.dead || u.inVehicle) continue;
            if (!squad.groups[u.groupId]) squad.groups[u.groupId] = [];
            squad.groups[u.groupId].push(u);
        }
        AI._resetTacticsFlags(squad);
        game.showStatus('🇷🇺 Смена ролей: огонь ↔ маневр');
    },

    updateUSTactics(game, squad, dt) {
        if (!squad._usRoles) squad._usRoles = { A: 'fire', B: 'maneuver' };
        const roles = squad._usRoles;
        const fireGroupId = roles.A === 'fire' ? 'A' : 'B';
        const manGroupId = roles.A === 'maneuver' ? 'A' : 'B';
        const fireAngle = fireGroupId === 'A' ? -Math.PI / 4 : Math.PI / 4;
        const manAngle = manGroupId === 'A' ? -Math.PI / 3 : Math.PI / 3;
        AI._updateBoundingTactics(game, squad, fireGroupId, manGroupId, fireAngle, manAngle, AI.swapUSRoles);
    },

    swapUSRoles(squad, game) {
        squad._usRoles.A = squad._usRoles.A === 'fire' ? 'maneuver' : 'fire';
        squad._usRoles.B = squad._usRoles.B === 'fire' ? 'maneuver' : 'fire';
        AI._resetTacticsFlags(squad);
        game.showStatus('🇺🇸 Смена ролей: огонь ↔ маневр');
    },

    _resetTacticsFlags(squad) {
        for (let i = 0; i < squad.units.length; i++) {
            const u = squad.units[i];
            u._reachedFirePos = false;
            u._reachedBound = false;
            u.isSuppressing = false;
            u.holding = false;
            u.moveTarget = null;
        }
        squad._firePos = null;
        squad._manBounds = null;
        squad._manBoundIndex = 0;
    },

    updateFormation(squad) {
        const alive = squad.aliveUnits().filter(u => !u.inVehicle);
        const leader = squad.leader;
        if (!leader || leader.dead) return;
        if (!Number.isFinite(leader.facing)) leader.facing = 0; // AI-15

        const excluded = new Set([leader]);
        if (squad.team === 'RU') {
            const fl = squad.aliveInGroup('fire')[0], ml = squad.aliveInGroup('maneuver')[0];
            if (fl) excluded.add(fl);
            if (ml) excluded.add(ml);
        } else {
            const roles = squad._usRoles || { A: 'fire', B: 'maneuver' };
            const fId = roles.A === 'fire' ? 'A' : 'B', mId = roles.A === 'maneuver' ? 'A' : 'B';
            const fl = squad.aliveInGroup(fId)[0], ml = squad.aliveInGroup(mId)[0];
            if (fl) excluded.add(fl);
            if (ml) excluded.add(ml);
        }

        const followers = [];
        for (let i = 0; i < alive.length; i++) {
            const u = alive[i];
            if (excluded.has(u) || u.manualControl || u._hasActiveOrder || u.isSuppressing || u.moveTarget) continue;
            followers.push(u);
        }

        const total = Math.max(1, followers.length);
        for (let i = 0; i < followers.length; i++) {
            const u = followers[i];
            const angle = (i / total) * Math.PI * 2 + leader.facing;
            const radius = TACTICS.formationRadius * (i % 2 === 0 ? 1 : TACTICS.formationSpacing);
            u.formationSlot = { x: leader.x + Math.cos(angle) * radius, y: leader.y + Math.sin(angle) * radius };
        }
        const followerSet = new Set(followers); // AI-3
        for (let i = 0; i < alive.length; i++) {
            const u = alive[i];
            if (u === leader) continue;
            if (u.formationSlot && !followerSet.has(u)) u.formationSlot = null;
        }
    },

    updateUnit(game, u, dt) {
        if (u.dead) return;
        if (!Number.isFinite(dt) || dt <= 0) return;
        if (dt > 0.1) dt = 0.1; // AI-1

        if (u.inVehicle) {
            u.state = 'in_vehicle';
            u.health.update(dt);
            // AI-21: пассажиры тоже получают health.update — но у нас update вызывается у всех,
            // так что фактически тут только регенерация стамины.
            u.stamina = Math.min(TACTICS.stamina.max, u.stamina + TACTICS.stamina.regenIdle * dt * 0.5);
            if (u.health.dead && !u.dead) { u.hp = 0; u.dead = true; u.deathTime = performance.now(); if (typeof Audio !== 'undefined') Audio.death(); return; }
            const v = u.inVehicle;
            if (v.gunner === u && !v.turretBroken && !v.dead && !v.overheated) {
                const target = u.findEnemy(game.allUnits, game.obstacles, game.mapType, game._spatialHash);
                if (target && dist(v, target) < VEHICLES[v.type].cannon.range) {
                    const heightDiff = (target.height || 1.7) - VEHICLES[v.type].height;
                    const pitchAngle = Math.atan2(heightDiff, dist(v, target)) * (180 / Math.PI);
                    const cannon = VEHICLES[v.type].cannon;
                    if (pitchAngle >= cannon.minPitch && pitchAngle <= cannon.maxPitch) {
                        v.turretAngle = Math.atan2(target.y - v.y, target.x - v.x);
                        if (v.cannonCooldown <= 0) {
                            v.cannonCooldown = cannon.fireRate; v.heat += 1;
                            if (v.heat >= cannon.overheatMax) { v.overheated = true; v.heat = cannon.overheatMax; game.showStatus('🔥 ПЕРЕГРЕВ ПУШКИ!'); }
                            const d = dist(v, target), hit = Math.random() < (d < 400 ? 0.8 : 0.5);
                            let tx = target.x, ty = target.y;
                            if (hit) {
                                const blast = cannon.blastRadius;
                                for (let i = 0; i < game.allUnits.length; i++) {
                                    const e = game.allUnits[i];
                                    if (e.dead || e.team === v.team) continue;
                                    if (dist(e, { x: tx, y: ty }) < blast) e.health.takeDamage(cannon.damage);
                                }
                                if (game.vehicles) for (let i = 0; i < game.vehicles.length; i++) {
                                    const e = game.vehicles[i];
                                    if (e.dead || e.team === v.team) continue;
                                    if (dist(e, { x: tx, y: ty }) < blast) e.takeHit(cannon, false, tx, ty, 2.0);
                                }
                                game.explosions.push({ x: tx, y: ty, radius: blast, life: 0.3 });
                                if (typeof Audio !== 'undefined') Audio.explosion();
                            } else { tx += (Math.random() - 0.5) * 40; ty += (Math.random() - 0.5) * 40; }
                            game.bullets.spawn({ x: v.x, y: v.y, tx, ty, color: v.team === 'RU' ? '#ffdd55' : '#66ddff', life: 0.1, isMG: false, weaponId: 'cannon' });
                        }
                    }
                }
            }
            return;
        }

        u.health.update(dt);
        if (u.health.dead && !u.dead) { u.hp = 0; u.dead = true; u.deathTime = performance.now(); if (typeof Audio !== 'undefined') Audio.death(); return; }
        const total = u.health.totalHp(); u.hp = Math.round(total.current); u.maxHp = total.max;

        if (u.panicTimer > 0) u.panicTimer -= dt;
        if (u.radioJamTimer > 0) u.radioJamTimer -= dt;
        if (u.grenadeCooldown > 0) u.grenadeCooldown -= dt;
        if (u.meleeCooldown > 0) u.meleeCooldown -= dt;
        if (u.smokeCooldown > 0) u.smokeCooldown -= dt;

        if (u.suppressionLevel > 0) { u.suppressionLevel = Math.max(0, u.suppressionLevel - dt * TACTICS.suppressionDecay); u.suppressionTimer = Math.max(0, u.suppressionTimer - dt); }
        if (u.suppressionLevel > 10 && u.suppressionLevel <= 40 && u.recoveryTimer <= 0) u.recoveryTimer = TACTICS.suppressionRecovery;
        if (u.recoveryTimer > 0) u.recoveryTimer -= dt;

        u.updateMorale(dt, game.allUnits);

        if (u.isJammed) { u.jamTimer -= dt; if (u.jamTimer <= 0) u.isJammed = false; }

        if (u.state === 'moving') {
            const dx = u.x - u._lastX, dy = u.y - u._lastY;
            const speed = Math.sqrt(dx * dx + dy * dy) / dt;
            if (speed > 3.0) {
                let drain = TACTICS.stamina.drainRun;
                if (u.totalWeight > TACTICS.weight.limit) drain += (u.totalWeight - TACTICS.weight.limit) * TACTICS.weight.staminaWeightFactor;
                u.stamina = Math.max(0, u.stamina - drain * dt);
            } else if (speed > 0.5) u.stamina = Math.max(0, u.stamina - TACTICS.stamina.drainWalk * dt);
        } else {
            let regen = TACTICS.stamina.regenIdle;
            if (u.stance === 'prone') regen = TACTICS.stamina.regenProne;
            else if (u.stance === 'crouch') regen = TACTICS.stamina.regenCrouch;
            u.stamina = Math.min(TACTICS.stamina.max, u.stamina + regen * dt);
        }

        if (u.role === 'medic' && !u.dead && !u.manualControl) { if (AI.medicUpdate(game, u, dt)) return; }

        if (u.moraleState === 'surrendered') { u.state = 'surrendered'; u.moveTarget = null; u.holding = false; u.target = null; u.setStance('stand'); return; }

        if (u.moraleState === 'routing') {
            u.suppressionLevel = 0;
            const enemy = u.findEnemy(game.allUnits, game.obstacles, game.mapType, game._spatialHash);
            if (enemy) {
                const fleeAngle = Math.atan2(u.y - enemy.y, u.x - enemy.x);
                u.setStance('stand'); u.facing = fleeAngle;
                if (!u._routingCover || Math.hypot(u._routingCover.x - u.x, u._routingCover.y - u.y) < 5) u._routingCover = nearestCoverPoint(u.x + Math.cos(fleeAngle) * 80, u.y + Math.sin(fleeAngle) * 80, game.obstacles, 80);
                let tx, ty;
                if (u._routingCover) { tx = u._routingCover.x; ty = u._routingCover.y; }
                else {
                    const margin = 50, dL = u.x, dR = WORLD.width - u.x, dT = u.y, dB = WORLD.height - u.y;
                    if (dR > dL && dR > dT && dR > dB) { tx = WORLD.width - margin; ty = u.y; }
                    else if (dL > dT && dL > dB) { tx = margin; ty = u.y; }
                    else if (dT > dB) { tx = u.x; ty = margin; }
                    else { tx = u.x; ty = WORLD.height - margin; }
                }
                u.state = 'routing'; u.moveTo(tx, ty, dt, game.obstacles);
            }
            return;
        }

        if (u.moraleState === 'panicked') {
            u.setStance('prone'); u.state = 'panicked';
            u.target = u.findEnemy(game.allUnits, game.obstacles, game.mapType, game._spatialHash);
            if (u.target && u.cooldown <= 0 && !u.isReloading && Math.random() < 0.3) { u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x); const shot = u.fire(game.allUnits); if (shot) game.handleShot(shot); }
            if (u.cooldown > 0) u.cooldown -= dt;
            return;
        }

        if (u.suppressionLevel > 40) {
            u.setStance('prone'); u.state = 'suppressed';
            u.target = u.findEnemy(game.allUnits, game.obstacles, game.mapType, game._spatialHash);
            // AI-7: пересчёт укрытия не чаще 2 раз/сек
            if (!u._coverScanTimer || u._coverScanTimer <= 0) {
                u._coverTarget = nearestCoverPoint(u.x, u.y, game.obstacles, 20);
                u._coverScanTimer = 0.5;
            }
            if (u._coverScanTimer > 0) u._coverScanTimer -= dt;
            if (u._coverTarget) u.moveTo(u._coverTarget.x, u._coverTarget.y, dt * 0.5, game.obstacles);
            if (u.target && u.cooldown <= 0 && !u.isReloading && Math.random() < 0.5) { u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x); const shot = u.fire(game.allUnits); if (shot) game.handleShot(shot); }
            if (u.cooldown > 0) u.cooldown -= dt;
            return;
        }

        if (u.isReloading) { u.reloadTimer -= dt * (u.suppressionLevel > 40 ? 0.5 : 1.0); if (u.reloadTimer <= 0) u.isReloading = false; return; }

        // AI-13: убран мёртвый panicked
        if (u.morale < 30 && u.orderMode === 'attack') {
            if (u.moveTarget && u._hasActiveOrder) {
                u.moveTarget = null;
                u._hasActiveOrder = false;
                if (typeof GAME !== 'undefined') GAME.addReport(`❌ ${u.roleName} отказался идти в атаку!`, '#ff4444');
            }
        }

        // AI-25: pendingOrder тикает у всех, у кого он есть
        if (u.pendingOrder) {
            u.pendingOrder.time -= dt;
            if (u.pendingOrder.time <= 0) {
                if (u.pendingOrder.type === 'move') {
                    u.moveTarget = { x: u.pendingOrder.x, y: u.pendingOrder.y };
                    u.facing = Math.atan2(u.pendingOrder.y - u.y, u.pendingOrder.x - u.x);
                }
                u.pendingOrder = null;
            }
        }

        // GAME-36: follow
        if (u.followTarget && !u.followTarget.dead) {
            const fdx = u.followTarget.x - u.x, fdy = u.followTarget.y - u.y;
            const fd = Math.sqrt(fdx * fdx + fdy * fdy);
            if (fd > TACTICS.formationRadius * 2) {
                u.holding = false;
                u.moveTarget = { x: u.followTarget.x, y: u.followTarget.y };
                u._hasActiveOrder = true;
            }
            if (u.followTarget.dead) u.followTarget = null;
        }

        if (u.isSuppressing && u.suppressionTargetPos) {
            u.setStance('prone'); u.facing = Math.atan2(u.suppressionTargetPos.y - u.y, u.suppressionTargetPos.x - u.x);
            if (u.cooldown <= 0 && !u.isReloading) { const shot = u.fireSuppression(game.allUnits); if (shot) game.bullets.spawn({ ...shot, life: 0.15, color: u.team === 'RU' ? '#ffdd55' : '#66ddff', isMG: true }); }
            if (u.cooldown > 0) u.cooldown -= dt;
            return;
        }

        // AI-22: findEnemy один раз
        u.target = u.findEnemy(game.allUnits, game.obstacles, game.mapType, game._spatialHash);
        if (u.target && !u._reportedTarget) { u.report('enemy_spotted', { x: u.target.x, y: u.target.y }); u._reportedTarget = true; }

        if (u.target && !u.isSuppressing && !u.isReloading && u.grenadeCooldown <= 0) {
            const d = dist(u, u.target);
            if (d >= TACTICS.grenade.minRange && d <= TACTICS.grenade.maxRange) {
                const targetInCover = u.target.currentObstacle || rayBlocked(u.x, u.y, u.target.x, u.target.y, game.obstacles);
                if (u.grenades.frag > 0 && (targetInCover || Math.random() < 0.3)) {
                    const shot = u.throwGrenade(u.target, 'frag');
                    if (shot) { game.handleShot(shot); game.showStatus(`${u.roleName}: граната!`); return; }
                }
            }
        }

        if (u.target && dist(u, u.target) <= TACTICS.melee.range && u.meleeCooldown <= 0) { const shot = u.melee(u.target); if (shot) { game.handleShot(shot); return; } }

        const moving = Math.hypot(u.x - u._lastX, u.y - u._lastY) > 0.05;
        u._lastX = u.x; u._lastY = u.y;
        const canAim = u.target && !moving && u.state !== 'moving' && u.suppressionLevel <= 40 && !u.isReloading && u.stance === u.desiredStance;
        if (canAim) u.aimTimer = Math.min(TACTICS.aimTime, u.aimTimer + dt);
        else u.aimTimer = Math.max(0, u.aimTimer - dt * 3);
        const aimT = u.aimTimer / TACTICS.aimTime;
        u.aimLevel = aimT * aimT * (3 - 2 * aimT);

        u.autoSelectStance();
        if (u.stance !== u.desiredStance) { u.stanceTimer -= dt; if (u.stanceTimer <= 0) u.stance = u.desiredStance; }

        if (u.cooldown > 0) u.cooldown -= dt;
        if (u.muzzleFlash > 0) u.muzzleFlash -= dt;

        if (u.moveTarget) {
            u.state = 'moving';
            const reached = u.moveTo(u.moveTarget.x, u.moveTarget.y, dt, game.obstacles);
            if (reached || pointInAnyObstacle(u.moveTarget.x, u.moveTarget.y, game.obstacles)) { u.moveTarget = null; u._hasActiveOrder = false; }
            return;
        }

        if (u.target && dist(u, u.target) <= u.weapon.maxRange) {
            u.state = 'attacking'; u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
            if (dist(u, u.target) <= u.weapon.effRange) { if (u.cooldown <= 0) { const shot = u.fire(game.allUnits); if (shot) game.handleShot(shot); } }
            else if (!u.holding) u.moveTo(u.target.x, u.target.y, dt, game.obstacles);
            return;
        }

        if (u.holding) { u.state = 'holding'; return; }

        if (u.formationSlot) {
            const d = Math.hypot(u.formationSlot.x - u.x, u.formationSlot.y - u.y);
            if (d > 3) { u.state = 'moving'; u.moveTo(u.formationSlot.x, u.formationSlot.y, dt, game.obstacles); }
            else u.state = 'idle';
            return;
        }
        u.state = 'idle';
    },

    medicUpdate(game, u, dt) {
        // AI-4: без filter
        const units = game.allUnits;
        let target = null, bestScore = 0;
        for (let i = 0; i < units.length; i++) {
            const a = units[i];
            if (a.dead || a.team !== u.team || a === u || a.inVehicle || a.health.dead) continue;
            const d = dist(u, a);
            if (d > 5) continue;
            const hp = a.health.totalHp();
            const score = a.health.bloodLoss + (hp.max - hp.current) * 0.5;
            if (score > bestScore) { bestScore = score; target = a; }
        }
        if (target) {
            if (target.health.bloodLoss > 0) target.health.stopBleeding();
            for (const part in target.health.parts) target.health.heal(part, 2 * dt);
            u.holding = true; u.formationSlot = null;
            u.facing = Math.atan2(target.y - u.y, target.x - u.x);
            u.state = 'healing';
            return true;
        }
        return false;
    }
};
