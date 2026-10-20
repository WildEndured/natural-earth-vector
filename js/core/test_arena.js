// js/core/test_arena.js

window.TestArena = {
    units: [],
    canvas: null,
    ctx: null,
    isFighting: false,
    tickRate: 1000, // мс на 1 ход

    init: function() {
        // Создаем модальное окно для полигона
        const modal = document.createElement('div');
        modal.id = 'test-arena-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #2c3e50; z-index: 9999; display: flex; flex-direction: column;
            align-items: center; justify-content: center; color: white; font-family: sans-serif;
        `;
        modal.innerHTML = `
            <h1 style="margin-top:0; color:#f1c40f;">Тестовый полигон (100x100 м)</h1>
            <div style="position:relative; width: 600px; height: 600px; background: #34495e; border: 2px solid #000;">
                <canvas id="arena-canvas" width="600" height="600"></canvas>
                <!-- Слой для маркеров армий -->
                <div id="arena-markers" style="position:absolute; top:0; left:0; width:100%; height:100%;"></div>
            </div>
            <div style="margin-top: 15px;">
                <button class="btn" id="arena-start-btn" style="padding: 10px 20px; font-size:16px; background: #e74c3c; cursor:pointer; border:none; border-radius:4px; color:white; font-weight:bold;">НАЧАТЬ БОЙ</button>
                <button class="btn" id="arena-skip-btn" style="padding: 10px 20px; font-size:16px; background: #555; cursor:pointer; border:none; border-radius:4px; color:white; margin-left:10px;">Перейти к карте мира</button>
            </div>
            <div id="arena-log" style="margin-top: 15px; height: 100px; overflow-y: auto; background: #000; padding: 10px; width: 600px; font-size: 12px; font-family: monospace;"></div>
        `;
        document.body.appendChild(modal);

        this.canvas = document.getElementById('arena-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Отрисовка сетки (1 клетка = 10 метров)
        this.drawGrid();

        // Генерация бойцов (2 отделения по 4 человека)
        this.generateUnits();

        // Отрисовка маркеров
        this.renderMarkers();

        // События кнопок
        document.getElementById('arena-skip-btn').onclick = () => {
            document.getElementById('test-arena-modal').style.display = 'none';
        };
        document.getElementById('arena-start-btn').onclick = () => {
            this.startFight();
        };
    },

    drawGrid: function() {
        this.ctx.strokeStyle = "#555";
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= 600; i += 60) {
            this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, 600); this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.moveTo(0, i); this.ctx.lineTo(600, i); this.ctx.stroke();
        }
    },

    generateUnits: function() {
        this.units = [];
        // 1 отделение (Россия) - левый фланг
        for (let i = 0; i < 4; i++) {
            let s = new Soldier(`RUS_${i}`);
            s.x = 100; s.y = 200 + (i * 60); s.team = "RUS"; s.isDead = false;
            this.units.push(s);
        }
        // 2 отделение (Враг) - правый фланг
        for (let i = 0; i < 4; i++) {
            let s = new Soldier(`ENEMY_${i}`);
            s.x = 500; s.y = 200 + (i * 60); s.team = "ENEMY"; s.isDead = false;
            this.units.push(s);
        }
    },

    renderMarkers: function() {
        const container = document.getElementById('arena-markers');
        container.innerHTML = '';
        
        this.units.forEach(unit => {
            if (unit.isDead) return;
            
            const el = document.createElement('div');
            el.id = `marker_${unit.id}`;
            el.style.cssText = `
                position: absolute; left: ${unit.x - 10}px; top: ${unit.y - 10}px;
                width: 20px; height: 20px; border-radius: 50%;
                background: ${unit.team === 'RUS' ? '#2ecc71' : '#e74c3c'};
                border: 2px solid #000; cursor: pointer; display: flex; justify-content: center; align-items: center;
                font-size: 8px; color: white; font-weight: bold;
            `;
            el.innerText = unit.callsign.substring(0, 2);
            
            // Тултип с характеристиками при клике
            el.onclick = (e) => {
                e.stopPropagation();
                alert(`Позывной: ${unit.callsign}\nЗвание: ${unit.rank}\nСтрельба: ${unit.skills.shooting}\nЗдоровье: 100%`);
            };

            container.appendChild(el);
        });
    },

    log: function(msg) {
        const logEl = document.getElementById('arena-log');
        logEl.innerHTML += `<div>> ${msg}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    },

    startFight: function() {
        if (this.isFighting) return;
        this.isFighting = true;
        this.log("Бой начался!");
        
        const interval = setInterval(() => {
            if (!this.isFighting) { clearInterval(interval); return; }
            
            let rusAlive = this.units.filter(u => u.team === 'RUS' && !u.isDead).length;
            let enemyAlive = this.units.filter(u => u.team === 'ENEMY' && !u.isDead).length;

            if (rusAlive === 0) {
                this.log("ПОРАЖЕНИЕ! Все бойцы РФ уничтожены.");
                this.endFight(); return;
            }
            if (enemyAlive === 0) {
                this.log("ПОБЕДА! Противник уничтожен.");
                this.endFight(); return;
            }

            // Каждый живой стреляет по случайному врагу
            this.units.filter(u => !u.isDead).forEach(shooter => {
                const enemies = this.units.filter(u => u.team !== shooter.team && !u.isDead);
                if (enemies.length === 0) return;
                
                const target = enemies[Math.floor(Math.random() * enemies.length)];
                
                // Шанс попадания: (Навык стрельбы + Зрение) / 200
                const hitChance = (shooter.skills.shooting + shooter.vision * 100) / 200;
                
                if (Math.random() < hitChance) {
                    // Попал! Урон 30-70
                    const damage = Math.floor(Math.random() * 40) + 30;
                    target.health = (target.health || 100) - damage;
                    
                    this.log(`${shooter.callsign} (${shooter.team}) ранил ${target.callsign} (${target.team}) на ${damage} урона!`);
                    
                    if (target.health <= 0) {
                        target.isDead = true;
                        this.log(`${target.callsign} (${target.team}) УБИТ!`);
                        document.getElementById(`marker_${target.id}`).style.display = 'none';
                    }
                } else {
                    this.log(`${shooter.callsign} (${shooter.team}) промахнулся по ${target.callsign}.`);
                }
            });

        }, this.tickRate);
    },

    endFight: function() {
        this.isFighting = false;
        document.getElementById('arena-start-btn').innerText = "БОЙ ОКОНЧЕН";
        document.getElementById('arena-start-btn').disabled = true;
        document.getElementById('arena-start-btn').style.background = "#555";
    }
};
