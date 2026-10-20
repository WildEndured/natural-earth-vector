// time.js

window.GameTime = {
    date: new Date(2024, 0, 1), // Стартуем в Январе 2024
    speed: 0, // 0 = пауза, 1, 2, 4
    lastTick: performance.now(),
    penaltyMonths: 0, // Месяцы штрафа при смене власти

    // Основной цикл
    update: function() {
        const now = performance.now();
        const delta = now - this.lastTick;
        
        // Один игровой месяц = 10 реальных секунд (на скорости 1x)
        const msPerMonth = 10000; 

        if (this.speed > 0 && delta > (msPerMonth / this.speed)) {
            this.lastTick = now;
            this.advanceMonth();
        }
    },

    advanceMonth: function() {
        this.date.setMonth(this.date.getMonth() + 1);
        
        // Лидеры стареют
        if (window.Leaders) Leaders.tick(1);

        // Обрабатываем штрафы
        if (this.penaltyMonths > 0) {
            this.penaltyMonths--;
            if (this.penaltyMonths === 0) {
                document.getElementById('penalty-banner').style.display = 'none';
                alert('Период нестабильности окончен. Приказы снова работают!');
            } else {
                document.getElementById('penalty-timer').textContent = this.penaltyMonths;
            }
        }

        this.updateUI();
    },

    addPenalty: function(months) {
        this.penaltyMonths = months;
        document.getElementById('penalty-banner').style.display = 'block';
        document.getElementById('penalty-timer').textContent = months;
    },

    updateUI: function() {
        const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        const m = months[this.date.getMonth()];
        const y = this.date.getFullYear();
        document.getElementById('game-date').textContent = `${m}. ${y}`;
    },

    setSpeed: function(s) {
        this.speed = s;
        this.lastTick = performance.now();
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`speed-${s}`).classList.add('active');
    }
};

// Запуск цикла
setInterval(() => GameTime.update(), 100);
