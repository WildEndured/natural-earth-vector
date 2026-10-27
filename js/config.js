// ==================== ОРУЖИЕ ====================
export const WEAPONS = {
    ak74m:    { name: 'АК-74М', caliber: '5.45×39 мм', weight: 3.6, magSize: 30, maxAmmo: 180, effRange: 300, maxRange: 1000, fireRate: 0.6, rpm: 650, muzzleVelocity: 900, damage: 28, baseAccuracy: 0.85, reloadTime: 2.5, suppressionPower: 0.5, icon: '🔫' },
    ak74m_gp: { name: 'АК-74М + ГП-25', caliber: '5.45 / 40 мм', weight: 4.8, magSize: 30, maxAmmo: 180, glAmmo: 4, glRange: 400, glBlast: 6, effRange: 300, maxRange: 1000, fireRate: 0.6, rpm: 650, muzzleVelocity: 900, damage: 28, baseAccuracy: 0.8, reloadTime: 3.0, hasGL: true, suppressionPower: 0.5, icon: '🔫💥' },
    pkm:      { name: 'ПКП «Печенег»', caliber: '7.62×54 мм R', weight: 12.7, magSize: 100, maxAmmo: 400, effRange: 800, maxRange: 1500, fireRate: 0.12, rpm: 650, muzzleVelocity: 825, damage: 22, baseAccuracy: 0.7, reloadTime: 12.0, suppressionPower: 1.5, bipod: true, icon: '💥' },
    rpg7:     { name: 'РПГ-7В', caliber: '85 мм', weight: 6.3, magSize: 1, maxAmmo: 4, effRange: 330, maxRange: 700, fireRate: 6.0, rpm: 6, muzzleVelocity: 120, damage: 150, baseAccuracy: 0.9, reloadTime: 8.0, isAntiTank: true, blastRadius: 6, suppressionPower: 2.0, icon: '🚀' },
    m4a1:     { name: 'M4A1', caliber: '5.56×45 NATO', weight: 3.4, magSize: 30, maxAmmo: 210, effRange: 300, maxRange: 800, fireRate: 0.55, rpm: 700, muzzleVelocity: 880, damage: 26, baseAccuracy: 0.85, reloadTime: 2.2, suppressionPower: 0.5, icon: '🔫' },
    m4a1_gl:  { name: 'M4A1 + M320', caliber: '5.56 / 40 мм', weight: 4.9, magSize: 30, maxAmmo: 210, glAmmo: 4, glRange: 400, glBlast: 5, effRange: 300, maxRange: 800, fireRate: 0.55, rpm: 700, muzzleVelocity: 880, damage: 26, baseAccuracy: 0.82, reloadTime: 3.0, hasGL: true, suppressionPower: 0.5, icon: '🔫💥' },
    m249:     { name: 'M249 SAW', caliber: '5.56×45 NATO', weight: 10.2, magSize: 200, maxAmmo: 600, effRange: 600, maxRange: 1000, fireRate: 0.1, rpm: 750, muzzleVelocity: 915, damage: 18, baseAccuracy: 0.75, reloadTime: 6.0, suppressionPower: 1.0, bipod: true, icon: '💥' },
    m110:     { name: 'M110 SASS', caliber: '7.62×51 NATO', weight: 7.8, magSize: 10, maxAmmo: 60, effRange: 800, maxRange: 1500, fireRate: 1.8, rpm: 30, muzzleVelocity: 837, damage: 65, baseAccuracy: 0.95, reloadTime: 4.0, suppressionPower: 0.7, bipod: true, icon: '🎯' }
};

// ==================== КОНСТАНТЫ ====================
export const CONFIG = {
    soldierRadius: 4, speed: 8, viewRange: 350, objectiveRadius: 60,
    formationInterval: 7, marchColumnGap: 8,
    stanceSwitchTime: 0.8, autoStance: true,
    movingAccuracyPenalty: 0.5, stanceSwitchPenalty: 0.3, bipodBonus: 1.15,
    stanceModifiers: {
        stand:  { name: 'Стоя',     speedMult: 1.0,  hitChanceMod: 0.75, targetSizeMult: 1.0,  collisionMult: 1.0 },
        crouch: { name: 'С колена', speedMult: 0.6,  hitChanceMod: 1.0,  targetSizeMult: 0.7,  collisionMult: 0.8 },
        prone:  { name: 'Лёжа',     speedMult: 0.35, hitChanceMod: 1.3,  targetSizeMult: 0.45, collisionMult: 0.5 }
    },
    aimTime: 2.0, aimBonusStandard: 0.25, aimBonusSniper: 0.35, aimBonusMG: 0.30,
    suppressionRadius: 15, suppressionDecay: 15, suppressionRecovery: 2.0, suppressionAccuracyPenalty: 0.35, suppressionMGMultiplier: 1.8,
    morale: {
        decaySuppression: 5, decayWounded: 2, decayAllyDeath: 10, decayLeaderLoss: 25, decayCombatStress: 1,
        regenBase: 2, regenLeaderNearby: 2.0, regenNoSuppression: 1.5,
        combatStressGain: 2, combatStressDecay: 3, combatStressThreshold: 60,
        thresholds: { cautious: 70, panicked: 40, routing: 20, surrendered: 10 },
        leaderRadius: 30, allyDeathRadius: 50
    }
};

// ==================== МИР ====================
export const WORLD = { width: 1000, height: 1000 };

// ==================== РОЛИ ГРУПП США ====================
export const USGroups = {
    A: 'fire', B: 'maneuver', roleNames: { fire: 'огонь', maneuver: 'маневр' },
    evaluateAndSwitch(usUnits) {
        const aliveA = usUnits.filter(u => !u.dead && u.groupId === 'A');
        const aliveB = usUnits.filter(u => !u.dead && u.groupId === 'B');
        if (this.A === 'fire' && aliveA.length < 2 && aliveB.length >= 2) {
            this.A = 'maneuver'; this.B = 'fire';
            if (window.showStatus) window.showStatus('🇺🇸 А→маневр, Б→огонь');
        } else if (this.B === 'fire' && aliveB.length < 2 && aliveA.length >= 2) {
            this.B = 'maneuver'; this.A = 'fire';
            if (window.showStatus) window.showStatus('🇺🇸 Б→маневр, А→огонь');
        }
        const el = document.getElementById('us-groups');
        if (el) el.textContent = `А: ${this.roleNames[this.A]} · Б: ${this.roleNames[this.B]}`;
    },
    reset() { this.A = 'fire'; this.B = 'maneuver'; }
};
