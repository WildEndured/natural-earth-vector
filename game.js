// ==================== КОНФИГУРАЦИЯ ====================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const mctx = minimapCanvas.getContext('2d');
minimapCanvas.width = 180;
minimapCanvas.height = 180;

let W, H;
function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ==================== МИР 1×1 КМ ====================
// 1 единица мира = 1 метр. Карта 1000×1000 м.
const WORLD = { width: 1000, height: 1000 };

const camera = {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    zoom: 1.4,
    minZoom: 0.35,
    maxZoom: 3.0,
    panSpeed: 800,
};

const CONFIG = {
    soldierRadius: 3.5,
    speed: 6,
    viewRange: 280,
    attackRange: 220,
    mgRange: 400,
    atRange: 500,
    fireRateStandard: 0.6,
    fireRateMG: 0.1,
    fireRateAT: 5.0,
    damageStandard: 30,
    damageMG: 15,
    damageAT: 120,
    objectiveRadius: 60,
};

// ==================== КЛАСС SOLDIER ====================
class Soldier {
    constructor(x, y, team, role, roleName) {
        this.x = x;
        this.y = y;
        this.team = team;
        this.role = role;
        this.roleName = roleName;
        this.radius = CONFIG.soldierRadius;
        this.hp = 100;
        this.maxHp = 100;
        this.dead = false;
        this.target = null;
        this.moveTarget = null;
        this.followTarget = null;
        this.state = 'idle';
        this.cooldown = 0;
        this.facing = 0;
        this.muzzleFlash = 0;
        this.holding = false;

        if (role === 'mg') {
            this.range = CONFIG.mgRange;
            this.damage = CONFIG.damageMG;
            this.fireRate = CONFIG.fireRateMG;
        } else if (role === 'at') {
            this.range = CONFIG.atRange;
            this.damage = CONFIG.damageAT;
            this.fireRate = CONFIG.fireRateAT;
        } else {
            this.range = CONFIG.attackRange;
            this.damage = CONFIG.damageStandard;
            this.fireRate = CONFIG.fireRateStandard;
        }
    }

    update(dt, allUnits) {
        if (this.dead) return;
        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.muzzleFlash > 0) this.muzzleFlash -= dt;

        this.target = this.findEnemy(allUnits);

        if (this.target && this.distanceTo(this.target) <= this.range) {
            this.state = 'attacking';
            this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            if (this.cooldown <= 0) this.fire();
        } else if (this.holding && this.moveTarget) {
            this.state = 'holding';
        } else if (this.moveTarget) {
            this.state = 'moving';
            this.moveToward(this.moveTarget.x, this.moveTarget.y, dt);
            if (this.distanceTo(this.moveTarget) < 3) this.moveTarget = null;
        } else if (this.followTarget && !this.followTarget.dead) {
            const d = this.distanceTo(this.followTarget);
            if (d > 18) {
                this.moveToward(this.followTarget.x, this.followTarget.y, dt);
                this.state = 'moving';
            } else {
                this.state = 'idle';
            }
        } else if (this.target) {
            this.state = 'moving';
            this.moveToward(this.target.x, this.target.y, dt);
        } else {
            this.state = 'idle';
        }
    }

    fire() {
        this.cooldown = this.fireRate;
        this.muzzleFlash = 0.06;
        const t = this.target;
        if (!t || t.dead) return;
        const dmg = this.damage * (0.85 + Math.random() * 0.3);
        t.hp -= dmg;
        if (t.hp <= 0) {
            t.hp = 0;
            t.dead = true;
            if (t === selectedUnits[0]) selectedUnits = [ruUnits[0]];
        }
        bullets.push({
            x: this.x, y: this.y,
            tx: t.x, ty: t.y,
            color: this.team === 'RU' ? '#ffdd55' : '#66ddff',
            life: 0.15,
        });
    }

    findEnemy(allUnits) {
        let best = null, bestDist = Infinity;
        for (const u of allUnits) {
            if (u.dead || u.team === this.team) continue;
            const d = this.distanceTo(u);
            if (d < CONFIG.viewRange && d < bestDist) {
                bestDist = d;
                best = u;
            }
        }
        return best;
    }

    moveToward(tx, ty, dt) {
        const dx = tx - this.x, dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.5) return;
        const spd = CONFIG.speed * (this.team === 'RU' ? 1 : 1.03);
        const step = Math.min(dist, spd * dt);
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        this.facing = Math.atan2(dy, dx);
        this.x = Math.max(2, Math.min(WORLD.width - 2, this.x));
        this.y = Math.max(2, Math.min(WORLD.height - 2, this.y));
    }

    distanceTo(other) {
        return Math.hypot(other.x - this.x, other.y - this.y);
    }

    draw(ctx) {
        if (this.dead) {
            ctx.fillStyle = 'rgba(80,80,80,0.4)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        const baseColor = this.team === 'RU' ? '#d52b1e' : '#3c6eb6';
        const isCommander = this.role === 'commander' || this.role === 'squad_leader';
        const isSelected = selectedUnits.includes(this);

        if (isSelected) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1.5 / camera.zoom;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        if (isCommander) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1.2 / camera.zoom;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 0.6 / camera.zoom;
            ctx.stroke();
        }

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2 / camera.zoom;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.facing) * (this.radius + 3),
                   this.y + Math.sin(this.facing) * (this.radius + 3));
        ctx.stroke();

        if (this.muzzleFlash > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(this.x + Math.cos(this.facing) * (this.radius + 2),
                    this.y + Math.sin(this.facing) * (this.radius + 2),
                    2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        const hpFrac = this.hp / this.maxHp;
        const barW = 12 / camera.zoom;
        const barH = 2 / camera.zoom;
        if (hpFrac < 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - barW / 2, this.y - this.radius - 5 / camera.zoom, barW, barH);
            ctx.fillStyle = hpFrac > 0.5 ? '#3c3' : hpFrac > 0.25 ? '#fc3' : '#f33';
            ctx.fillRect(this.x - barW / 2, this.y - this.radius - 5 / camera.zoom, barW * hpFrac, barH);
        }

        if (camera.zoom > 1.2) {
            const labels = {
                commander: 'К', squad_leader: 'К',
                mg: 'П', senior: 'СС', rifleman: 'С', at: 'Г', at_assist: 'ПГ'
            };
            if (labels[this.role]) {
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${7 / camera.zoom}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(labels[this.role], this.x, this.y + 2.5 / camera.zoom);
            }
        }
    }
}

// ==================== СОСТОЯНИЕ ИГРЫ ====================
let ruUnits = [];
let usUnits = [];
let allUnits = [];
let selectedUnits = [];
let bullets = [];
let objective = { x: 0, y: 0, radius: CONFIG.objectiveRadius, owner: 'neutral', holdTime: 0 };
let gameTime = 0;
let gameOver = false;
let orderMode = 'move';

function createRussianSquad(cx, cy) {
    return [
        new Soldier(cx, cy, 'RU', 'commander', 'Командир отделения'),
        new Soldier(cx + 8, cy + 6, 'RU', 'mg', 'Пулеметчик'),
        new Soldier(cx - 8, cy + 6, 'RU', 'senior', 'Старший стрелок'),
        new Soldier(cx + 4, cy + 12, 'RU', 'rifleman', 'Стрелок'),
        new Soldier(cx - 4, cy + 12, 'RU', 'at', 'Гранатометчик'),
        new Soldier(cx + 12, cy + 12, 'RU', 'at_assist', 'Пом. гранатометчика'),
    ];
}

function createUSSquad(cx, cy) {
    return [
        new Soldier(cx, cy, 'US', 'squad_leader', 'Ком. отделения'),
        new Soldier(cx + 12, cy + 4, 'US', 'commander', 'Ком. группы А'),
        new Soldier(cx - 12, cy + 4, 'US', 'commander', 'Ком. группы Б'),
        new Soldier(cx + 16, cy + 12, 'US', 'mg', 'Пулеметчик А'),
        new Soldier(cx - 16, cy + 12, 'US', 'mg', 'Пулеметчик Б'),
        new Soldier(cx + 8, cy + 18, 'US', 'at', 'Гранатометчик А'),
        new Soldier(cx - 8, cy + 18, 'US', 'at', 'Гранатометчик Б'),
        new Soldier(cx, cy + 16, 'US', 'rifleman', 'Стрелок А'),
        new Soldier(cx + 22, cy + 16, 'US', 'rifleman', 'Стрелок Б'),
    ];
}

function init() {
    ruUnits = createRussianSquad(150, 850);
    usUnits = createUSSquad(850, 150);
    allUnits = [...ruUnits, ...usUnits];

    objective = {
        x: WORLD.width / 2,
        y: WORLD.height / 2,
        radius: CONFIG.objectiveRadius,
        owner: 'neutral',
        holdTime: 0
    };

    selectedUnits = [ruUnits[0]];
    for (let i = 1; i < ruUnits.length; i++) {
        ruUnits[i].followTarget = ruUnits[0];
    }

    camera.x = ruUnits[0].x;
    camera.y = ruUnits[0].y;
    camera.zoom = 1.4;
    clampCamera();

    updateUI();
}

// ==================== КАМЕРА ====================
function screenToWorld(sx, sy) {
    return {
        x: (sx - W / 2) / camera.zoom + camera.x,
        y: (sy - H / 2) / camera.zoom + camera.y
    };
}
function worldToScreen(wx, wy) {
    return {
        x: (wx - camera.x) * camera.zoom + W / 2,
        y: (wy - camera.y) * camera.zoom + H / 2
    };
}

function clampCamera() {
    const halfW = (W / 2) / camera.zoom;
    const halfH = (H / 2) / camera.zoom;
    if (WORLD.width * camera.zoom < W) camera.x = WORLD.width / 2;
    else camera.x = Math.max(halfW, Math.min(WORLD.width - halfW, camera.x));
    if (WORLD.height * camera.zoom < H) camera.y = WORLD.height / 2;
    else camera.y = Math.max(halfH, Math.min(WORLD.height - halfH, camera.y));
}

// ==================== ВВОД ====================
let mouse = { x: 0, y: 0 };
const keys = {};
let e_shift = false;

canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

canvas.addEventListener('mousedown', (e) => {
    if (gameOver) return;
    const wp = screenToWorld(e.clientX, e.clientY);
    if (e.button === 0) handleLeftClick(wp.x, wp.y);
    else if (e.button === 2) handleRightClick(wp.x, wp.y);
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const wp = screenToWorld(e.clientX, e.clientY);
    const before = { ...wp };
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * factor));
    const after = screenToWorld(e.clientX, e.clientY);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    clampCamera();
}, { passive: false });

document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Shift') e_shift = true;
    if (e.key === 'Escape' && !gameOver) {
        selectedUnits = [ruUnits[0]];
        updateSelectedUI();
    }
});
document.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === 'Shift') e_shift = false;
});

function handleLeftClick(wx, wy) {
    for (const u of allUnits) {
        if (u.dead || u.team !== 'RU') continue;
        if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 4 / camera.zoom) {
            selectedUnits = [u];
            updateSelectedUI();
            return;
        }
    }
    for (const u of allUnits) {
        if (u.dead || u.team !== 'US') continue;
        if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 5 / camera.zoom) {
            selectedUnits.forEach(s => {
                s.moveTarget = { x: u.x, y: u.y };
                s.holding = false;
            });
            showStatus(`Атака на ${u.roleName}!`);
            return;
        }
    }
    if (!selectedUnits.length) selectedUnits = [ruUnits[0]];
}

function handleRightClick(wx, wy) {
    if (orderMode === 'move') {
        selectedUnits.forEach(u => {
            u.moveTarget = { x: wx, y: wy };
            u.followTarget = null;
            u.holding = false;
        });
        showStatus('Движение');
    } else if (orderMode === 'attack') {
        selectedUnits.forEach(u => {
            u.moveTarget = { x: wx, y: wy };
            u.holding = false;
        });
        showStatus('Атака в точку');
    } else if (orderMode === 'hold') {
        selectedUnits.forEach(u => {
            u.moveTarget = { x: u.x, y: u.y };
            u.followTarget = null;
            u.holding = true;
        });
        showStatus('Держать позицию');
    } else if (orderMode === 'follow') {
        const commander = ruUnits.find(u => u.role === 'commander');
        ruUnits.forEach(u => {
            if (u !== commander && !u.dead) {
                u.followTarget = commander;
                u.moveTarget = null;
                u.holding = false;
            }
        });
        showStatus('Следовать за командиром');
    }
}

document.getElementById('btn-move').onclick = () => setOrderMode('move');
document.getElementById('btn-attack').onclick = () => setOrderMode('attack');
document.getElementById('btn-hold').onclick = () => setOrderMode('hold');
document.getElementById('btn-follow').onclick = () => setOrderMode('follow');

function setOrderMode(mode) {
    orderMode = mode;
    document.querySelectorAll('#orders button').forEach(b => b.classList.remove('active'));
    const map = { move: 'btn-move', attack: 'btn-attack', hold: 'btn-hold', follow: 'btn-follow' };
    document.getElementById(map[mode]).classList.add('active');
    showStatus('Режим: ' + ({ move: 'Движение', attack: 'Атака', hold: 'Держать', follow: 'Следовать' })[mode]);
}

function showStatus(msg) {
    const el = document.getElementById('status-message');
    el.textContent = msg;
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => { el.textContent = ''; }, 2000);
}

function updateSelectedUI() {
    if (!selectedUnits.length) return;
    const u = selectedUnits[0];
    document.getElementById('selected-unit').textContent = `Выбран: ${u.roleName} (HP ${Math.ceil(u.hp)})`;
}

minimapCanvas.addEventListener('mousedown', e => {
    const rect = minimapCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    camera.x = mx * WORLD.width;
    camera.y = my * WORLD.height;
    clampCamera();
});

// ==================== ИИ США ====================
function updateUSAI(dt) {
    const usAlive = usUnits.filter(u => !u.dead);
    const commander = usAlive.find(u => u.role === 'squad_leader');
    if (commander && !commander.moveTarget) {
        commander.moveTarget = { x: objective.x, y: objective.y };
    }
    const groupLeaders = usAlive.filter(u => u.role === 'commander');
    groupLeaders.forEach(gl => {
        if (!gl.followTarget && commander) gl.followTarget = commander;
    });
    usAlive.forEach(u => {
        if (u.role === 'squad_leader' || u.role === 'commander') return;
        if (!u.followTarget) {
            const leader = groupLeaders.reduce((best, gl) => {
                const d = Math.hypot(gl.x - u.x, gl.y - u.y);
                return d < best.d ? { gl, d } : best;
            }, { gl: null, d: Infinity }).gl;
            if (leader) u.followTarget = leader;
        }
    });
}

// ==================== ОБНОВЛЕНИЕ ====================
function update(dt) {
    if (gameOver) return;
    gameTime += dt;

    const pan = (camera.panSpeed / camera.zoom) * dt;
    if (keys['a'] || keys['arrowleft']) camera.x -= pan;
    if (keys['d'] || keys['arrowright']) camera.x += pan;
    if (keys['w'] || keys['arrowup']) camera.y -= pan;
    if (keys['s'] || keys['arrowdown']) camera.y += pan;
    clampCamera();

    updateUSAI(dt);
    allUnits.forEach(u => u.update(dt, allUnits));

    bullets.forEach(b => b.life -= dt);
    bullets = bullets.filter(b => b.life > 0);

    checkObjective(dt);

    const ruAlive = ruUnits.filter(u => !u.dead).length;
    const usAlive = usUnits.filter(u => !u.dead).length;
    if (ruAlive === 0) endGame('US');
    else if (usAlive === 0) endGame('RU');

    updateUI();
}

function checkObjective(dt) {
    const ruNear = ruUnits.filter(u => !u.dead && Math.hypot(u.x - objective.x, u.y - objective.y) < objective.radius).length;
    const usNear = usUnits.filter(u => !u.dead && Math.hypot(u.x - objective.x, u.y - objective.y) < objective.radius).length;

    if (ruNear > 0 && usNear === 0) {
        if (objective.owner !== 'RU') {
            objective.holdTime += dt;
            if (objective.holdTime > 3) { objective.owner = 'RU'; objective.holdTime = 0; }
        }
    } else if (usNear > 0 && ruNear === 0) {
        if (objective.owner !== 'US') {
            objective.holdTime += dt;
            if (objective.holdTime > 3) { objective.owner = 'US'; objective.holdTime = 0; }
        }
    } else {
        objective.holdTime = Math.max(0, objective.holdTime - dt);
    }
}

function endGame(team) {
    gameOver = true;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('result-text').textContent =
        team === 'RU' ? '🏆 Победа России!' : '🏆 Победа США!';
}

function updateUI() {
    const ruAlive = ruUnits.filter(u => !u.dead).length;
    const usAlive = usUnits.filter(u => !u.dead).length;
    document.getElementById('ru-count').textContent = `Живых: ${ruAlive}/${ruUnits.length}`;
    document.getElementById('us-count').textContent = `Живых: ${usAlive}/${usUnits.length}`;

    const statusText = {
        neutral: 'нейтральна',
        RU: '🇷🇺 под контролем РФ',
        US: '🇺🇸 под контролем США'
    }[objective.owner];
    document.getElementById('objective-status').textContent = `(${statusText})`;

    const min = Math.floor(gameTime / 60).toString().padStart(2, '0');
    const sec = Math.floor(gameTime % 60).toString().padStart(2, '0');
    document.getElementById('mission-timer').textContent = `Время: ${min}:${sec}`;

    updateSelectedUI();
}

// ==================== РЕНДЕР ====================
function draw() {
    ctx.fillStyle = '#2d3a2e';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Границы мира
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 3 / camera.zoom;
    ctx.strokeRect(0, 0, WORLD.width, WORLD.height);

    // Сетка 100 м
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1 / camera.zoom;
    for (let x = 0; x <= WORLD.width; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
    }
    for (let y = 0; y <= WORLD.height; y += 100) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
    }

    // Крупная сетка 500 м
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5 / camera.zoom;
    for (let x = 0; x <= WORLD.width; x += 500) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
    }
    for (let y = 0; y <= WORLD.height; y += 500) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
    }

    // Объектив
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, objective.radius, 0, Math.PI * 2);
    const objColor = objective.owner === 'RU' ? 'rgba(213,43,30,0.25)' :
                     objective.owner === 'US' ? 'rgba(60,110,182,0.25)' :
                     'rgba(255,215,0,0.15)';
    ctx.fillStyle = objColor;
    ctx.fill();
    ctx.strokeStyle = objective.owner === 'RU' ? '#d52b1e' :
                       objective.owner === 'US' ? '#3c6eb6' : '#ffd700';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${16 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', objective.x, objective.y);

    if (objective.holdTime > 0) {
        const frac = Math.min(1, objective.holdTime / 3);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3 / camera.zoom;
        ctx.beginPath();
        ctx.arc(objective.x, objective.y, objective.radius + 8 / camera.zoom,
                -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
    }

    // Маршруты выбранных
    selectedUnits.forEach(u => {
        if (u.dead) return;
        if (u.moveTarget) {
            ctx.strokeStyle = 'rgba(255,215,0,0.5)';
            ctx.lineWidth = 1.5 / camera.zoom;
            ctx.setLineDash([6 / camera.zoom, 6 / camera.zoom]);
            ctx.beginPath();
            ctx.moveTo(u.x, u.y);
            ctx.lineTo(u.moveTarget.x, u.moveTarget.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });

    // Пули
    bullets.forEach(b => {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        const dx = b.tx - b.x, dy = b.ty - b.y;
        const d = Math.hypot(dx, dy) || 1;
        ctx.lineTo(b.x + (dx / d) * 40, b.y + (dy / d) * 40);
        ctx.stroke();
    });

    // Солдаты
    allUnits.forEach(u => u.draw(ctx));

    // Курсор-прицел
    if (mouse.x && mouse.y) {
        const wp = screenToWorld(mouse.x, mouse.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 8 / camera.zoom, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();

    // Рисуем миникарту
    drawMinimap();
}

function drawMinimap() {
    const mw = minimapCanvas.width;
    const mh = minimapCanvas.height;
    mctx.fillStyle = '#1a2418';
    mctx.fillRect(0, 0, mw, mh);

    // Сетка
    mctx.strokeStyle = 'rgba(255,255,255,0.1)';
    mctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        mctx.beginPath();
        mctx.moveTo(mw * i / 4, 0); mctx.lineTo(mw * i / 4, mh); mctx.stroke();
        mctx.beginPath();
        mctx.moveTo(0, mh * i / 4); mctx.lineTo(mw, mh * i / 4); mctx.stroke();
    }

    const scaleX = mw / WORLD.width;
    const scaleY = mh / WORLD.height;

    // Точка
    mctx.beginPath();
    mctx.arc(objective.x * scaleX, objective.y * scaleY, 8, 0, Math.PI * 2);
    mctx.fillStyle = objective.owner === 'RU' ? 'rgba(213,43,30,0.5)' :
                     objective.owner === 'US' ? 'rgba(60,110,182,0.5)' :
                     'rgba(255,215,0,0.3)';
    mctx.fill();
    mctx.strokeStyle = objective.owner === 'RU' ? '#d52b1e' :
                       objective.owner === 'US' ? '#3c6eb6' : '#ffd700';
    mctx.lineWidth = 1.5;
    mctx.stroke();

    // Солдаты
    allUnits.forEach(u => {
        if (u.dead) return;
        mctx.fillStyle = u.team === 'RU' ? '#d52b1e' : '#3c6eb6';
        mctx.beginPath();
        mctx.arc(u.x * scaleX, u.y * scaleY, 2, 0, Math.PI * 2);
        mctx.fill();
    });

    // Рамка видимой области камеры
    const halfW = (W / 2) / camera.zoom;
    const halfH = (H / 2) / camera.zoom;
    const vx = (camera.x - halfW) * scaleX;
    const vy = (camera.y - halfH) * scaleY;
    const vw = halfW * 2 * scaleX;
    const vh = halfH * 2 * scaleY;
    mctx.strokeStyle = 'rgba(255,255,255,0.7)';
    mctx.lineWidth = 1;
    mctx.strokeRect(vx, vy, vw, vh);
}

// ==================== ИГРОВОЙ ЦИКЛ ====================
let lastTime = performance.now();

function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

init();
setOrderMode('move');
requestAnimationFrame(loop);
