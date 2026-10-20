// military.js

window.MinistryOfDefense = {
    minister: { name: "Андрей Белоусов", title: "Министр обороны", loyalty: 80, competence: 75, politicalCost: 15 },
    doctrine: "defense",
    evaluateOrder: function(order) {
        if (this.minister.loyalty < 50 && Math.random() < 0.4) {
            return { status: "negotiation", reason: `Министр обороны ${this.minister.name}: Генералитет не доверяет вашей политике.` };
        }
        if (this.doctrine === "defense" && order.type === "attack") {
            return { status: "negotiation", reason: "Минобороны: Наступательная операция противоречит оборонной доктрине." };
        }
        return { status: "approved", reason: "Приказ одобрен." };
    }
};

window.GeneralStaff = {
    chief: { name: "Валерий Герасимов", title: "Начальник Генерального штаба", competence: 85, aggression: 40 },
    directorates: {
        operations: { name: "Главное оперативное управление", effect: "Скорость приказов +10%" },
        mobilization: { name: "Главное организационно-мобилизационное управление", effect: "Скорость пополнения армии +20%" },
        communications: { name: "Главное управление связи", effect: "Задержка приказов -10%" },
        ewar: { name: "Управление РЭБ", effect: "Подавление врага +15%" },
        topography: { name: "Военно-топографическое управление", effect: "Точность ударов +5%" },
        drones: { name: "Управление строительства и развития БПЛА", effect: "Урон дронов +20%" },
        security: { name: "Восьмое управление (ЗГТ)", effect: "Защита от шпионажа +25%" }
    },
    gru: {
        directorates: {
            europe: { name: "Первое Управление", region: "Европейское содружество", effect: "Разведка в Европе" },
            americas: { name: "Второе Управление", region: "Америка, Британия, Австралия", effect: "Разведка в Америке" },
            asia: { name: "Третье Управление", region: "Страны Азии", effect: "Разведка в Азии" },
            africa: { name: "Четвертое Управление", region: "Страны Африки", effect: "Разведка в Африке" },
            nato: { name: "Седьмое Управление", region: "НАТО", effect: "Разведка блока НАТО" },
            special_ops: { name: "Восьмое Управление", region: "Спецназ", effect: "Диверсии" },
            space: { name: "Управление космической разведки", region: "Космос", effect: "Спутники" }
        }
    },
    sof: {
        units: [
            { id: "senezh", name: "Центр специального назначения «Сенеж»", effect: "Диверсии, ликвидация" },
            { id: "kubinka2", name: "Гвардейский центр «Кубинка-2»", effect: "Штурм, защита VIP" },
            { id: "561", name: "561-й аварийно-спасательный центр", effect: "Спасение, эвакуация" }
        ]
    }
};

const ARMED_FORCES = {
  country: "RUS", name: "ВС РФ",
  branches: {
    ground_forces: {
      name: "Сухопутные войска",
      districts: [
        {
          id: "LEN", name: "Ленинградский ВО", hq: { city: "Санкт-Петербург", coord: [59.9343, 30.3351] },
          armies: [
            { id: "6A", name: "6-я армия", type: "infantry", hq: "Санкт-Петербург", coord: [59.9343, 30.3351], strength: 30000 },
            { id: "11K", name: "11-й корпус", type: "corps", hq: "Калининград", coord: [54.7104, 20.4522], strength: 15000 }
          ]
        },
        {
          id: "MOS", name: "Московский ВО", hq: { city: "Москва", coord: [55.7558, 37.6173] },
          armies: [
            { id: "1TA", name: "1-я танковая армия", type: "armor", hq: "Одинцово", coord: [55.6789, 37.2778], strength: 45000 }
          ]
        },
        {
          id: "SOU", name: "Южный ВО", hq: { city: "Ростов-на-Дону", coord: [47.2357, 39.7015] },
          armies: [
            { id: "8A", name: "8-я армия", type: "infantry", hq: "Новочеркасск", coord: [47.4222, 40.0936], strength: 40000 }
          ]
        }
      ]
    }
  }
};

function getNatoIcon(type) {
    const size = 24, color = "#3b7a3b", stroke = "#000";
    let inner = `<rect x="2" y="2" width="20" height="14" fill="${color}" stroke="${stroke}" stroke-width="1.5"/>`;
    if (type === 'infantry') {
        inner += `<line x1="2" y1="2" x2="22" y2="16" stroke="${stroke}" stroke-width="1.5"/><line x1="22" y1="2" x2="2" y2="16" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (type === 'armor') {
        inner += `<ellipse cx="12" cy="9" rx="6" ry="4" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (type === 'corps') {
        inner += `<circle cx="7" cy="9" r="1.5" fill="${stroke}"/><circle cx="12" cy="9" r="1.5" fill="${stroke}"/><circle cx="17" cy="9" r="1.5" fill="${stroke}"/>`;
    }
    const svg = `<svg width="${size}" height="${size + 6}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        ${inner}<text x="12" y="23" font-family="Arial" font-size="7" font-weight="bold" fill="#000" text-anchor="middle" stroke="#fff" stroke-width="0.5" paint-order="stroke">${type === 'corps' ? 'XXX' : 'XX'}</text>
    </svg>`;
    return L.divIcon({ className: 'nato-icon', html: svg, iconSize: [24, 30], iconAnchor: [12, 15] });
}

window.Military = {
    armies: [], currentArmy: null, activeMarkerEl: null,
    init: function(map) {
        this.map = map;
        const groundForces = ARMED_FORCES.branches.ground_forces;
        groundForces.districts.forEach(dist => {
            dist.armies.forEach(army => {
                army.districtName = dist.name;
                army.branchName = groundForces.name;
                army.armedForcesName = ARMED_FORCES.name;
                this.armies.push(army);
            });
        });
        this.renderMarkers();
    },
    renderMarkers: function() {
        const self = this;
        this.armies.forEach(army => {
            const icon = getNatoIcon(army.type);
            const labelHtml = `<div style="text-align:center; font-size:10px; font-weight:bold; color:#fff; text-shadow: 1px 1px 2px #000; margin-top:-2px;">${Math.round(army.strength / 1000)}k</div>`;
            icon.options.html += labelHtml;
            const marker = L.marker(army.coord, { icon: icon }).addTo(this.map);
            marker.on('click', function(e) { L.DomEvent.stopPropagation(e); self.openPanel(army, marker); });
            marker.bindTooltip(`${army.name}<br>Штаб: ${army.hq}`, { direction: 'top', offset: [0, -15] });
            army.marker = marker; 
        });
    },
    openPanel: function(army, marker) {
        this.currentArmy = army;
        document.getElementById('up-name').textContent = army.name;
        document.getElementById('up-hierarchy').innerHTML = `
            <span class="hierarchy-parent">${army.armedForcesName}</span> > 
            <span class="hierarchy-parent">${army.branchName}</span> > 
            <span class="hierarchy-child">${army.districtName}</span>`;
        document.getElementById('up-hq').textContent = army.hq;
        document.getElementById('up-strength').textContent = army.strength.toLocaleString();
        document.getElementById('up-icon').innerHTML = getNatoIcon(army.type).options.html;
        const panel = document.getElementById('unit-panel');
        panel.classList.add('active');
        if (window.innerWidth >= 768) panel.style.display = 'block';
        if (this.activeMarkerEl) this.activeMarkerEl.classList.remove('active');
        this.activeMarkerEl = marker.getElement();
        if (this.activeMarkerEl) this.activeMarkerEl.classList.add('active');
    },
    closePanel: function() {
        const panel = document.getElementById('unit-panel');
        panel.classList.remove('active');
        if (window.innerWidth >= 768) panel.style.display = 'none';
        if (this.activeMarkerEl) { this.activeMarkerEl.classList.remove('active'); this.activeMarkerEl = null; }
        this.currentArmy = null;
    },
    showHighCommandPanel: function() {
        const panel = document.getElementById('hq-panel');
        document.getElementById('hq-mod-name').textContent = window.MinistryOfDefense.minister.name;
        document.getElementById('hq-mod-loyalty').textContent = window.MinistryOfDefense.minister.loyalty + "%";
        document.getElementById('hq-mod-competence').textContent = window.MinistryOfDefense.minister.competence + "%";
        document.getElementById('hq-gs-name').textContent = window.GeneralStaff.chief.name;
        document.getElementById('hq-gs-competence').textContent = window.GeneralStaff.chief.competence + "%";
        let deptHtml = '';
        for (const key in window.GeneralStaff.directorates) {
            let dept = window.GeneralStaff.directorates[key];
            deptHtml += `<div class="hq-dept-item"><b>${dept.name}</b><br><small style="color:#aaa;">${dept.effect}</small></div>`;
        }
        document.getElementById('hq-dept-list').innerHTML = deptHtml;
        panel.style.display = 'block';
        if (window.innerWidth < 768) panel.classList.add('active');
    },
    hideHighCommandPanel: function() {
        document.getElementById('hq-panel').style.display = 'none';
        document.getElementById('hq-panel').classList.remove('active');
    },
    showSofPanel: function() {
        const panel = document.getElementById('sof-panel');
        let sofHtml = '';
        window.GeneralStaff.sof.units.forEach(unit => {
            sofHtml += `<div class="hq-dept-item"><b>${unit.name}</b><br><small style="color:#f39c12;">${unit.effect}</small></div>`;
        });
        document.getElementById('sof-list').innerHTML = sofHtml;
        panel.style.display = 'block';
        if (window.innerWidth < 768) panel.classList.add('active');
    },
    hideSofPanel: function() {
        document.getElementById('sof-panel').style.display = 'none';
        document.getElementById('sof-panel').classList.remove('active');
    },
    showGruPanel: function() {
        const panel = document.getElementById('gru-panel');
        let gruHtml = '';
        for (const key in window.GeneralStaff.gru.directorates) {
            let dir = window.GeneralStaff.gru.directorates[key];
            gruHtml += `<div class="hq-dept-item"><b>${dir.name}</b> <span style="color:#e67e22; font-size:11px;">(${dir.region})</span><br><small style="color:#aaa;">${dir.effect}</small></div>`;
        }
        document.getElementById('gru-list').innerHTML = gruHtml;
        panel.style.display = 'block';
        if (window.innerWidth < 768) panel.classList.add('active');
    },
    hideGruPanel: function() {
        document.getElementById('gru-panel').style.display = 'none';
        document.getElementById('gru-panel').classList.remove('active');
    }
};
