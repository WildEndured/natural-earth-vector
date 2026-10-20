// js/core/test_arena.js

window.TestArena = {
    units: [],
    canvas: null,
    ctx: null,
    isFighting: false,
    tickRate: 1000,

    init: function() {
        const modal = document.createElement('div');
        modal.id = 'test-arena-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #2c3e50; z-index: 9999; display: flex; flex-direction: column;
            align-items: center; justify-content: center; color: white; font-family: sans-serif;
        `;
        modal.innerHTML = `
            <h1 style="margin-top:0; color:#f1c40f;">Тестовый полигон (Восприятие и Психика)</h1>
            <div style="position:relative; width: 600px; height: 600px; background: #34495e; border: 2px solid #000;">
                <canvas id="arena-canvas" width="600" height="600"></canvas>
                <div id="arena-markers" style="position:absolute; top:0; left:0; width:100%; height:100%;"></div>
            </div>
            <div style="margin-top: 15px;">
                <button class="btn" id="arena-start-btn" style="padding: 10px 20px; font-size:16px; background: #e74c3c; cursor:pointer; border:none; border-radius:4px; color:white; font-weight:bold;">НАЧАТЬ БОЙ</button>
                <button class="btn" id="arena-skip-btn" style="padding: 10px 20px; font-size:16px; background: #555; cursor:pointer; border:none; border-radius:4px; color:white; margin-left:10px;">Перейти к карте мира</button>
            </div>
            <div id="arena-log" style="margin-top: 15px; height: 150px; overflow-y: auto; background: #000; padding: 10px; width: 600px; font-size: 12px; font-family: monospace;"></div>
        `;
        document.body.appendChild(modal);

        this.canvas = document.getElementById('arena-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.drawGrid();
        this.generateUnits();
        this.renderMarkers();

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
        const rusSquad = SoldierGenerator.generateSquad(4, "RUS");
        rusSquad.forEach((s, i) => {
            s.x = 100; s.y = 200 + (i * 60); s.team = "RUS";
            this.units.push(s);
        });
        
        const natoSquad = SoldierGenerator.generateSquad(4, "NATO");
        natoSquad.forEach((s, i) => {
            s.x = 500; s.y = 200 + (i * 60); s.team = "NATO";
            this.units.push(s);
        });
    },

    renderMarkers: function() {
        const container = document.getElementById('arena-markers');
        container.innerHTML = '';
        
        this.units.forEach(unit => {
            if (unit.isDead) return;
            
            const el = document.createElement('div');
            el.id = `marker_${unit.id}`;
            el.style.cssText = `
                position: absolute; left: ${unit.x - 15}px; top: ${unit.y - 15}px;
                width: 30px; height: 30px; border-radius: 50%;
                background: ${unit.team === 'RUS' ? '#2ecc71' : '#e74c3c'};
                border: 2px solid #000; cursor: pointer; display: flex; justify-content: center; align-items: center;
                font-size: 9px; color: white; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.5);
            `;
            el.innerText = unit.callsign.substring(0, 2);
            
            el.onclick = (e) => {
                e.stopPropagation();
                alert(
                    `Позывной: ${unit.callsign}\n` +
                    `Состояние: ${unit.status}\n` +
                    `Мораль: ${unit.currentMorale.toFixed(0)}/100\n` +
                    `Кровопотеря: ${unit.currentBloodLoss.toFixed(1)}%\n` +
                    `Радиус обнаружения: ${unit.getDetectionRadius().toFixed(0)} м.`
                );
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
        this.log("Бой начался! Бойцы вглядываются в горизонт...");
        
        const interval = setInterval(() => {
            if (!this.isFighting) { clearInterval(interval); return; }
            
            this.units.filter(u => !u.isDead).forEach(u => u.update());

            let rusAlive = this.units.filter(u => u.team === 'RUS' && !u.isDead).length;
            let enemyAlive = this.units.filter(u => u.team === 'NATO' && !u.isDead).length;

            if (rusAlive === 0) { this.log("ПОРАЖЕНИЕ! Все бойцы РФ уничтожены."); this.endFight(); return; }
            if (enemyAlive === 0) { this.log("ПОБЕДА! Противник уничтожен."); this.endFight(); return; }

            this.units.filter(u => !u.isDead).forEach(shooter => {
                const enemies = this.units.filter(u => u.team !== shooter.team && !u.isDead);
                if (enemies.length === 0) return;
                
                shooter.findTarget(enemies);

                if (!shooter.currentTarget) return;

                if (shooter.targetAcquisitionTime > 0) {
                    shooter.targetAcquisitionTime -= 100;
                    return;
                }

                const target = shooter.currentTarget;
                
                const distPixels = Math.sqrt(Math.pow(target.x - shooter.x, 2) + Math.pow(target.y - shooter.y, 2));
                const distMeters = distPixels / 6;
                
                const distPenalty = Math.min(1, shooter.weapon.effectiveRange / Math.max(10, distMeters * 2)); 
                const hitChance = (shooter.getShootingSkill() + (shooter.vision * 100)) / 200 * distPenalty;
                
                if (Math.random() < hitChance) {
                    const rand = Math.random();
                    let zone = "torso";
                    if (rand < 0.1) zone = "head";
                    else if (rand < 0.3) zone = "legs";
                    else if (rand < 0.5) zone = "leftArm";
                    else if (rand < 0.7) zone = "rightArm";
                    
                    const damage = shooter.weapon.damage + Math.floor(Math.random() * 20) - 10;
                    
                    target.takeDamage(damage, zone, "bullet", shooter);
                    
                    const zoneNames = { head: "голову", torso: "торс", legs: "ноги", leftArm: "левую руку", rightArm: "правую руку" };
                    this.log(`${shooter.callsign} попал в ${zoneNames[zone]} ${target.callsign} (${damage} урона)`);
                    
                    const marker = document.getElementById(`marker_${target.id}`);
                    if (marker && !target.isDead) marker.style.background = "#f39c12";
                    
                    if (target.isDead) {
                        this.log(`💀 ${target.callsign} (${target.team}) погиб!`);
                        if (marker) marker.style.display = 'none';
                    }
                } else {
                    this.log(`${shooter.callsign} выстрелил в ${target.callsign}, но промахнулся.`);
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
