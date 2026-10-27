import { Soldier } from './soldier.js';
import { setRuUnits, setUsUnits, setAllUnits, setSelectedUnits, setObjective } from './state.js';
import { CONFIG, WORLD } from './config.js';

export function createRussianSquad(cx, cy) {
    return [
        new Soldier(cx, cy, 'RU', 'commander', 'Ком. отделения', 'ak74m', 'cmd'),
        new Soldier(cx + 12, cy + 10, 'RU', 'deputy', 'Зам. ком. (ст. стрелок)', 'ak74m_gp', 'cmd'),
        new Soldier(cx + 24, cy + 18, 'RU', 'mg', 'Пулеметчик', 'pkm', 'fire'),
        new Soldier(cx + 6, cy + 24, 'RU', 'grenadier', 'Гранатометчик', 'rpg7', 'fire'),
        new Soldier(cx - 6, cy + 24, 'RU', 'assistant_grenadier', 'Пом. гранатометчика', 'ak74m', 'fire'),
        new Soldier(cx - 18, cy + 18, 'RU', 'rifleman', 'Стрелок', 'ak74m', 'maneuver'),
        new Soldier(cx - 24, cy + 10, 'RU', 'rifleman', 'Стрелок', 'ak74m', 'maneuver'),
        new Soldier(cx - 12, cy + 10, 'RU', 'medic', 'Санитар-стрелок', 'ak74m', 'maneuver'),
        new Soldier(cx, cy + 32, 'RU', 'bmp_gunner', 'Наводчик-оператор БМП', 'ak74m', 'crew'),
        new Soldier(cx + 10, cy + 32, 'RU', 'bmp_driver', 'Механик-водитель БМП', 'ak74m', 'crew'),
    ];
}

export function createUSSquad(cx, cy) {
    return [
        new Soldier(cx, cy, 'US', 'squad_leader', 'Ком. отделения', 'm4a1', 'cmd'),
        new Soldier(cx + 15, cy + 8, 'US', 'team_leader', 'Ком. группы А', 'm4a1_gl', 'A'),
        new Soldier(cx + 22, cy + 16, 'US', 'mg', 'Пулеметчик А', 'm249', 'A'),
        new Soldier(cx + 8, cy + 16, 'US', 'grenadier', 'Гренадер А', 'm4a1_gl', 'A'),
        new Soldier(cx + 30, cy + 24, 'US', 'rifleman', 'Стрелок А', 'm4a1', 'A'),
        new Soldier(cx - 15, cy + 8, 'US', 'team_leader', 'Ком. группы Б', 'm4a1_gl', 'B'),
        new Soldier(cx - 22, cy + 16, 'US', 'mg', 'Пулеметчик Б', 'm249', 'B'),
        new Soldier(cx - 8, cy + 16, 'US', 'grenadier', 'Гренадер Б', 'm4a1_gl', 'B'),
        new Soldier(cx - 30, cy + 24, 'US', 'rifleman', 'Стрелок Б', 'm4a1', 'B'),
    ];
}

export function init() {
    const ruUnits = createRussianSquad(150, 850);
    const usUnits = createUSSquad(850, 150);
    setRuUnits(ruUnits);
    setUsUnits(usUnits);
    setAllUnits([...ruUnits, ...usUnits]);

    setObjective({ x: WORLD.width / 2, y: WORLD.height / 2, radius: CONFIG.objectiveRadius, owner: 'neutral', holdTime: 0 });
    setSelectedUnits([ruUnits[0]]);

    for (let i = 1; i < ruUnits.length; i++) ruUnits[i].followTarget = ruUnits[0];
}
