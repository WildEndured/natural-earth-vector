// js/military/weapons.js

window.WeaponData = {
    // ============ ПИСТОЛЕТЫ РОССИИ ============
    "ПМ": { name: "Пистолет Макарова (ПМ)", caliber: "9x18 мм", weight: 0.73, rateOfFire: 30, ammoCapacity: 8, effectiveRange: 50, damage: 15 },
    "ПБ": { name: "Пистолет Бесшумный (ПБ)", caliber: "9x18 мм", weight: 0.98, rateOfFire: 30, ammoCapacity: 8, effectiveRange: 50, damage: 15, silent: true },
    "АПС": { name: "Автоматический пистолет Стечкина (АПС)", caliber: "9x18 мм", weight: 1.22, rateOfFire: 750, ammoCapacity: 20, effectiveRange: 100, damage: 15 },
    "ПСС": { name: "Пистолет Специальный Самозарядный (ПСС)", caliber: "7.62x41 мм", weight: 0.85, rateOfFire: 30, ammoCapacity: 6, effectiveRange: 50, damage: 25, silent: true },
    "ПММ": { name: "Пистолет Макарова Модернизированный (ПММ)", caliber: "9x18 мм", weight: 0.76, rateOfFire: 35, ammoCapacity: 12, effectiveRange: 50, damage: 18 },
    "МП 433": { name: "Пистолет МП-433", caliber: "9x19 мм", weight: 0.8, rateOfFire: 40, ammoCapacity: 15, effectiveRange: 50, damage: 20 },
    "ГШ 18": { name: "Пистолет ГШ-18", caliber: "9x19 мм", weight: 0.58, rateOfFire: 40, ammoCapacity: 18, effectiveRange: 50, damage: 20 },
    "СР 1": { name: "Самозарядный пистолет СР-1", caliber: "9x21 мм", weight: 0.9, rateOfFire: 35, ammoCapacity: 17, effectiveRange: 50, damage: 22 },
    "СР 2": { name: "Самозарядный пистолет СР-2", caliber: "9x21 мм", weight: 0.9, rateOfFire: 35, ammoCapacity: 17, effectiveRange: 50, damage: 22 },

    // ============ ПИСТОЛЕТЫ НАТО ============
    "M9": { name: "M9 Beretta", caliber: "9x19 мм", weight: 0.95, rateOfFire: 40, ammoCapacity: 15, effectiveRange: 50, damage: 18 },
    "Glock 17": { name: "Glock 17", caliber: "9x19 мм", weight: 0.71, rateOfFire: 40, ammoCapacity: 17, effectiveRange: 50, damage: 18 },
    "M1911": { name: "M1911", caliber: ".45 ACP", weight: 1.1, rateOfFire: 30, ammoCapacity: 7, effectiveRange: 50, damage: 25 },

    // ============ АВТОМАТЫ И ВИНТОВКИ ============
    "АК-12": { name: "АК-12", caliber: "5.45x39 мм", weight: 3.5, rateOfFire: 700, ammoCapacity: 30, effectiveRange: 500, damage: 35 },
    "АК-74": { name: "АК-74", caliber: "5.45x39 мм", weight: 3.3, rateOfFire: 650, ammoCapacity: 30, effectiveRange: 500, damage: 32 },
    "M4A1": { name: "M4A1", caliber: "5.56x45 мм", weight: 3.4, rateOfFire: 700, ammoCapacity: 30, effectiveRange: 500, damage: 33 },

    // ============ ПУЛЕМЕТЫ ============
    "РПК-16": { name: "РПК-16", caliber: "5.45x39 мм", weight: 4.5, rateOfFire: 700, ammoCapacity: 95, effectiveRange: 600, damage: 40 },
    "M249": { name: "M249 SAW", caliber: "5.56x45 мм", weight: 7.5, rateOfFire: 800, ammoCapacity: 200, effectiveRange: 800, damage: 42 },

    // ============ СНАЙПЕРСКИЕ ВИНТОВКИ ============
    "СВД": { name: "СВД", caliber: "7.62x54 мм", weight: 4.3, rateOfFire: 30, ammoCapacity: 10, effectiveRange: 800, damage: 80 },
    "M24": { name: "M24 SWS", caliber: "7.62x51 мм", weight: 5.4, rateOfFire: 20, ammoCapacity: 5, effectiveRange: 800, damage: 85 },

    // ============ ГРАНАТОМЕТЫ ============
    "РПГ-7": { name: "РПГ-7", caliber: "85 мм", weight: 7.0, rateOfFire: 4, ammoCapacity: 1, effectiveRange: 300, damage: 150 },
    "AT4": { name: "AT4", caliber: "84 мм", weight: 6.8, rateOfFire: 1, ammoCapacity: 1, effectiveRange: 300, damage: 160 }
};
