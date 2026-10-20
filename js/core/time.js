// time.js
window.GameTime = {
    date: new Date(2024, 0, 1), speed: 0, lastTick: performance.now(), penaltyMonths: 0, politicalCapital: 50,
    update: function() {
        const now = performance.now();
        const delta = now - this.lastTick;
        const msPerMonth = 10000;
        if (this.speed > 0 && delta > (msPerMonth / this.speed)) {
            this.lastTick = now;
            this.advanceMonth();
        }
    },
    advanceMonth: function() {
        this.date.setMonth(this.date.getMonth() + 1);
        if (this.penaltyMonths === 0) this.politicalCapital += 5;
        if (window.Leaders) Leaders.tick(1);
        if (window.WorldAI) WorldAI.tick();
        if (this.penaltyMonths > 0) {
            this.penaltyMonths--;
            if (this.penaltyMonths === 0) document.getElementById('penalty-banner').style.display = 'none';
            else document.getElementById('penalty-timer').textContent = this.penaltyMonths;
        }
        this.updateUI();
    },
    addPenalty: function(months) {
        this.penaltyMonths = months;
        document.getElementById('penalty-banner').style.display = 'flex';
        document.getElementById('penalty-timer').textContent = months;
    },
    updateUI: function() {
        const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        document.getElementById('game-date').textContent = `${months[this.date.getMonth()]}. ${this.date.getFullYear()}`;
        document.getElementById('tb-polcap').textContent = this.politicalCapital;
    },
    setSpeed: function(s) {
        this.speed = s; this.lastTick = performance.now();
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`speed-${s}`).classList.add('active');
    }
};
setInterval(() => GameTime.update(), 100);
