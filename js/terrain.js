import { WORLD } from './config.js';

// ==================== УКРЫТИЯ ====================
export const obstacles = [];
export const decorations = [];
export let currentMapType = 'open';

export function setMapType(t) { currentMapType = t; }

export function generateMap(type) {
    currentMapType = type;
    obstacles.length = 0;
    decorations.length = 0;

    if (type === 'open') {
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const dist = 100 + Math.random() * 50;
            obstacles.push({ type: 'wall', x: WORLD.width/2 + Math.cos(angle) * dist, y: WORLD.height/2 + Math.sin(angle) * dist, w: 30 + Math.random()*20, h: 10 + Math.random()*10, rotation: 0 });
        }
        obstacles.push({ type: 'house', x: 300, y: 300, w: 60, h: 60, rotation: 0 });
        obstacles.push({ type: 'house', x: 700, y: 700, w: 60, h: 60, rotation: 0 });
    } else if (type === 'forest') {
        for (let i = 0; i < 70; i++) obstacles.push({ type: 'tree', x: 100 + Math.random() * (WORLD.width - 200), y: 100 + Math.random() * (WORLD.height - 200), w: 12 + Math.random()*8, h: 12 + Math.random()*8, rotation: 0 });
        for (let i = 0; i < 40; i++) decorations.push({ type: 'bush', x: 100 + Math.random() * (WORLD.width - 200), y: 100 + Math.random() * (WORLD.height - 200), r: 8 + Math.random()*6 });
    } else if (type === 'city') {
        const b = [
            {x: 200, y: 200, w: 80, h: 60}, {x: 500, y: 150, w: 70, h: 90},
            {x: 800, y: 250, w: 90, h: 70}, {x: 250, y: 500, w: 60, h: 100},
            {x: 750, y: 550, w: 80, h: 80}, {x: 450, y: 750, w: 70, h: 60},
            {x: 150, y: 800, w: 100, h: 50}, {x: 850, y: 800, w: 60, h: 100}
        ];
        b.forEach(pos => obstacles.push({ type: 'house', ...pos, rotation: 0 }));
        for (let i = 0; i < 8; i++) obstacles.push({ type: 'car', x: 100 + Math.random() * (WORLD.width - 200), y: 100 + Math.random() * (WORLD.height - 200), w: 25, h: 12, rotation: 0, hp: 100 });
        for (let i = 0; i < 10; i++) obstacles.push({ type: 'wall', x: 100 + Math.random() * (WORLD.width - 200), y: 100 + Math.random() * (WORLD.height - 200), w: 30, h: 10, rotation: 0 });
    }
}

// Проверка: пересекает ли отрезок (лучи) какое-либо укрытие
export function rayHitsObstacle(x1, y1, x2, y2) {
    for (const obs of obstacles) {
        if (obs.type === 'tree') continue;
        const minX = obs.x - obs.w/2, maxX = obs.x + obs.w/2;
        const minY = obs.y - obs.h/2, maxY = obs.y + obs.h/2;
        let t0 = 0, t1 = 1;
        const dx = x2 - x1, dy = y2 - y1;
        const p = [-dx, dx, -dy, dy];
        const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
        let intersects = true;
        for (let i = 0; i < 4; i++) {
            if (p[i] === 0) { if (q[i] < 0) { intersects = false; break; } }
            else {
                const r = q[i] / p[i];
                if (p[i] < 0) { if (r > t1) { intersects = false; break; } if (r > t0) t0 = r; }
                else { if (r < t0) { intersects = false; break; } if (r < t1) t1 = r; }
            }
        }
        if (intersects && t0 < t1) return obs;
    }
    return null;
}

// Точка внутри укрытия (с возможностью пропустить типы)
export function pointInObstacle(x, y, skipTypes = []) {
    for (const obs of obstacles) {
        if (skipTypes.includes(obs.type)) continue;
        if (x > obs.x - obs.w/2 && x < obs.x + obs.w/2 &&
            y > obs.y - obs.h/2 && y < obs.y + obs.h/2) return obs;
    }
    return null;
}
