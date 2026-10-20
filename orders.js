window.OrderSystem = {
    activeOrders: [],

    createOrder: function(army, targetCoord, type) {
        if (GameTime.penaltyMonths > 0) {
            alert("Смена власти! Приказы заблокированы.");
            return;
        }

        const order = {
            id: Date.now(),
            army: army,
            target: targetCoord,
            type: type, // 'move' или 'attack'
            status: 'transmitting', // transmitting -> processing -> negotiation -> approved
            timer: 3, // 3 тика до обработки
            reason: ""
        };
        
        this.activeOrders.push(order);
        this.updateOrderUI(order);
    },

    update: function() {
        for (let i = this.activeOrders.length - 1; i >= 0; i--) {
            let o = this.activeOrders[i];
            if (o.status === 'transmitting' || o.status === 'processing') {
                o.timer--;
                if (o.timer <= 0) {
                    if (o.status === 'transmitting') {
                        o.status = 'processing';
                        o.timer = 3; // Время на оценку Минобороны
                    } else {
                        this.evaluateWithMoD(o);
                    }
                    this.updateOrderUI(o);
                }
            }
        }
    },

    evaluateWithMoD: function(order) {
        // ИИ Минобороны (Лояльность 70, Доктрина: Оборона)
        const mod = window.MinistryOfDefense;
        
        if (mod.loyalty < 50 && Math.random() < 0.4) {
            order.status = 'negotiation';
            order.reason = "Минобороны: Генералы не доверяют вам. Требуется политическая воля.";
            this.showNegotiationModal(order);
        } else if (mod.doctrine === 'defense' && order.type === 'attack') {
            order.status = 'negotiation';
            order.reason = "Минобороны: Атака противоречит оборонной доктрине.";
            this.showNegotiationModal(order);
        } else {
            order.status = 'approved';
            this.executeOrder(order);
        }
    },

    showNegotiationModal: function(order) {
        const modal = document.getElementById('order-modal');
        document.getElementById('om-reason').textContent = order.reason;
        document.getElementById('om-army').textContent = order.army.name;
        document.getElementById('om-cost').textContent = window.MinistryOfDefense.politicalCapitalCost;
        
        modal.style.display = 'block';

        document.getElementById('om-push').onclick = () => {
            if (GameTime.politicalCapital >= window.MinistryOfDefense.politicalCapitalCost) {
                GameTime.politicalCapital -= window.MinistryOfDefense.politicalCapitalCost;
                GameTime.updateUI();
                modal.style.display = 'none';
                order.status = 'approved';
                this.executeOrder(order);
            } else {
                alert("Недостаточно политического веса!");
            }
        };

        document.getElementById('om-cancel').onclick = () => {
            modal.style.display = 'none';
            order.status = 'cancelled';
            this.removeOrder(order.id);
        };
    },

    executeOrder: function(order) {
        order.status = 'executing';
        alert(`Приказ для ${order.army.name} выполнен! Армия выдвигается.`);
        // В будущем: сдвиг маркера на карте
        setTimeout(() => this.removeOrder(order.id), 2000);
    },

    removeOrder: function(id) {
        this.activeOrders = this.activeOrders.filter(o => o.id !== id);
    },

    updateOrderUI: function(order) {
        // Показываем статус в панели армии, если она открыта
        const statusEl = document.getElementById('up-order-status');
        if (statusEl && Military.currentArmy && Military.currentArmy.id === order.army.id) {
            statusEl.style.display = 'block';
            statusEl.textContent = `Статус приказа: ${order.status.toUpperCase()}`;
            statusEl.style.color = order.status === 'negotiation' ? '#e74c3c' : '#f1c40f';
        }
    }
};

// Привязка кнопки движения в military.js
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('up-move-btn')?.addEventListener('click', () => {
        if (!Military.currentArmy) return;
        // Для теста берем случайную соседнюю точку
        const target = [Military.currentArmy.coord[0] + 2, Military.currentArmy.coord[1] + 2];
        OrderSystem.createOrder(Military.currentArmy, target, 'move');
    });
});
