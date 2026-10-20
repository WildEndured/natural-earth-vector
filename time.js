window.GameTime = {
    date: new Date(2024, 0, 1),
    speed: 0, 
    lastTick: performance.now(),
    penaltyMonths: 0,
    politicalCapital: 50, // Политический вес

    update: function() {
        const now = performance.now();
        const delta = now - this.lastTick;
        const msPerMonth = 10000; // 10 сек = 1 месяц на 1x

        if (this.speed > 0 && delta > (msPerMonth / this.speed)) {
            this.lastTick = now;
            this.advanceMonth();
        }
    },

    advanceMonth: function() {
        this.date.setMonth(this.date.getMonth() + 1);
        
        // Начисление политвеса
        if (this.penaltyMonths === 0) {
            this.politicalCapital += 5;
        }

        if (window.Leaders) Leaders.tick(1);

        if (this.penaltyMonths > 0) {
            this.penaltyMonths--;
            if (this.penaltyMonths === 0) {
                document.getElementById('penalty-banner').style.display = 'none';
            } else {
                document.getElementById('penalty-timer').textContent = this.penaltyMonths;
            }
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
        const m = months[this.date.getMonth()];
        const y = this.date.getFullYear();
        document.getElementById('game-date').textContent = `${m}. ${y}`;
        document.getElementById('tb-polcap').textContent = this.politicalCapital;
    },

    setSpeed: function(s) {
        this.speed = s;
        this.lastTick = performance.now();
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`speed-${s}`).classList.add('active');
    }
};

setInterval(() => GameTime.update(), 100);
