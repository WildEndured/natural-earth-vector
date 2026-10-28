// ==================== CONFIG.JS ====================

const WORLD = { width: 1000, height: 1000 };

const WEAPONS = {
    // Добавлен weight (вес оружия), heatMax (перегрев), heatRate (скорость нагрева)
    ak74m:    { name: 'АК-74М', caliber: '5.45×39', magSize: 30, maxAmmo: 180, effRange: 300, maxRange: 1000, fireRate: 0.60, damage: 28, accuracy: 0.85, reloadTime: 2.5, suppressionPower: 0.5, penetration: 10, bulletSpeed: 900, weight: 3.6, heatMax: 60, heatRate: 2.5 },
    ak74m_gp: { name: 'АК-74М + ГП-25', caliber: '5.45 / 40', magSize: 30, maxAmmo: 180, effRange: 300, maxRange: 1000, fireRate: 0.60, damage: 28, accuracy: 0.80, reloadTime: 3.0, suppressionPower: 0.5, penetration: 10, bulletSpeed: 900, weight: 4.8, heatMax: 60, heatRate: 2.5, hasGL: true, glAmmo: 4, glRange: 400, glBlast: 6 },
    pkm:      { name: 'ПКП «Печенег»', caliber: '7.62×54R', magSize: 100, maxAmmo: 400, effRange: 800, maxRange: 1500, fireRate: 0.12, damage: 22, accuracy: 0.70, reloadTime: 12.0, suppressionPower: 1.5, penetration: 15, bulletSpeed: 825, weight: 12.7, heatMax: 80, heatRate: 1.5, bipod: true },
    rpg7:     { name: 'РПГ-7В', caliber: '85 мм', magSize: 1, maxAmmo: 4, effRange: 330, maxRange: 700, fireRate: 6.0, damage: 150, accuracy: 0.90, reloadTime: 8.0, suppressionPower: 2.0, penetration: 300, bulletSpeed: 120, weight: 6.3, heatMax: 100, heatRate: 0, isAntiTank: true, blastRadius: 4 },
    m4a1:     { name: 'M4A1', caliber: '5.56×45', magSize: 30, maxAmmo: 210, effRange: 300, maxRange: 800, fireRate: 0.55, damage: 26, accuracy: 0.85, reloadTime: 2.2, suppressionPower: 0.5, penetration: 12, bulletSpeed: 880, weight: 3.4, heatMax: 60, heatRate: 2.8 },
    m4a1_gl:  { name: 'M4A1 + M320', caliber: '5.56 / 40', magSize: 30, maxAmmo: 210, effRange: 300, maxRange: 800, fireRate: 0.55, damage: 26, accuracy: 0.82, reloadTime: 3.0, suppressionPower: 0.5, penetration: 12, bulletSpeed: 880, weight: 4.9, heatMax: 60, heatRate: 2.8, hasGL: true, glAmmo: 4, glRange: 400, glBlast: 5 },
    m249:     { name: 'M249 SAW', caliber: '5.56×45', magSize: 200, maxAmmo: 600, effRange: 600, maxRange: 1000, fireRate: 0.10, damage: 18, accuracy: 0.75, reloadTime: 6.0, suppressionPower: 1.0, penetration: 13, bulletSpeed: 915, weight: 10.2, heatMax: 80, heatRate: 1.8, bipod: true },
    m110:     { name: 'M110 SASS', caliber: '7.62×51', magSize: 10, maxAmmo: 60, effRange: 800, maxRange: 1500, fireRate: 1.80, damage: 65, accuracy: 0.95, reloadTime: 4.0, suppressionPower: 0.7, penetration: 20, bulletSpeed: 837, weight: 7.8, heatMax: 40, heatRate: 3.0, bipod: true }
};

const VEHICLES = {
    bmp2: {
        name: 'БМП-2',
        hullArmor: { front: 23, side: 9, rear: 9 }, turretArmor: { front: 23, side: 9, rear: 9 },
        hullSlope: { front: 60, side: 0, rear: 0 }, turretSlope: { front: 45, side: 15, rear: 15 },
        speed: 65, crewSize: 3, troopCapacity: 7, height: 2.25,
        cannon: { name: '2А42', damage: 45, fireRate: 0.15, range: 800, blastRadius: 3, penetration: 50, overheatMax: 30, overheatCooldown: 10, minPitch: -5, maxPitch: 74 }
    },
    bradley: {
        name: 'M2 Bradley',
        hullArmor: { front: 38, side: 25, rear: 19 }, turretArmor: { front: 38, side: 25, rear: 19 },
        hullSlope: { front: 60, side: 0, rear: 0 }, turretSlope: { front: 45, side: 15, rear: 15 },
        speed: 60, crewSize: 3, troopCapacity: 6, height: 2.98,
        cannon: { name: 'M242', damage: 35, fireRate: 0.12, range: 800, blastRadius: 2.5, penetration: 45, overheatMax: 40, overheatCooldown: 8, minPitch: -10, maxPitch: 60 }
    }
};

const STANCES = {
    // Скорость теперь в м/с (раньше была множителем)
    stand:  { name: 'Стоя',     speed: 1.5,  hitMod: 0.75, targetSize: 1.00, collision: 1.00 }, // Шаг
    run:    { name: 'Бег',      speed: 5.0,  hitMod: 0.5,  targetSize: 1.00, collision: 1.00 }, // Бег
    crouch: { name: 'С колена', speed: 0.9,  hitMod: 1.00, targetSize: 0.70, collision: 0.80 },
    prone:  { name: 'Лёжа',     speed: 0.3,  hitMod: 1.30, targetSize: 0.45, collision: 0.50 }
};

const TACTICS = {
    soldierRadius: 4, viewRange: 350, viewCone: 120,
    formationRadius: 10, formationSpacing: 1.4,
    aimTime: 2.0, aimBonus: { standard: 0.25, sniper: 0.35, mg: 0.30 },
    movingPenalty: 0.5, stanceSwitchPenalty: 0.3, stanceSwitchTime: 0.8, bipodBonus: 1.15,
    suppressionRadius: 15, suppressionMGMult: 1.8, suppressionDecay: 15, suppressionRecovery: 2.0, suppressionAccuracyPenalty: 0.35,
    morale: {
        max: 100, decayWounded: 2, decaySuppression: 5, decayAllyDeath: 10, decayLeaderLoss: 25, decayStress: 1,
        regenBase: 2, regenLeader: 2.0, regenCalm: 1.5, stressGain: 2, stressDecay: 3, stressThreshold: 60,
        leaderRadius: 30, allyDeathRadius: 50, thresholds: { cautious: 70, panicked: 40, routing: 20, surrendered: 10 }
    },
    radio: { range: 200, orderDelay: 2.0, signalLossTime: 3.0, reportCooldown: 1.0, enemyMemory: 30.0, jamChance: 0.2 },
    damageVariance: 0.1, hitChanceMin: 0.05, hitChanceMax: 0.95, objectiveRadius: 60, captureTime: 3.0,
    grenade: { throwTime: 1.5, cooldown: 8.0, minRange: 10, maxRange: 25, blastRadius: 5, damage: 100, suppressionRadius: 10, suppressionPower: 2.0, fuseTime: 2.0 },
    melee: { range: 2.0, damage: 60, cooldown: 1.5, accuracy: 0.7 },
    targetPriority: {
        roleWeight: { mg: 3, grenadier: 2, commander: 2, squad_leader: 2, team_leader: 2, deputy: 2, at: 2, rifleman: 1, medic: 1, senior: 1, at_assist: 1, assistant_grenadier: 1, bmp_gunner: 1, bmp_driver: 1 },
        distanceWeight: 1.0, frontWeight: 0.5, coverWeight: 0.3, woundedWeight: 0.2
    },
    // НОВОЕ: Усталость и Экипировка
    stamina: {
        max: 100,
        drainRun: 15,       // трата в секунду при беге
        drainWalk: 2,       // трата при шаге
        regenIdle: 5,       // восстановление стоя
        regenCrouch: 10,    // восстановление сидя
        regenProne: 15,     // восстановление лежа
        tiredThreshold: 20  // порог усталости (ниже - штрафы)
    },
    weight: {
        baseEquipment: 10,  // Бронежилет, каска, вода (кг)
        limit: 35,          // Максимальный вес (кг), выше - нельзя бежать
        staminaWeightFactor: 0.05 // Каждый кг сверх нормы увеличивает трату стамины
    }
};

const TARGET_PRIORITY = TACTICS.targetPriority.roleWeight;
