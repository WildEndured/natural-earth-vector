import { Game } from './core/Game.js';
import { InputSystem } from './systems/InputSystem.js';
import { SelectionSystem } from './systems/SelectionSystem.js';
import { OrderSystem } from './systems/OrderSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';

const canvas = document.getElementById('game');
const game = new Game({ canvas });
const ctx = game.ctx;

const input = new InputSystem(canvas, ctx);
const selection = new SelectionSystem(ctx);
const orders = new OrderSystem(ctx);
const movement = new MovementSystem(ctx);
const combat = new CombatSystem(ctx);
const audio = new AudioSystem(ctx);

game.registerSystems(movement, combat);

// UI
const ruCountEl = document.getElementById('ru-count');
const usCountEl = document.getElementById('us-count');
const btnMove = document.getElementById('btn-move');
const btnAttack = document.getElementById('btn-attack');
const btnHold = document.getElementById('btn-hold');
const btnSelectAll = document.getElementById('btn-select-all');

let orderMode = 'move';

function setOrderMode(mode) {
  orderMode = mode;
  [btnMove, btnAttack, btnHold].forEach(b => b.classList.remove('active'));
  if (mode === 'move') btnMove.classList.add('active');
  if (mode === 'attack') btnAttack.classList.add('active');
  if (mode === 'hold') btnHold.classList.add('active');
}

btnMove.addEventListener('click', () => { setOrderMode('move'); audio.uiClick(); });
btnAttack.addEventListener('click', () => { setOrderMode('attack'); audio.uiClick(); });
btnHold.addEventListener('click', () => { setOrderMode('hold'); audio.uiClick(); });
btnSelectAll.addEventListener('click', () => {
  const ruSquad = ctx.world.getSquad('RU');
  if (ruSquad) selection.selectSquad(ruSquad);
  audio.uiClick();
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

// выстрел → пуля + звук
ctx.bus.on('combat:shot', (shot) => {
  audio.shot(shot.weaponId);
  if (shot.hit) game.renderer.addBullet(shot);
  else game.renderer.addBullet(shot); // даже при промахе — визуальный след
});

// смерть → звук
ctx.bus.on('unit:died', () => {
  audio.death();
});

// обновление HUD
ctx.bus.on('selection:changed', updateHudCounts);

function updateHudCounts() {
  const ru = ctx.world.getSquad('RU');
  const us = ctx.world.getSquad('US');
  if (ru) ruCountEl.textContent = `${ru.aliveCount}/${ru.units.length}`;
  if (us) usCountEl.textContent = `${us.aliveCount}/${us.units.length}`;
}

// создаём отряды
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
game.start();

setInterval(updateHudCounts, 500);
