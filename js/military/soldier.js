// soldier.js

// Базовые пулы для генерации
const FIRST_NAMES = ["Иван", "Дмитрий", "Алексей", "Сергей", "Андрей", "Максим", "Николай", "Егор"];
const LAST_NAMES = ["Иванов", "Смирнов", "Кузнецов", "Попов", "Соколов", "Лебедев", "Козлов", "Новиков"];
const CALLSIGNS = ["Сокол", "Гром", "Тень", "Вихрь", "Штык", "Кобра", "Барс", "Ворон"];
const RANKS = ["Рядовой", "Ефрейтор", "Младший сержант", "Сержант", "Старший сержант", "Лейтенант"];
const MOS = ["Стрелок", "Пулеметчик", "Гранатометчик", "Санитар", "Связист", "Снайпер", "Механик-водитель"];

class Soldier {
    constructor(id) {
        this.initIdentity(id);
        this.initService();
        this.initPhysiology();
        this.initEquipment();
        this.initPsychology();
        this.initSkills();
    }

    // БЛОК 1. Идентификация
    initIdentity(id) {
        this.id = id;
        this.firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        this.lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        this.callsign = CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)] + "-" + Math.floor(Math.random() * 10);
        this.age = Math.floor(Math.random() * 15) + 19; // 19-34
        this.gender = Math.random() > 0.1 ? "М" : "Ж"; // 10% женщин
    }

    // БЛОК 2. Военная служба
    initService() {
        this.rank = RANKS[Math.floor(Math.random() * (RANKS.length - 1))]; // Офицеры редкость
        this.mos = MOS[Math.floor(Math.random() * MOS.length)];
        this.qualification = Math.floor(Math.random() * 6); // 0-5
    }

    // БЛОК 3. Медицина и Физика
    initPhysiology() {
        this.bloodType = ["O(I)", "A(II)", "B(III)", "AB(IV)"][Math.floor(Math.random() * 4)];
        this.rhFactor = Math.random() > 0.15 ? "+" : "-";
        this.weight = 60 + Math.floor(Math.random() * 30); // 60-90 кг
        this.height = 165 + Math.floor(Math.random() * 25); // 165-190 см
        this.maxBloodVolume = this.weight * 75; // мл (примерно 75 мл на кг)
        this.currentBloodLoss = 0; // %
        
        this.vision = 0.8 + (Math.random() * 0.4); // 0.8 - 1.2
        this.hearing = 0.8 + (Math.random() * 0.4);
        
        this.maxStamina = 100 + (this.qualification * 10);
        this.currentStamina = this.maxStamina;
        
        this.painTolerance = Math.floor(Math.random() * 50) + 50; // 50-100

        // Скорости (м/с)
        this.speeds = {
            walk: 1.4,
            run: 4.5,
            crouch: 0.8,
            crawl: 0.3
        };

        // Учет груза (будет обновляться при экипировке)
        this.equipmentWeight = 0;
    }

    // БЛОК Снаряжение
    initEquipment() {
        this.equipment = {
            primaryWeapon: "АК-12",
            ammo: 120, // патронов
            armor: { head: 20, torso: 50, limbs: 10 }, // Уровень защиты
            medkits: 1,
            radio: this.mos === "Связист" ? true : false
        };
        this.equipmentWeight = 15 + (this.equipment.ammo * 0.01); // Примерный вес
    }

    // БЛОК Психика
    initPsychology() {
        this.maxMorale = 100;
        this.currentMorale = this.maxMorale;
        this.psycheResilience = Math.floor(Math.random() * 50) + 50;
        this.panicThreshold = 30; // При 30% потерь может запаниковать
        this.status = "Норма"; // Норма, Контузия, Шок, Паника
    }

    // БЛОК Навыки
    initSkills() {
        // Базовые навыки зависят от квалификации и ВУС
        const baseSkill = this.qualification * 10;
        this.skills = {
            shooting: baseSkill + Math.floor(Math.random() * 20),
            melee: baseSkill + Math.floor(Math.random() * 20),
            stealth: baseSkill + Math.floor(Math.random() * 20),
            detection: baseSkill + Math.floor(Math.random() * 20),
            medical: this.mos === "Санитар" ? 80 : 10,
            engineering: this.mos === "Механик-водитель" ? 60 : 5
        };
    }

    // БЛОК Восприятие
    getDetectionRadius(isNight) {
        let base = 100; // метров
        if (this.status === "Контузия") base *= 0.5;
        base *= this.vision;
        if (isNight) base *= 0.3; // Ночью видно хуже
        // Учет позы (пока не реализован, но задел есть)
        return base;
    }

    // Метод получения урона (задел на будущее)
    takeDamage(amount, type) {
        if (type === "bleeding") {
            this.currentBloodLoss += amount;
            if (this.currentBloodLoss > 40) {
                this.status = "Шок";
                this.currentMorale -= 20;
            }
        }
    }
}

// Генератор отрядов
window.SoldierGenerator = {
    generateSquad: function(size = 10) {
        let squad = [];
        for (let i = 0; i < size; i++) {
            squad.push(new Soldier(`sld_${Date.now()}_${i}`));
        }
        return squad;
    },

    // Вывести данные бойца в консоль для проверки
    printSoldier: function(soldier) {
        console.log(`[${soldier.callsign}] ${soldier.lastName} ${soldier.firstName} - ${soldier.rank} (${soldier.mos})`);
        console.log(`Возраст: ${soldier.age}, Кровь: ${soldier.bloodType}${soldier.rhFactor}, Вес: ${soldier.weight}кг`);
        console.log(`Стамина: ${soldier.currentStamina}/${soldier.maxStamina}, Мораль: ${soldier.currentMorale}`);
        console.log(`Навыки: Стрельба ${soldier.skills.shooting}, Скрытность ${soldier.skills.stealth}`);
    }
};
