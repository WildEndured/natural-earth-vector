import { getAllUnits, getBullets, setBullets, getExplosions, setExplosions, getDamageTexts, setDamageTexts, getGameTime, setGameTime, getGameOver, setGameOver, getRuUnits, getUsUnits } from './state.js';
import { updateUSAI, updateRUAI } from './ai.js';
import { resolveCollisions } from './collisions.js';
import { checkObjective, endGame } from './game-logic.js'; // ← новый модуль
import { updateUI } from './ui.js';
import { draw } from './render.js';
import { camera } from './state.js';
import { clampCamera } from './camera.js';

export function update(dt) {
    if (getGameOver()) return;
    setGameTime(getGameTime() + dt);
    const pan = (camera.panSpeed / camera.zoom) * dt;
    // клавиши WASD
    // ...
    clampCamera();
    updateUSAI(dt); updateRUAI(dt);
    getAllUnits().forEach(u => u.update(dt, getAllUnits()));
    resolveCollisions();
    setBullets(getBullets().filter(b => b.life - dt > 0));
    // ... и т.д.
    updateUI();
}

export function loop(now) {
    const dt = Math.min(0.05, (now - loop._last) / 1000);
    loop._last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}
