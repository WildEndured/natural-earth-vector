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
import { pointInBlockingObstacle } from './systems/RaycastSystem.js';
import { BODY_PARTS } from './data/anatomy.js';
import { reformatInPlace } from './util/formation.js';

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
const unitInfoEl = document.getElementById('unit-info');
const unitInfoBody = document.getElementById('unit-info-body');
const btnMove = document.getElementById('btn-move');
const btnAttack = document.getElementById('btn-attack');
const btnHold = document.getElementById('btn-hold');
const btnSelectAll = document.getElementById('btn-select-all');
const btnStand = document.getElementById('btn-stand');
const btnCrouch = document.getElementById('btn-crouch');
const btnProne = document.getElementById('btn-prone');
const btnReload = document.getElementById('btn-reload');
const timeBtns = document.querySelectorAll('.time-btn');
const formationBtns = document.querySelectorAll('.formation-btn');

// ===== СОСТОЯНИЕ =====
let game = null;
let ctx = null;
let audio = null;
let orderMode = 'move';
let currentFormation = 'line';
let hudInterval = null;

// ===== УТИЛИТЫ =====
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ===== РЕЖИМЫ =====
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

function setFormationMode(formationId) {
  currentFormation = formationId;
  formationBtns.forEach(b => b.classList.toggle('active', b.dataset.formation === formationId));
  if (!ctx) return;
  const units = ctx.world.selectedUnits;
  if (units.length === 0) return;

  const leader = units.find(u => u.role === 'commander' || u.role === 'squad_leader');
  if (leader && leader.squad) {
    leader.squad.formation = formationId;
    reformatInPlace(leader.squad, formationId);
  }
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

// время
timeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (!ctx) return;
    const speed = parseInt(btn.dataset.speed, 10);
    ctx.timeSystem.setScale(speed);
    audio && audio.uiClick();
  });
});

// формации
formationBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    setFormationMode(btn.dataset.formation);
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

// ===== ПАНЕЛЬ ЮНИТА =====
const PART_NAMES = {
  head: 'Голова',
  torso: 'Торс',
  leftArm: 'Л. рука',
  rightArm: 'П. рука',
  leftLeg: 'Л. нога',
  rightLeg: 'П. нога',
};

function updateUnitInfo() {
  if (!ctx || !unitInfoEl) return;
  const units = ctx.world.selectedUnits;
  if (units.length === 0) {
    unitInfoEl.classList.add('hidden');
    return;
  }
  unitInfoEl.classList.remove('hidden');

  if (units.length > 1) {
    let alive = 0, wounded = 0, crippled = 0;
    for (const u of units) {
      if (u.dead) continue;
      alive++;
      if (!u.health.canWalk()) crippled++;
      else if (u.hp / u.maxHp < 0.6) wounded++;
    }
    unitInfoBody.innerHTML = `
      <div class="ui-row"><b>Отряд</b></div>
      <div class="ui-row">Живых: <b>${alive}/${units.length}</b></div>
      <div class="ui-row">Раненых: <b>${wounded}</b></div>
      <div class="ui-row">Неходячих: <b>${crippled}</b></div>
    `;
    return;
  }

  const u = units[0];
  if (u.dead) {
    unitInfoBody.innerHTML = `<div class="ui-row"><b>Мёртв</b> — ${u.health.deathCause || '?'}</div>`;
    return;
  }

  let html = `<div class="ui-row"><b>${u.role === 'commander' || u.role === 'squad_leader' ? '★ ' : ''}${u.roleName || u.role}</b></div>`;
  html += `<div class="ui-parts">`;
  for (const key of ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
    const p = u.health.parts[key];
    const def = BODY_PARTS[key];
    const frac = p.hp / p.maxHp;
    const color = frac > 0.6 ? '#3c3' : frac > 0.3 ? '#fc3' : '#f33';
    const bleed = p.bleeding > 0 ? ' 🩸' : '';
    html += `<div class="ui-part">
      <span class="ui-part-name">${PART_NAMES[key]}${bleed}</span>
      <div class="ui-part-bar"><div class="ui-part-fill" style="width:${frac * 100}%;background:${color}"></div></div>
      <span class="ui-part-num">${Math.round(p.hp)}/${def.hp}</span>
    </div>`;
  }
  html += `</div>`;

  html += `<div class="ui-row">HP: <b>${u.hp}/${u.maxHp}</b></div>`;
  if (u.health.bloodLoss > 5) {
    html += `<div class="ui-row ui-warn">Кровопотеря: <b>${Math.round(u.health.bloodLoss)}/100</b></div>`;
  }
  if (!u.health.canWalk()) html += `<div class="ui-row ui-danger">Не может идти</div>`;
  if (!u.health.canShoot()) html += `<div class="ui-row ui-danger">Не может стрелять</div>`;
  html += `<div class="ui-row">Патроны: <b>${u.ammo}/${u.weapon.magSize}</b>${u.isReloading ? ' (перезарядка)' : ''}</div>`;
  html += `<div class="ui-row">Стойка: <b>${u.stance === 'stand' ? 'Стоя' : u.stance === 'crouch' ? 'С колена' : 'Лёжа'}</b></div>`;

  unitInfoBody.innerHTML = html;
}

// ===== СПАВН =====
function findFreeSpot(x, y) {
  if (!ctx) return { x, y };
  if (!pointInBlockingObstacle(x, y, ctx.world.obstacles)) return { x, y };
  for (let r = 3; r < 40; r += 2) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const nx = x + Math.cos(a) * r;
      const ny = y + Math.sin(a) * r;
      if (nx < 0 || nx > ctx.world.width || ny < 0 || ny > ctx.world.height) continue;
      if (!pointInBlockingObstacle(nx, ny, ctx.world.obstacles)) return { x: nx, y: ny };
    }
  }
  return { x, y };
}

function spawnSquads() {
  const ruSpawn = ctx.world.getSpawn('RU');
  const usSpawn = ctx.world.getSpawn('US');

  const ruSquad = ctx.world.createSquad({ team: 'RU', name: '1-е отделение' });
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const r = i === 0 ? 0 : 10;
    const spot = findFreeSpot(ruSpawn.x + Math.cos(angle) * r, ruSpawn.y + Math.sin(angle) * r);
    const u = ctx.world.createUnit({
      x: spot.x,
      y: spot.y,
      team: 'RU',
      role: i === 0 ? 'commander' : 'rifleman',
      weaponId: 'ak74m',
      squad: ruSquad,
    });
    u.roleName = i === 0 ? 'Командир отделения' : 'Стрелок';
  }

  const usSquad = ctx.world.createSquad({ team: 'US', name: 'Alpha' });
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const r = i === 0 ? 0 : 10;
    const spot = findFreeSpot(usSpawn.x + Math.cos(angle) * r, usSpawn.y + Math.sin(angle) * r);
    const u = ctx.world.createUnit({
      x: spot.x,
      y: spot.y,
      team: 'US',
      role: i === 0 ? 'squad_leader' : 'rifleman',
      weaponId: 'm4a1',
      squad: usSquad,
    });
    u.roleName = i === 0 ? 'Squad Leader' : 'Rifleman';
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

  ctx.bus.on('selection:changed', () => updateUnitInfo());

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
  updateUnitInfo();
  setFormationMode('line');

  hudInterval = setInterval(() => {
    updateHudCounts();
    updateObjectiveHud();
    updateTimeHud();
    updateUnitInfo();
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

document.querySelectorAll('.map-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    startGame(btn.dataset.map);
  });
});

mapSelectEl.classList.remove('hidden');
