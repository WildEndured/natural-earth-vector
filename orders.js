// orders.js
window.OrderSystem = {
    activeOrders: [], targetingMode: false, currentOrderArmy: null,
    createOrder: function(army, targetCoord, type) {
        if (GameTime.penaltyMonths > 0) { alert("Смена власти! Приказы заблокированы."); return; }
        const logi = window.Infrastructure.checkLogistics(targetCoord[0], targetCoord[1]);
        const order = { id: Date.now(), army: army, target: targetCoord, type: type, status: 'transmitting', timer: 3, reason: "", logistics: logi };
        this.activeOrders.push(order);
        this.updateOrderUI(order);
    },
    startTargeting: function(army) {
        if (GameTime.penaltyMonths > 0) { alert("Смена власти! Приказы заблокированы."); return; }
        this.targetingMode = true; this.currentOrderArmy = army;
        document.getElementById('map').style.cursor = 'crosshair';
    },
    cancelTargeting: function() {
        this.targetingMode = false; this.currentOrderArmy = null;
        document.getElementById('map').style.cursor = '';
    },
    update: function() {
        for (let i = this.activeOrders.length - 1; i >= 0; i--) {
            let o = this.activeOrders[i];
            if (o.status === 'transmitting' || o.status === 'processing') {
                o.timer--;
                if (o.timer <= 0) {
                    if (o.status === 'transmitting') { o.status = 'processing'; o.timer = 3; }
                    else { this.evaluateWithMoD(o); }
                    this.updateOrderUI(o);
                }
            }
        }
    },
    evaluateWithMoD: function(order) {
        const mod = window.MinistryOfDefense;
        if (!order.logistics.hasRoad && !order.logistics.hasRail) {
            order.status = 'negotiation'; order.reason = "Минобороны: Цель в глухой местности без путей снабжения.";
            this.showNegotiationModal(order); return;
        }
        if (mod.minister.loyalty < 50 && Math.random() < 0.4) {
            order.status = 'negotiation'; order.reason = `Министр обороны ${mod.minister.name}: Генералитет не доверяет вашей политике.`;
            this.showNegotiationModal(order); return;
        } 
        if (mod.doctrine === 'defense' && order.type === 'attack') {
            order.status = 'negotiation'; order.reason = "Минобороны: Наступательная операция противоречит оборонной доктрине.";
            this.showNegotiationModal(order); return;
        }
        order.status = 'approved'; this.executeOrder(order);
    },
    showNegotiationModal: function(order) {
        const modal = document.getElementById('order-modal');
        document.getElementById('om-reason').textContent = order.reason;
        document.getElementById('om-army').textContent = order.army.name;
        document.getElementById('om-cost').textContent = window.MinistryOfDefense.minister.politicalCost;
        document.getElementById('om-logistics').textContent = order.logistics.logisticsText;
        modal.style.display = 'block';
        document.getElementById('om-push').onclick = () => {
            if (GameTime.politicalCapital >= window.MinistryOfDefense.minister.politicalCost) {
                GameTime.politicalCapital -= window.MinistryOfDefense.minister.politicalCost;
                GameTime.updateUI(); modal.style.display = 'none';
                order.status = 'approved'; this.executeOrder(order);
            } else alert("Недостаточно политического веса!");
        };
        document.getElementById('om-cancel').onclick = () => {
            modal.style.display = 'none'; order.status = 'cancelled'; this.removeOrder(order.id);
        };
    },
    executeOrder: function(order) {
        order.status = 'executing';
        const army = order.army, start = army.coord, end = order.target, logi = order.logistics;
        const duration = 3000 * logi.speedMultiplier; 
        alert(`${army.name} выдвигается!\nСпособ: ${logi.logisticsText}\nВремя в пути: ${(duration/1000).toFixed(1)} сек.`);
        const startLatLng = L.latLng(start[0], start[1]), endLatLng = L.latLng(end[0], end[1]);
        const startTime = performance.now();
        const animateMove = (time) => {
            const elapsed = time - startTime;
            let progress = elapsed / duration;
            if (progress > 1) progress = 1;
            army.marker.setLatLng([startLatLng.lat + (endLatLng.lat - startLatLng.lat) * progress, startLatLng.lng + (endLatLng.lng - startLatLng.lng) * progress]);
            if (progress < 1) requestAnimationFrame(animateMove);
            else {
                army.coord = [end[0], end[1]]; this.removeOrder(order.id);
                if (window.Military && Military.currentArmy && Military.currentArmy.id === army.id) document.getElementById('up-hq').textContent = "В пути...";
            }
        };
        requestAnimationFrame(animateMove);
    },
    removeOrder: function(id) { this.activeOrders = this.activeOrders.filter(o => o.id !== id); },
    updateOrderUI: function(order) {
        const statusEl = document.getElementById('up-order-status');
        if (statusEl && Military.currentArmy && Military.currentArmy.id === order.army.id) {
            statusEl.style.display = 'block';
            statusEl.textContent = `Приказ: ${order.status.toUpperCase()}`;
            statusEl.style.color = order.status === 'negotiation' ? '#e74c3c' : '#f1c40f';
        }
    }
};
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.map) {
            window.map.on('click', function(e) {
                if (OrderSystem.targetingMode && OrderSystem.currentOrderArmy) {
                    OrderSystem.createOrder(OrderSystem.currentOrderArmy, [e.latlng.lat, e.latlng.lng], 'move');
                    OrderSystem.cancelTargeting();
                    if (window.innerWidth < 768) document.getElementById('unit-panel').classList.remove('active');
                }
            });
        }
    }, 1000);
});
