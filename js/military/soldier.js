// js/military/soldier.js

const FIRST_NAMES = ["Иван", "Дмитрий", "Алексей", "Сергей", "Андрей", "Максим", "Николай", "Егор"];
const LAST_NAMES = ["Иванов", "Смирнов", "Кузнецов", "Попов", "Соколов", "Лебедев", "Козлов", "Новиков"];
const CALLSIGNS = ["Сокол", "Гром", "Тень", "Вихрь", "Штык", "Кобра", "Барс", "Ворон"];
const RANKS = ["Рядовой", "Ефрейтор", "Младший сержант", "Сержант", "Старший сержант", "Лейтенант"];
const MOS = ["Стрелок", "Пулеметчик", "Гранатометчик", "Санитар", "Связист", "Снайпер"];

class Soldier {
    constructor(id, faction = "RUS") {
        this.faction = faction;
        this.initIdentity(id);
        this.initService();
        this.initPhysiology();
        this.initEquipment();
        this.initPsychology();
        this.initHealth();
        this.initSensesAndMemory();
        
        this.currentTarget = null;
        this.targetAcquisitionTime = 0;
    }

    initIdentity(id) {
        this.id = id;
        this.firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        this.lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        this.callsign = CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)] + "-" + Math.floor(Math.random() * 10);
        this.age = Math.floor(Math.random() * 15) + 19;
    }

    initService() {
        this.rank = RANKS[Math.floor(Math.random() * (RANKS.length - 1))];
        this.mos = MOS[Math.floor(Math.random() * MOS.length)];
        this.qualification = Math.floor(Math.random() * 6);
    }

    initPhysiology() {
        this.weight = 60 + Math.floor(Math.random() * 30);
        this.height = 165 + Math.floor(Math.random() * 25);
        this.maxBloodVolume = this.weight * 75; 
        this.currentBloodLoss = 0; 
        this.maxStamina = 100 + (this.qualification * 10);
        this.currentStamina = this.maxStamina;
        this.vision = 0.8 + (Math.random() * 0.4);
        this.hearing = 0.8 + (Math.random() * 0.4);
        this.reactionTime = 250 + Math.floor(Math.random() * 100);
    }

    initEquipment() {
        let weaponKey = this.faction === "RUS" ? "АК-12" : "M4A1";
        let secondaryKey = this.faction === "RUS" ? "ПМ" : "M9";

        if (this.mos === "Пулеметчик") weaponKey = this.faction === "RUS" ? "РПК-16" : "M249";
        if (this.mos === "Снайпер") weaponKey = this.faction === "RUS" ? "СВД" : "M24";
        if (this.mos === "Гранатометчик") weaponKey = this.faction === "RUS" ? "РПГ-7" : "AT4";
        
        if (this.mos === "Санитар" || this.mos === "Связист") {
            if (Math.random() > 0.5) { 
                weaponKey = this.faction === "RUS" ? "ПМ" : "M9";
                secondaryKey = null;
            }
        } else {
            if (this.faction === "RUS") {
                const rusPistols = ["ПМ", "ПБ", "АПС", "ПСС", "ПММ", "МП 433", "ГШ 18", "СР 1", "СР 2"];
                secondaryKey = rusPistols[Math.floor(Math.random() * rusPistols.length)];
            }
        }

        this.weapon = window.WeaponData[weaponKey] || window.WeaponData["АК-12"];
        this.secondaryWeapon = secondaryKey ? window.WeaponData[secondaryKey] : null;
        
        this.equipment = {
            primaryWeapon: this.weapon,
            secondaryWeapon: this.secondaryWeapon,
            ammo: this.weapon.ammoCapacity * 4,
            armor: { head: 20, torso: 50, limbs: 10 }
        };
    }

    initPsychology() {
        this.maxMorale = 100;
        this.currentMorale = this.maxMorale;
        this.psycheResilience = Math.floor(Math.random() * 50) + 50;
        this.status = "Норма";
        
        this.hormones = {
            adrenaline: 0,
            cortisol: 0
        };
    }

    initHealth() {
        this.isDead = false;
        this.zones = {
            head: { hp: 100, max: 100, armor: this.equipment.armor.head },
            torso: { hp: 100, max: 100, armor: this.equipment.armor.torso },
            leftArm: { hp: 100, max: 100, armor: this.equipment.armor.limbs },
            rightArm: { hp: 100, max: 100, armor: this.equipment.armor.limbs },
            legs: { hp: 100, max: 100, armor: this.equipment.armor.limbs }
        };
        this.bleeding = 0; 
    }

    initSensesAndMemory() {
        this.baseDetectionRange = 300;
        this.memory = {
            lastAttacker: null,
            knownEnemies: [],
            trauma: 0
        };
    }

    getDetectionRadius() {
        let base = this.baseDetectionRange;
        base *= this.vision;
        base *= (this.currentStamina / this.maxStamina * 0.5 + 0.5); 
        if (this.status.includes("Шок") || this.status.includes("Ранен в голову")) {
            base *= 0.2;
        }
        return base;
    }

    takeDamage(amount, zone = "torso", damageType = "bullet", attacker = null) {
        if (this.isDead) return;

        if (attacker) {
            this.memory.lastAttacker = attacker;
            this.hormones.adrenaline = Math.min(100, this.hormones.adrenaline + 30);
        }

        const z = this.zones[zone];
        let finalDamage = amount;
        if (damageType === "bullet") {
            finalDamage = Math.max(1, amount - z.armor);
        }

        z.hp -= finalDamage;
        
        if (finalDamage > 10 && Math.random() < 0.5) {
            this.bleeding = Math.max(this.bleeding, 1);
            if (finalDamage > 30) this.bleeding = 2;
        }

        if (zone === "head" && z.hp <= 0) this.die("Ранение в голову");
        else if (zone === "torso" && z.hp <= 0) this.die("Ранение в грудь");
        else if (z.hp <= 0) this.addDebuff(zone);

        this.currentMorale -= (finalDamage * 0.5);
        if (this.currentMorale < 0) this.currentMorale = 0;
    }

    addDebuff(zone) {
        if (zone === "legs") this.status = "Ранен в ноги";
        else if (zone === "leftArm" || zone === "rightArm") {
            this.status = "Ранен в руку";
        }
    }

    die(reason) {
        this.isDead = true;
        this.status = "Мертв";
    }

    update() {
        if (this.isDead) return;

        if (this.bleeding > 0) {
            let lossRate = this.bleeding === 1 ? 0.5 : 2; 
            this.currentBloodLoss += lossRate;
            
            if (this.currentBloodLoss > 40) this.status = "Шок";
            if (this.currentBloodLoss > 70) this.die("Потеря крови");
        }

        this.hormones.adrenaline = Math.max(0, this.hormones.adrenaline - 5);
        
        if (this.currentMorale < this.maxMorale) this.currentMorale += 2;
        if (this.currentStamina < this.maxStamina) this.currentStamina += 5;
    }

    getShootingSkill() {
        let skill = this.skills.shooting;
        if (this.status.includes("Ранен в руку")) skill *= 0.5;
        if (this.status.includes("Шок")) skill *= 0.3;
        if (this.currentMorale < 30) skill *= 0.7;
        if (this.hormones.adrenaline > 50) skill *= 1.2; 
        return skill;
    }

    findTarget(enemies) {
        if (this.currentTarget && !this.currentTarget.isDead) {
            const dist = Math.sqrt(Math.pow(this.currentTarget.x - this.x, 2) + Math.pow(this.currentTarget.y - this.y, 2));
            if (dist <= (this.getDetectionRadius() * 6)) {
                return; 
            }
        }

        this.currentTarget = null;
        let bestDist = Infinity;
        
        enemies.forEach(enemy => {
            if (enemy.isDead) return;
            const dist = Math.sqrt(Math.pow(enemy.x - this.x, 2) + Math.pow(enemy.y - this.y, 2));
            if (dist <= (this.getDetectionRadius() * 6) && dist < bestDist) {
                bestDist = dist;
                this.currentTarget = enemy;
            }
        });

        if (this.currentTarget) {
            this.targetAcquisitionTime = this.reactionTime; 
        }
    }
}

window.SoldierGenerator = {
    generateSquad: function(size = 10, faction = "RUS") {
        let squad = [];
        for (let i = 0; i < size; i++) {
            squad.push(new Soldier(`sld_${Date.now()}_${i}`, faction));
        }
        return squad;
    }
};
