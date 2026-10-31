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

// ===== DOM =====
const canvas = document.getElementById('game');
const minimapCanvas = document.getElementById('minimap');
const mapSelectEl = document.getElementById('map-select');
const gameOverEl = document.getElementById('game-over');
const resultText = document.getElementById('result-text');
const btnRestart = document.getElementById('btn-restart');
const ruCountEl = document.getElementById('ru-count');
const usCountEl = document.getElementById('us-count');
const objTitle = document.getElementById('objective-title');
const objFill = document.getElementById('objective-fill');
const timeDisplay = document.getElementById('time-display');
const btnMove = document.getElementById('btn-move');
const btnAttack = document.getElementById('btn-attack');
const btnHold = document.getElementById('btn-hold');
const btnSelectAll = document.getElementById('btn-select-all');
const btnStand = document.getElementById('btn-stand');
const btnCrouch = document.getElementById('btn-crouch');
const btnProne = document.getElementById('btn-prone');
const btnReload = document.getElementById('btn-reload');
const timeBtns = document.querySelectorAll('.time-btn');

// ===== СОСТОЯНИЕ =====
let game = null;
let ctx = null;
let audio = null;
let orderMode = 'move';
let hudInterval = null;

// ===== УТИЛИТЫ =====
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ===== ПРИКАЗЫ =====
function setOrderMode(mode) {
  orderMode = mode;
  [btnMove, btnAttack, btnHold].forEach(b => b.classList.remove('active'));
  if (mode === 'move') btnMove.classList.add('active');
  if (mode === 'attack') btnAttack.classList.add('active');
  if (mode === 'hold') btnHold.classList.add('active');
}

function setStanceMode(mode) {
  [btnStand, btnCrouch, btnProne].forEach(b => b.classList.remove('active'));
  if (mode === 'stand') btnStand.classList.add('active');
  if (mode === 'crouch') btnCrouch.classList.add('active');
  if (mode === 'prone') btnProne.classList.add('active');
  if (!ctx) return;
  for (const u of ctx.world.selectedUnits) u.desiredStance = mode;
}

// ===== ПОДПИСКИ UI =====
btnMove.addEventListener('click', () => { setOrderMode('move'); audio && audio.uiClick(); });
btnAttack.addEventListener('click', () => { setOrderMode('attack'); audio && audio.uiClick(); });
btnHold.addEventListener('click', () => { setOrderMode('hold'); audio && audio.uiClick(); });
btnSelectAll.addEventListener('click', () => {
  if (!ctx) return;
  const ruSquad = ctx.world.getSquad('RU');
  if (ruSquad) ctx.selection.selectSquad(ruSquad);
  audio && audio.uiClick();
});
btnStand.addEventListener('click', () => { setStanceMode('stand'); audio && audio.uiClick(); });
btnCrouch.addEventListener('click', () => { setStanceMode('crouch'); audio && audio.uiClick(); });
btnProne.addEventListener('click', () => { setStanceMode('prone'); audio && audio.uiClick(); });
btnReload.addEventListener('click', () => {
  if (!ctx) return;
  for (const u of ctx.world.selectedUnits) {
    if (u.dead || u.isReloading) continue;
    u.isReloading = true;
    u.reloadTimer = u.weapon.reloadTime;
    audio && audio.reload();
  }
});

// ===== ВРЕМЯ =====
timeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (!ctx) return;
    const speed = parseInt(btn.dataset.speed, 10);
    ctx.timeSystem.setScale(speed);
    audio && audio.uiClick();
  });
});

function updateTimeButtons() {
  if (!ctx) return;
  const scale = ctx.timeSystem.scale;
  timeBtns.forEach(btn => {
    const speed = parseInt(btn.dataset.speed, 10);
    btn.classList.toggle('active', speed === scale);
  });
}

// ===== HUD =====
function updateHudCounts() {
  if (!ctx) return;
  const ru = ctx.world.getSquad('RU');
  const us = ctx.world.getSquad('US');
  if (ru) ruCountEl.textContent = `${ru.aliveCount}/${ru.units.length}`;
  if (us) usCountEl.textContent = `${us.aliveCount}/${us.units.length}`;
}

function updateObjectiveHud() {
  if (!ctx) return;
  const o = ctx.world.objective;
  const owner = o.owner === 'RU' ? '🇷🇺 РФ' : o.owner === 'US' ? '🇺🇸 США' : 'нейтральна';
  objTitle.textContent = `Точка: ${owner}`;
  const pct = Math.min(100, (o.holdTime / 5) * 100);
  objFill.style.width = `${pct}%`;
}

function updateTimeHud() {
  if (!ctx) return;
  const t = game.time;
  const scale = ctx.timeSystem.scale;
  const label = scale === 0 ? '⏸' : `${scale}×`;
  timeDisplay.textContent = `${formatTime(t)} · ${label}`;
}

// ===== СПАВН ОТРЯДОВ =====
// РФ: 1 командир + 9 стрелков = 10
// США: 1 лидер + 9 стрелков = 10
function spawnSquads() {
  const ruSpawn = ctx.world.getSpawn('RU');
  const usSpawn = ctx.world.getSpawn('US');

  // --- РФ ---
  const ruSquad = ctx.world.createSquad({ team: 'RU', name: '1-е отделение' });
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const r = i === 0 ? 0 : 10; // командир в центре, остальные кольцом
    ctx.world.createUnit({
      x: ruSpawn.x + Math.cos(angle) * r,
      y: ruSpawn.y + Math.sin(angle) * r,
      team: 'RU',
      role: i === 0 ? 'commander' : 'rifleman',
      weaponId: 'ak74m',
      squad: ruSquad,
    });
  }

  // --- США ---
  const usSquad = ctx.world.createSquad({ team: 'US', name: 'Alpha' });
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const r = i === 0 ? 0 : 10;
    ctx.world.createUnit({
      x: usSpawn.x + Math.cos(angle) * r,
      y: usSpawn.y + Math.sin(angle) * r,
      team: 'US',
      role: i === 0 ? 'squad_leader' : 'rifleman',
      weaponId: 'm4a1',
      squad: usSquad,
    });
  }

  updateHudCounts();
}

// ===== СТАРТ =====
function startGame(mapId) {
  if (game) {
    if (hudInterval) clearInterval(hudInterval);
    game.dispose();
    game = null;
    ctx = null;
  }

  mapSelectEl.classList.add('hidden');
  gameOverEl.classList.add('hidden');

  game = new Game({ canvas, mapId });
  ctx = game.ctx;

  const input = new InputSystem(canvas, ctx);
  const selection = new SelectionSystem(ctx);
  const orders = new OrderSystem(ctx);
  const movement = new MovementSystem(ctx);
  const combat = new CombatSystem(ctx);
  audio = new AudioSystem(ctx);
  const squadAI = new SquadAI(ctx);
  const unitAI = new UnitAI(ctx);
  const objective = new ObjectiveSystem(ctx);
  const victory = new VictorySystem(ctx);
  const stance = new StanceSystem(ctx);
  const minimap = new Minimap(minimapCanvas, ctx);

  ctx.selection = selection;

  game.registerSystems(movement, stance, squadAI, unitAI, combat, objective, victory);
  game.setMinimap(minimap);

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

  ctx.bus.on('combat:shot', (shot) => {
    audio.shot(shot.weaponId);
    game.renderer.addBullet(shot);
  });

  ctx.bus.on('unit:hit', () => audio.hit());
  ctx.bus.on('unit:died', () => { audio.death(); updateHudCounts(); });
  ctx.bus.on('unit:reload', () => audio.reload());

  ctx.bus.on('game:over', ({ winner }) => {
    game.paused = true;
    game.gameOver = true;
    resultText.textContent = winner === 'RU' ? '🏆 Победа России!' : '🏆 Победа США!';
    gameOverEl.classList.remove('hidden');
  });

  ctx.bus.on('objective:captured', () => audio.explosion());

  ctx.bus.on('time:changed', () => {
    updateTimeButtons();
    updateTimeHud();
  });

  spawnSquads();
  game.start();

  ctx.timeSystem.setScale(1);
  updateTimeButtons();
  updateTimeHud();

  hudInterval = setInterval(() => {
    updateHudCounts();
    updateObjectiveHud();
    updateTimeHud();
  }, 200);

  btnRestart.onclick = () => {
    if (hudInterval) clearInterval(hudInterval);
    gameOverEl.classList.add('hidden');
    mapSelectEl.classList.remove('hidden');
    game.dispose();
    game = null;
    ctx = null;
  };
}

// ===== МЕНЮ КАРТ =====
document.querySelectorAll('.map-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    startGame(btn.dataset.map);
  });
});

mapSelectEl.classList.remove('hidden');
