import { Game } from './core/Game.js';
import { InputSystem } from './systems/InputSystem.js';
import { SelectionSystem } from './systems/SelectionSystem.js';
import { OrderSystem } from './systems/OrderSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { UnitAI } from './systems/UnitAI.js';
import { SquadAI } from './systems/SquadAI.js';
import { ObjectiveSystem } from './systems/ObjectiveSystem.js';
import { VictorySystem } from './systems/VictorySystem.js';
import { StanceSystem } from './systems/StanceSystem.js';
import { Minimap } from './render/Minimap.js';

const canvas = document.getElementById('game');
const minimapCanvas = document.getElementById('minimap');

const game = new Game({ canvas });
const ctx = game.ctx;

const input = new InputSystem(canvas, ctx);
const selection = new SelectionSystem(ctx);
const orders = new OrderSystem(ctx);
const movement = new MovementSystem(ctx);
const combat = new CombatSystem(ctx);
const audio = new AudioSystem(ctx);
const squadAI = new SquadAI(ctx);
const unitAI = new UnitAI(ctx);
const objective = new ObjectiveSystem(ctx);
const victory = new VictorySystem(ctx);
const stance = new StanceSystem(ctx);
const minimap = new Minimap(minimapCanvas, ctx);

game.registerSystems(movement, stance, squadAI, unitAI, combat, objective, victory);
game.setMinimap(minimap);

// UI
const ruCountEl = document.getElementById('ru-count');
const usCountEl = document.getElementById('us-count');
const objTitle = document.getElementById('objective-title');
const objFill = document.getElementById('objective-fill');
const btnMove = document.getElementById('btn-move');
const btnAttack = document.getElementById('btn-attack');
const btnHold = document.getElementById('btn-hold');
const btnSelectAll = document.getElementById('btn-select-all');
const btnStand = document.getElementById('btn-stand');
const btnCrouch = document.getElementById('btn-crouch');
const btnProne = document.getElementById('btn-prone');
const btnReload = document.getElementById('btn-reload');
const gameOverEl = document.getElementById('game-over');
const resultText = document.getElementById('result-text');
const btnRestart = document.getElementById('btn-restart');

let orderMode = 'move';
let currentStance = 'stand';

function setOrderMode(mode) {
  orderMode = mode;
  [btnMove, btnAttack, btnHold].forEach(b => b.classList.remove('active'));
  if (mode === 'move') btnMove.classList.add('active');
  if (mode === 'attack') btnAttack.classList.add('active');
  if (mode === 'hold') btnHold.classList.add('active');
}

function setStanceMode(mode) {
  currentStance = mode;
  [btnStand, btnCrouch, btnProne].forEach(b => b.classList.remove('active'));
  if (mode === 'stand') btnStand.classList.add('active');
  if (mode === 'crouch') btnCrouch.classList.add('active');
  if (mode === 'prone') btnProne.classList.add('active');
  for (const u of ctx.world.selectedUnits) {
    u.desiredStance = mode;
  }
}

btnMove.addEventListener('click', () => { setOrderMode('move'); audio.uiClick(); });
btnAttack.addEventListener('click', () => { setOrderMode('attack'); audio.uiClick(); });
btnHold.addEventListener('click', () => { setOrderMode('hold'); audio.uiClick(); });
btnSelectAll.addEventListener('click', () => {
  const ruSquad = ctx.world.getSquad('RU');
  if (ruSquad) selection.selectSquad(ruSquad);
  audio.uiClick();
});
btnStand.addEventListener('click', () => { setStanceMode('stand'); audio.uiClick(); });
btnCrouch.addEventListener('click', () => { setStanceMode('crouch'); audio.uiClick(); });
btnProne.addEventListener('click', () => { setStanceMode('prone'); audio.uiClick(); });
btnReload.addEventListener('click', () => {
  for (const u of ctx.world.selectedUnits) {
    if (u.dead || u.isReloading) continue;
    u.isReloading = true;
    u.reloadTimer = u.weapon.reloadTime;
    audio.reload();
  }
});

// тап
ctx.bus.on('input:tap', ({ worldX, worldY }) => {
  const clickedUnit = selection.findUnitAt(worldX, worldY);
  if (clickedUnit) {
    selection.selectAt(worldX, worldY);
    return;
  }
  if (ctx.world.selectedUnits.length === 0) return;
  if (orderMode === 'move') orders.issueMove(worldX, worldY);
  else if (orderMode === 'attack') orders.issueAttack(worldX, worldY);
  else if (orderMode === 'hold') orders.issueHold();
});

// выстрел
ctx.bus.on('combat:shot', (shot) => {
  audio.shot(shot.weaponId);
  game.renderer.addBullet(shot);
});

// попадание
ctx.bus.on('unit:hit', () => audio.hit());

// смерть
ctx.bus.on('unit:died', () => {
  audio.death();
  updateHudCounts();
});

// перезарядка
ctx.bus.on('unit:reload', () => audio.reload());

// конец игры
ctx.bus.on('game:over', ({ winner }) => {
  game.paused = true;
  resultText.textContent = winner === 'RU' ? '🏆 Победа России!' : '🏆 Победа США!';
  gameOverEl.classList.remove('hidden');
});

// захват точки
ctx.bus.on('objective:captured', ({ team }) => {
  audio.explosion();
});

// HUD
function updateHudCounts() {
  const ru = ctx.world.getSquad('RU');
  const us = ctx.world.getSquad('US');
  if (ru) ruCountEl.textContent = `${ru.aliveCount}/${ru.units.length}`;
  if (us) usCountEl.textContent = `${us.aliveCount}/${us.units.length}`;
}

function updateObjectiveHud() {
  const o = ctx.world.objective;
  const owner = o.owner === 'RU' ? '🇷🇺 РФ' : o.owner === 'US' ? '🇺🇸 США' : 'нейтральна';
  objTitle.textContent = `Точка: ${owner}`;
  const pct = Math.min(100, (o.holdTime / 5) * 100);
  objFill.style.width = `${pct}%`;
}

// создаём отряды
function spawnSquads() {
  const ruSquad = ctx.world.createSquad({ team: 'RU', name: '1-е отделение' });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.world.createUnit({
      x: 200 + Math.cos(angle) * 30,
      y: 800 + Math.sin(angle) * 30,
      team: 'RU',
      role: i === 0 ? 'commander' : 'rifleman',
      weaponId: 'ak74m',
      squad: ruSquad,
    });
  }

  const usSquad = ctx.world.createSquad({ team: 'US', name: 'Alpha' });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.world.createUnit({
      x: 800 + Math.cos(angle) * 30,
      y: 200 + Math.sin(angle) * 30,
      team: 'US',
      role: i === 0 ? 'squad_leader' : 'rifleman',
      weaponId: 'm4a1',
      squad: usSquad,
    });
  }
  updateHudCounts();
}

spawnSquads();
game.start();

// перезапуск
btnRestart.addEventListener('click', () => {
  gameOverEl.classList.add('hidden');
  ctx.world.reset();
  ctx.world.objective.owner = 'neutral';
  ctx.world.objective.holdTime = 0;
  game.paused = false;
  game.gameOver = false;
  spawnSquads();
});

// периодические обновления
setInterval(() => {
  updateHudCounts();
  updateObjectiveHud();
}, 200);
