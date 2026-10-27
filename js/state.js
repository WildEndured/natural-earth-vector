// ==================== СОСТОЯНИЕ ====================
// Все переменные, которые меняются по ходу игры

export let ruUnits = [];
export let usUnits = [];
export let allUnits = [];
export let selectedUnits = [];
export let bullets = [];
export let explosions = [];
export let damageTexts = [];

export let objective = { x: 0, y: 0, radius: 60, owner: 'neutral', holdTime: 0 };
export let gameTime = 0;
export let gameOver = false;
export let orderMode = 'move';
export let globalAIMode = true;

// Для конфигурации камеры (изменяется динамически)
export const camera = { x: 500, y: 500, zoom: 0.8, minZoom: 0.3, maxZoom: 4.0, panSpeed: 800 };

// Функции-сеттеры для изменения (ES-модули не позволяют менять let-переменные напрямую)
export function setRuUnits(arr) { ruUnits = arr; }
export function setUsUnits(arr) { usUnits = arr; }
export function setAllUnits(arr) { allUnits = arr; }
export function setSelectedUnits(arr) { selectedUnits = arr; }
export function setBullets(arr) { bullets = arr; }
export function setExplosions(arr) { explosions = arr; }
export function setDamageTexts(arr) { damageTexts = arr; }
export function setObjective(obj) { objective = obj; }
export function setGameTime(t) { gameTime = t; }
export function setGameOver(v) { gameOver = v; }
export function setOrderMode(mode) { orderMode = mode; }
export function setGlobalAIMode(v) { globalAIMode = v; }

// Мутабельные операции (чтобы не переприсваивать массив целиком)
export function pushBullet(b) { bullets.push(b); }
export function pushExplosion(e) { explosions.push(e); }
export function pushDamageText(t) { damageTexts.push(t); }
export function filterBullets(fn) { bullets = bullets.filter(fn); }
export function filterExplosions(fn) { explosions = explosions.filter(fn); }
export function filterDamageTexts(fn) { damageTexts = damageTexts.filter(fn); }

// Вспомогательные
export function addToSelected(u) { selectedUnits.push(u); }
export function resetGame() {
    ruUnits = []; usUnits = []; allUnits = [];
    selectedUnits = []; bullets = []; explosions = []; damageTexts = [];
    gameTime = 0; gameOver = false; globalAIMode = true;
    orderMode = 'move';
}
