// ==================== КОНФИГУРАЦИЯ ====================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W, H;
function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Константы игры
const CONFIG = {
    soldierRadius: 8,
    speed: 40,             // пикселей в секунду
    viewRange: 260,
    attackRange: 220,      // дистанция стрельбы
    mgRange: 280,          // пулемётчик дальше
    atRange: 200,          // гранатомётчик
    bulletSpeed: 600,
    damageStandard: 25,
    damageMG: 15,          // пулемёт быстрее но слабее за выстрел
    damageAT: 70,          // ПТУР сильный
    fireRateStandard: 0.5, // сек
    fireRateMG: 0.1,       // пулемёт
    fireRateAT: 2.0,       // ПТУР
    objectiveRadius: 70,
};

// ==================== КЛАССЫ ====================
class Soldier {
    constructor(x, y, team, role, roleName) {
        this.x = x;
        this.y = y;
        this.team = team; // 'RU' | 'US'
        this.role = role; // 'commander' | 'mg' | 'rifleman' | 'senior' | 'at' | 'at_assist' | 'squad_leader'
        this.roleName = roleName;
        this.radius = CONFIG.soldierRadius;
        this.hp = 100;
        this.maxHp = 100;
        this.dead = false;
        this.target = null;      // текущая цель (враг)
        this.moveTarget = null;  // точка движения
        this.followTarget = null;// следовать за союзником
        this.state = 'idle';     // idle, moving, attacking, holding
        this.cooldown = 0;
        this.facing = 0;
        this.muzzleFlash = 0;

        // Параметры стрельбы зависят от роли
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

        // Поиск врага
        this.target = this.findEnemy(allUnits);

        // Приоритет: атака если враг в радиусе
        if (this.target && this.distanceTo(this.target) <= this.range) {
            this.state = 'attacking';
            this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            if (this.cooldown <= 0) this.fire();
        } else if (this.moveTarget) {
            this.state = 'moving';
            this.moveToward(this.moveTarget.x, this.moveTarget.y, dt);
            if (this.distanceTo(this.moveTarget) < 15) this.moveTarget = null;
        } else if (this.followTarget && !this.followTarget.dead) {
            const d = this.distanceTo(this.followTarget);
            if (d > 60) {
                this.moveToward(this.followTarget.x, this.followTarget.y, dt);
                this.state = 'moving';
            } else {
                this.state = 'idle';
            }
        } else if (this.target) {
            // Враг есть но далеко — подойти
            this.state = 'moving';
            this.moveToward(this.target.x, this.target.y, dt);
        } else {
            this.state = 'idle';
        }
    }

    fire() {
        this.cooldown = this.fireRate;
        this.muzzleFlash = 0.05;
        const t = this.target;
        if (!t || t.dead) return;
        // Попадание с небольшим разбросом
        const spread = 0.05;
        const dmg = this.damage * (0.9 + Math.random() * 0.2);
        t.hp -= dmg;
        if (t.hp <= 0) {
            t.hp = 0;
            t.dead = true;
        }
        // Визуальный эффект пули
        bullets.push({
            x: this.x, y: this.y,
            tx: t.x, ty: t.y,
            color: this.team === 'RU' ? '#ffdd55' : '#66ddff',
            life: 0.1,
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
        if (dist < 1) return;
        const spd = CONFIG.speed * (this.team === 'RU' ? 1 : 1.05); // США чуть быстрее
        this.x += (dx / dist) * spd * dt;
        this.y += (dy / dist) * spd * dt;
        this.facing = Math.atan2(dy, dx);
        // Ограничение по карте
        this.x = Math.max(20, Math.min(W - 20, this.x));
        this.y = Math.max(20, Math.min(H - 20, this.y));
    }

    distanceTo(other) {
        return Math.hypot(other.x - this.x, other.y - this.y);
    }

    draw(ctx) {
        if (this.dead) {
            // Труп
            ctx.fillStyle = 'rgba(80,80,80,0.5)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // Цвет команды
        const baseColor = this.team === 'RU' ? '#d52b1e' : '#3c6eb6';
        const isCommander = this.role === 'commander' || this.role === 'squad_leader';
        const isSelected = selectedUnits.includes(this);

        // Ореол выделения
        if (isSelected) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Тело
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Обводка командира
        if (isCommander) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Направление ствола
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.facing) * (this.radius + 6),
                   this.y + Math.sin(this.facing) * (this.radius + 6));
        ctx.stroke();

        // Вспышка выстрела
        if (this.muzzleFlash > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(this.x + Math.cos(this.facing) * (this.radius + 4),
                    this.y + Math.sin(this.facing) * (this.radius + 4), 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // HP-бар
        const hpFrac = this.hp / this.maxHp;
        if (hpFrac < 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 14, this.y - this.radius - 10, 28, 4);
            ctx.fillStyle = hpFrac > 0.5 ? '#3c3' : hpFrac > 0.25 ? '#fc3' : '#f33';
            ctx.fillRect(this.x - 14, this.y - this.radius - 10, 28 * hpFrac, 4);
        }

        // Метка роли
        const labels = {
            commander: 'К', squad_leader: 'К',
            mg: 'П', senior: 'СС', rifleman: 'С', at: 'Г', at_assist: 'ПГ'
        };
        if (labels[this.role]) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[this.role], this.x, this.y + 3);
        }
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
let ruUnits = [];
let usUnits = [];
let allUnits = [];
let selectedUnits = [];
let bullets = [];
let objective = { x: 0, y: 0, radius: CONFIG.objectiveRadius, owner: 'neutral', holdTime: 0 };
let gameTime = 0;
let gameOver = false;
let winner = null;
let orderMode = 'move'; // 'move' | 'attack' | 'hold' | 'follow'

function createRussianSquad(cx, cy) {
    // МСО РФ: командир, пулеметчик, старший стрелок, стрелок, гранатометчик, помощник гранатометчика
    return [
        new Soldier(cx, cy, 'RU', 'commander', 'Командир отделения'),
        new Soldier(cx + 30, cy + 20, 'RU', 'mg', 'Пулеметчик'),
        new Soldier(cx - 30, cy + 20, 'RU', 'senior', 'Старший стрелок'),
        new Soldier(cx + 15, cy + 45, 'RU', 'rifleman', 'Стрелок'),
        new Soldier(cx - 15, cy + 45, 'RU', 'at', 'Гранатометчик'),
        new Soldier(cx + 45, cy + 45, 'RU', 'at_assist', 'Пом. гранатометчика'),
    ];
}

function createUSSquad(cx, cy) {
    // Отделение США: ком.отделения, ком.группы А и Б, 2 пулеметчика, 2 гранатометчика, 2 стрелка
    return [
        new Soldier(cx, cy, 'US', 'squad_leader', 'Ком. отделения'),
        new Soldier(cx + 40, cy + 15, 'US', 'commander', 'Ком. группы А'),
        new Soldier(cx - 40, cy + 15, 'US', 'commander', 'Ком. группы Б'),
        new Soldier(cx + 55, cy + 40, 'US', 'mg', 'Пулеметчик А'),
        new Soldier(cx - 55, cy + 40, 'US', 'mg', 'Пулеметчик Б'),
        new Soldier(cx + 30, cy + 60, 'US', 'at', 'Гранатометчик А'),
        new Soldier(cx - 30, cy + 60, 'US', 'at', 'Гранатометчик Б'),
        new Soldier(cx, cy + 55, 'US', 'rifleman', 'Стрелок'),
        new Soldier(cx + 75, cy + 55, 'US', 'rifleman', 'Стрелок'),
    ];
}

function init() {
    ruUnits = createRussianSquad(150, H * 0.5);
    usUnits = createUSSquad(W - 150, H * 0.5);
    allUnits = [...ruUnits, ...usUnits];

    objective.x = W / 2;
    objective.y = H / 2;
    objective.owner = 'neutral';
    objective.holdTime = 0;

    // Выбираем командира РФ по умолчанию
    selectedUnits = [ruUnits[0]];

    // Солдаты РФ следуют за командиром автоматически
    for (let i = 1; i < ruUnits.length; i++) {
        ruUnits[i].followTarget = ruUnits[0];
    }

    // Управление союзниками США — базовый ИИ (двигаются к точке)
    updateUI();
}

// ==================== ВВОД ====================
let mouse = { x: 0, y: 0 };

canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

canvas.addEventListener('mousedown', (e) => {
    if (gameOver) return;
    if (e.button === 0) {
        // ЛКМ — выбор или атака
        handleLeftClick(e.clientX, e.clientY);
    } else if (e.button === 2) {
        // ПКМ — приказ
        handleRightClick(e.clientX, e.clientY);
    }
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

function handleLeftClick(mx, my) {
    // Проверка попадания по своим
    for (const u of allUnits) {
        if (u.dead || u.team !== 'RU') continue;
        if (Math.hypot(u.x - mx, u.y - my) < u.radius + 6) {
            if (e_shift) { /* добавление в группу */ }
            selectedUnits = [u];
            updateSelectedUI();
            return;
        }
    }
    // Клик по врагу — атака
    for (const u of allUnits) {
        if (u.dead || u.team !== 'US') continue;
        if (Math.hypot(u.x - mx, u.y - my) < u.radius + 8) {
            selectedUnits.forEach(s => {
                s.moveTarget = { x: u.x, y: u.y };
                s.attackTargetDirect = u;
            });
            showStatus(`Атака на ${u.roleName}!`);
            return;
        }
    }
    // Клик по земле — снять выделение (но командир всегда остаётся выбранным)
    if (!selectedUnits.some(s => s.role === 'commander' && s.team === 'RU')) {
        selectedUnits = [ruUnits[0]];
    }
}

let e_shift = false;
document.addEventListener('keydown', e => {
    if (e.key === 'Shift') e_shift = true;
    if (e.key === 'Escape' && !gameOver) {
        selectedUnits = [ruUnits[0]];
        updateSelectedUI();
    }
});
document.addEventListener('keyup', e => {
    if (e.key === 'Shift') e_shift = false;
});

function handleRightClick(mx, my) {
    if (orderMode === 'move') {
        selectedUnits.forEach(u => {
            u.moveTarget = { x: mx, y: my };
            u.followTarget = null;
        });
        showStatus('Движение');
    } else if (orderMode === 'attack') {
        // Атака по точке (солдаты атакуют всё в радиусе)
        selectedUnits.forEach(u => {
            u.moveTarget = { x: mx, y: my };
            u.attackPoint = { x: mx, y: my };
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
        // Следовать за командиром
        const commander = ruUnits.find(u => u.role === 'commander');
        ruUnits.forEach(u => {
            if (u !== commander) {
                u.followTarget = commander;
                u.moveTarget = null;
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
    showStatus('Режим: ' + {
        move: 'Движение', attack: 'Атака', hold: 'Держать', follow: 'Следовать'
    }[mode]);
}

function showStatus(msg) {
    const el = document.getElementById('status-message');
    el.textContent = msg;
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => { el.textContent = ''; }, 2000);
}

function updateSelectedUI() {
    if (selectedUnits.length === 0) return;
    const u = selectedUnits[0];
    document.getElementById('selected-unit').textContent = `Выбран: ${u.roleName} (HP ${Math.ceil(u.hp)})`;
}

// ==================== ИИ США ====================
function updateUSAI(dt) {
    const usAlive = usUnits.filter(u => !u.dead);
    const ruAlive = ruUnits.filter(u => !u.dead);
    const commander = usAlive.find(u => u.role === 'squad_leader');

    // Командир движется к точке
    if (commander && !commander.moveTarget) {
        commander.moveTarget = { x: objective.x, y: objective.y };
    }

    // Огневые группы: командиры групп следуют за командиром отделения
    const groupLeaders = usAlive.filter(u => u.role === 'commander');
    groupLeaders.forEach(gl => {
        if (!gl.followTarget && commander) gl.followTarget = commander;
    });

    // Остальные следуют за лидером своей группы
    usAlive.forEach(u => {
        if (u.role === 'squad_leader' || u.role === 'commander') return;
        if (!u.followTarget) {
            // Найти ближайшего командира группы
            const leader = groupLeaders.reduce((best, gl) => {
                const d = Math.hypot(gl.x - u.x, gl.y - u.y);
                return d < best.d ? { gl, d } : best;
            }, { gl: null, d: Infinity }).gl;
            if (leader) u.followTarget = leader;
        }
    });

    // Если враг в зоне видимости — все атакуют (это уже в Soldier.update)
}

// ==================== ОБНОВЛЕНИЕ ====================
function update(dt) {
    if (gameOver) return;
    gameTime += dt;

    updateUSAI(dt);

    allUnits.forEach(u => u.update(dt, allUnits));

    // Пули (визуальные)
    bullets.forEach(b => b.life -= dt);
    bullets = bullets.filter(b => b.life > 0);

    // Проверка захвата точки
    checkObjective(dt);

    // Проверка конца игры
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
    winner = team;
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
    // Фон
    ctx.fillStyle = '#2d3a2e';
    ctx.fillRect(0, 0, W, H);

    // Сетка
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
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
    ctx.lineWidth = 2;
    ctx.stroke();

    // Центр точки
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', objective.x, objective.y + 4);

    // Прогресс захвата
    if (objective.holdTime > 0) {
        const frac = Math.min(1, objective.holdTime / 3);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(objective.x, objective.y, objective.radius + 8, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * frac);
        ctx.stroke();
    }

    // Маршруты движения
    selectedUnits.forEach(u => {
        if (u.dead) return;
        if (u.moveTarget) {
            ctx.strokeStyle = 'rgba(255,215,0,0.5)';
            ctx.setLineDash([5, 5]);
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
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        const dx = b.tx - b.x, dy = b.ty - b.y;
        const d = Math.hypot(dx, dy) || 1;
        ctx.lineTo(b.x + (dx / d) * 30, b.y + (dy / d) * 30);
        ctx.stroke();
    });

    // Солдаты
    allUnits.forEach(u => u.draw(ctx));

    // Курсор-прицел
    if (mouse.x && mouse.y) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
        ctx.stroke();
    }
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

// Старт
init();
setOrderMode('move');
requestAnimationFrame(loop);
