import { WEAPONS, CONFIG } from './config.js';
import { rayHitsObstacle, pointInObstacle } from './terrain.js';
import { playSound } from './audio.js';
import { pushBullet, pushExplosion, pushDamageText, getSelectedUnits, getAllUnits } from './state.js';
import { camera } from './state.js';

export class Soldier {
    constructor(x, y, team, role, roleName, weaponId, groupId = null) {
        this.x = x; this.y = y; this.team = team; this.role = role; this.roleName = roleName;
        this.groupId = groupId; this.radius = CONFIG.soldierRadius;
        this.hp = 100; this.maxHp = 100; this.dead = false;
        this.target = null; this.moveTarget = null; this.followTarget = null; this.formationPos = null;
        this.state = 'idle'; this.cooldown = 0; this.facing = 0; this.muzzleFlash = 0; this.holding = false;
        this.stance = 'stand'; this.desiredStance = 'stand'; this.stanceTimer = 0; this.stanceLocked = false;
        this.weapon = WEAPONS[weaponId] || WEAPONS.ak74m; this.weaponId = weaponId;
        this.range = this.weapon.effRange; this.damage = this.weapon.damage; this.fireRate = this.weapon.fireRate;
        this.accuracy = this.weapon.baseAccuracy;
        this.ammo = this.weapon.maxAmmo; this.glAmmo = this.weapon.glAmmo || 0;
        this.reloadTimer = 0; this.isReloading = false;
        this.suppressionTimer = 0; this.suppressionFlash = 0; this.suppressionLevel = 0; this.recoveryTimer = 0;
        this.currentObstacle = null; this.manualControl = false;
        this.panicTimer = 0; this.isSuppressing = false; this.suppressionTargetPos = null; this.deathTime = 0;
        this.aimTimer = 0; this.aimLevel = 0; this.lastX = x; this.lastY = y;
        this.morale = 100; this.combatStress = 0; this.moraleState = 'normal';
        this._coverTarget = null;
    }

    update(dt, allUnits) {
        if (this.dead) return;
        this.currentObstacle = pointInObstacle(this.x, this.y);
        if (this.panicTimer > 0) this.panicTimer -= dt;

        // Подавление
        if (this.suppressionLevel > 0) {
            this.suppressionLevel = Math.max(0, this.suppressionLevel - dt * CONFIG.suppressionDecay);
            this.suppressionTimer = Math.max(0, this.suppressionTimer - dt);
            this.suppressionFlash = Math.max(0, this.suppressionFlash - dt);
        }
        if (this.suppressionLevel > 10 && this.suppressionLevel <= 40 && this.recoveryTimer <= 0) this.recoveryTimer = CONFIG.suppressionRecovery;
        if (this.recoveryTimer > 0) this.recoveryTimer -= dt;

        // Мораль
        this.updateMorale(dt, allUnits);
        if (this.moraleState === 'surrendered') {
            this.state = 'surrendered'; this.moveTarget = null; this.holding = false; this.target = null;
            this.setStance('stand'); return;
        }
        if (this.moraleState === 'routing') {
            this.suppressionLevel = 0; this.suppressionTimer = 0;
            const enemy = this.findEnemy(allUnits);
            if (enemy) {
                const fleeAngle = Math.atan2(this.y - enemy.y, this.x - enemy.x);
                this.state = 'routing'; this.setStance('stand'); this.facing = fleeAngle;
                this.moveToward(this.x + Math.cos(fleeAngle) * 100, this.y + Math.sin(fleeAngle) * 100, dt);
            }
            return;
        }
        if (this.moraleState === 'panicked') {
            this.setStance('prone'); this.state = 'panicked';
            this.target = this.findEnemy(allUnits);
            if (this.target && this.cooldown <= 0 && !this.isReloading && Math.random() < 0.3) {
                this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x); this.fire();
            }
            return;
        }

        // Сильное подавление
        if (this.suppressionLevel > 40) {
            this.setStance('prone'); this.state = 'suppressed';
            this.target = this.findEnemy(allUnits);
            if (!this._coverTarget || Math.hypot(this._coverTarget.x - this.x, this._coverTarget.y - this.y) < 3) {
                this._coverTarget = this.findNearestCover(this.x, this.y, 20);
            }
            if (this._coverTarget) this.moveToward(this._coverTarget.x, this._coverTarget.y, dt * 0.5);
            if (this.target && this.cooldown <= 0 && !this.isReloading && Math.random() < 0.5) {
                this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x); this.fire();
            }
            return;
        }

        // Перезарядка
        if (this.isReloading) {
            const speedMult = this.suppressionLevel > 40 ? 0.5 : 1.0;
            this.reloadTimer -= dt * speedMult;
            if (this.reloadTimer <= 0) this.isReloading = false;
            return;
        }

        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.muzzleFlash > 0) this.muzzleFlash -= dt;
        if (this.stance !== this.desiredStance) {
            this.stanceTimer -= dt;
            if (this.stanceTimer <= 0) this.stance = this.desiredStance;
        }

        // Подавление пулемётом
        if (this.isSuppressing && this.suppressionTargetPos) {
            this.setStance('prone');
            this.facing = Math.atan2(this.suppressionTargetPos.y - this.y, this.suppressionTargetPos.x - this.x);
            if (this.cooldown <= 0 && !this.isReloading) this.fireSuppression();
            return;
        }

        // Поиск цели
        this.target = this.findEnemy(allUnits);

        // Прицеливание (после findEnemy!)
        const physicallyMoving = Math.hypot(this.x - this.lastX, this.y - this.lastY) > 0.05;
        this.lastX = this.x; this.lastY = this.y;
        const canAim = this.target && !physicallyMoving && this.state !== 'moving'
                       && this.suppressionLevel <= 40 && !this.isReloading
                       && this.stance === this.desiredStance;
        if (canAim) this.aimTimer = Math.min(CONFIG.aimTime, this.aimTimer + dt);
        else this.aimTimer = Math.max(0, this.aimTimer - dt * 3);
        const aimT = this.aimTimer / CONFIG.aimTime;
        this.aimLevel = aimT * aimT * (3 - 2 * aimT);

        // Стойка
        if (CONFIG.autoStance && !this.stanceLocked) this.autoSelectStance();

        // Поведение
        if (this.target && this.distanceTo(this.target) <= this.weapon.maxRange) {
            this.state = 'attacking';
            this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            if (this.distanceTo(this.target) <= this.weapon.effRange) {
                if (this.cooldown <= 0) this.fire();
            } else if (!this.holding && !this.moveTarget) {
                this.moveToward(this.target.x, this.target.y, dt);
            }
        } else if (this.holding) this.state = 'holding';
        else if (this.moveTarget) {
            this.state = 'moving';
            this.moveToward(this.moveTarget.x, this.moveTarget.y, dt);
            if (this.distanceTo(this.moveTarget) < 4) this.moveTarget = null;
        } else if (this.formationPos && !this.target) {
            const d = Math.hypot(this.formationPos.x - this.x, this.formationPos.y - this.y);
            if (d > 3) { this.state = 'moving'; this.moveToward(this.formationPos.x, this.formationPos.y, dt); }
            else this.state = 'idle';
        } else if (this.followTarget && !this.followTarget.dead) {
            const d = this.distanceTo(this.followTarget);
            if (d > 20) { this.moveToward(this.followTarget.x, this.followTarget.y, dt); this.state = 'moving'; }
            else this.state = 'idle';
        } else this.state = 'idle';
    }

    // ... (продолжение методов: updateMorale, fireSuppression, applySuppression,
    // calculateHitChance, fire, notifyAllyDeath, findNearestCover, showDamageText,
    // distanceToLine, findEnemy, moveToward, autoSelectStance, setStance, distanceTo, draw)

    // ВАЖНО: draw() и остальные методы — копируйте из game.js без изменений
    // (заменив глобальные переменные на импорты: selectedUnits → getSelectedUnits(),
    //  camera → camera, currentMapType → импортировать из terrain.js)
}
