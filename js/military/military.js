// military.js

// ==========================================
// 1. МИНИСТЕРСТВО ОБОРОНЫ
// ==========================================
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

// ==========================================
// 2. ГЕНЕРАЛЬНЫЙ ШТАБ (Без изменений)
// ==========================================
window.GeneralStaff = {
    chief: { name: "Валерий Герасимов", title: "Начальник Генерального штаба", competence: 85, aggression: 40 },
    directorates: {
        operations: { name: "Главное оперативное управление", effect: "Скорость приказов +10%" },
        mobilization: { name: "Главное организационно-мобилизационное управление", effect: "Скорость пополнения армии +20%" },
        communications: { name: "Главное управление связи", effect: "Задержка приказов -10%" },
        ewar: { name: "Управление РЭБ", effect: "Подавление врага +15%" }
    },
    gru: {
        directorates: {
            europe: { name: "Первое Управление", region: "Европейское содружество", effect: "Разведка в Европе" },
            americas: { name: "Второе Управление", region: "Америка, Британия", effect: "Разведка в Америке" },
            asia: { name: "Третье Управление", region: "Страны Азии", effect: "Разведка в Азии" },
            nato: { name: "Седьмое Управление", region: "НАТО", effect: "Разведка блока НАТО" },
            space: { name: "Управление космической разведки", region: "Космос", effect: "Спутники" }
        }
    },
    sof: {
        units: [
            { id: "senezh", name: "Центр специального назначения «Сенеж»", effect: "Диверсии" },
            { id: "kubinka2", name: "Гвардейский центр «Кубинка-2»", effect: "Штурм" }
        ]
    }
};

// ==========================================
// 3. ИЕРАРХИЯ ВООРУЖЕННЫХ СИЛ (ОБНОВЛЕНО)
// ==========================================
const ARMED_FORCES = {
  country: "RUS", name: "ВС РФ", color: "#3b7a3b",
  branches: {
    // ВЕТКА 1: СУХОПУТНЫЕ ВОЙСКА
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
        }
      ]
    },

    // ВЕТКА 2: ВОЗДУШНО-ДЕСАНТНЫЕ ВОЙСКА (По схеме)
    airborne_forces: {
      name: "Воздушно-десантные войска (ВДВ)",
      hq: { city: "Москва", coord: [55.7558, 37.6173] },
      units: [
        // 7-я дивизия
        { id: "7D", name: "7-я гв. десантно-штурмовая дивизия", type: "airborne", hq: "Новороссийск", coord: [44.7239, 37.7686], strength: 12000 },
        // 76-я дивизия
        { id: "76D", name: "76-я гв. десантно-штурмовая дивизия", type: "airborne", hq: "Псков", coord: [57.8194, 28.3318], strength: 12000 },
        // 98-я дивизия
        { id: "98D", name: "98-я гв. воздушно-десантная дивизия", type: "airborne", hq: "Иваново", coord: [57.0004, 40.9739], strength: 12000 },
        // 106-я дивизия
        { id: "106D", name: "106-я гв. воздушно-десантная дивизия", type: "airborne", hq: "Тула", coord: [54.1961, 37.6182], strength: 12000 },
        // 11-я бригада
        { id: "11B", name: "11-я гв. десантно-штурмовая бригада", type: "airborne", hq: "Улан-Удэ", coord: [51.8335, 107.5841], strength: 4000 },
        // 31-я бригада
        { id: "31B", name: "31-я гв. десантно-штурмовая бригада", type: "airborne", hq: "Ульяновск", coord: [54.3186, 48.3830], strength: 4000 },
        // 56-я бригада
        { id: "56B", name: "56-я гв. десантно-штурмовая бригада", type: "airborne", hq: "Камышин", coord: [50.0957, 45.4020], strength: 4000 },
        // 83-я бригада
        { id: "83B", name: "83-я гв. десантно-штурмовая бригада", type: "airborne", hq: "Уссурийск", coord: [43.7972, 131.9453], strength: 4000 },
        // 45-я бригада спецназа (в составе ВДВ)
        { id: "45B", name: "45-я гв. бригада спецназа", type: "airborne", hq: "Кубинка", coord: [55.5731, 36.6967], strength: 3000 },
        // Рязанское училище
        { id: "RVVDKU", name: "Рязанское училище ВДВ", type: "airborne", hq: "Рязань", coord: [54.6269, 39.7415], strength: 2000 }
      ]
    },

    // ВЕТКА 3: РВСН (Ракетные войска стратегического назначения)
    strategic_rocket_forces: {
      name: "РВСН",
      units: [
        { id: "RVSN1", name: "1-я ракетная армия (Владимир)", type: "rocket", hq: "Владимир", coord: [56.1290, 40.4070], strength: 10000 },
        { id: "RVSN2", name: "2-я ракетная армия (Оренбург)", type: "rocket", hq: "Оренбург", coord: [51.7682, 55.0969], strength: 10000 },
        { id: "RVSN3", name: "3-я ракетная армия (Омск)", type: "rocket", hq: "Омск", coord: [54.9885, 73.3242], strength: 10000 }
      ]
    },

    // ВЕТКА 4: ВОЙСКА БЕСПИЛОТНЫХ СИСТЕМ (БПЛА)
    drone_forces: {
      name: "Войска беспилотных систем",
      units: [
        { id: "UAV1", name: "Центр БПЛА (Коломна)", type: "drone", hq: "Коломна", coord: [55.0794, 38.7783], strength: 5000 },
        { id: "UAV2", name: "Центр БПЛА (Ижевск)", type: "drone", hq: "Ижевск", coord: [56.8527, 53.2115], strength: 5000 }
      ]
    }
  }
};

// ==========================================
// 4. ГЕНЕРАТОР ЗНАКОВ НАТО
// ==========================================
function getNatoIcon(type) {
    const size = 24;
    let color = "#3b7a3b"; // Зеленый (Сухопутные)
    let text = "XX";
    
    // Настройка цветов и текста для разных родов войск
    if (type === 'airborne') { color = "#2980b9"; text = "XX"; } // Синий (ВДВ)
    if (type === 'rocket') { color = "#c0392b"; text = "XX"; }   // Красный (РВСН)
    if (type === 'drone') { color = "#8e44ad"; text = "XX"; }    // Фиолетовый (БПЛА)
    
    const stroke = "#000";
    // Базовый прямоугольник
    let inner = `<rect x="2" y="2" width="20" height="14" fill="${color}" stroke="${stroke}" stroke-width="1.5"/>`;

    if (type === 'infantry') {
        inner += `<line x1="2" y1="2" x2="22" y2="16" stroke="${stroke}" stroke-width="1.5"/><line x1="22" y1="2" x2="2" y2="16" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (type === 'armor') {
        inner += `<ellipse cx="12" cy="9" rx="6" ry="4" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (type === 'corps') {
        inner += `<circle cx="7" cy="9" r="1.5" fill="${stroke}"/><circle cx="12" cy="9" r="1.5" fill="${stroke}"/><circle cx="17" cy="9" r="1.5" fill="${stroke}"/>`;
        text = "XXX";
    } else if (type === 'airborne') {
        // Символ ВДВ (Парашют/Крылья) - упрощенно
        inner += `<path d="M 7 5 Q 12 9 17 5" fill="none" stroke="${stroke}" stroke-width="1.5"/><line x1="12" y1="5" x2="12" y2="12" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (type === 'rocket') {
        // Символ РВСН (Ракета)
        inner += `<circle cx="12" cy="9" r="3" fill="none" stroke="${stroke}" stroke-width="1.5"/><line x1="12" y1="12" x2="12" y2="14" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (type === 'drone') {
        // Символ БПЛА (Треугольник/Крыло)
        inner += `<polygon points="12,4 18,12 6,12" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
    }

    const svg = `<svg width="${size}" height="${size + 6}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        ${inner}<text x="12" y="23" font-family="Arial" font-size="7" font-weight="bold" fill="#000" text-anchor="middle" stroke="#fff" stroke-width="0.5" paint-order="stroke">${text}</text>
    </svg>`;

    return L.divIcon({ className: 'nato-icon', html: svg, iconSize: [24, 30], iconAnchor: [12, 15] });
}

// ==========================================
// 5. СИСТЕМА УПРАВЛЕНИЯ АРМИЯМИ
// ==========================================
window.Military = {
    armies: [], currentArmy: null, activeMarkerEl: null,
    
    init: function(map) {
        this.map = map;
        this.armies = [];
        
        // Сбор всех подразделений из всех родов войск
        for (const branchKey in ARMED_FORCES.branches) {
            const branch = ARMED_FORCES.branches[branchKey];
            
            // Если у ветки есть округа (Сухопутные)
            if (branch.districts) {
                branch.districts.forEach(dist => {
                    dist.armies.forEach(army => {
                        army.districtName = dist.name;
                        army.branchName = branch.name;
                        army.armedForcesName = ARMED_FORCES.name;
                        this.armies.push(army);
                    });
                });
            } 
            // Если у ветки просто список юнитов (ВДВ, РВСН, БПЛА)
            else if (branch.units) {
                branch.units.forEach(unit => {
                    unit.districtName = "Отдельное командование";
                    unit.branchName = branch.name;
                    unit.armedForcesName = ARMED_FORCES.name;
                    this.armies.push(unit);
                });
            }
        }
        this.renderMarkers();
    },

    renderMarkers: function() {
        const self = this;
        this.armies.forEach(army => {
            const icon = getNatoIcon(army.type);
            // Добавляем подпись с численностью
            const labelHtml = `<div style="text-align:center; font-size:10px; font-weight:bold; color:#fff; text-shadow: 1px 1px 2px #000; margin-top:-2px;">${Math.round(army.strength / 1000)}k</div>`;
            icon.options.html += labelHtml;

            const marker = L.marker(army.coord, { icon: icon }).addTo(this.map);
            
            marker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                self.openPanel(army, marker);
            });
            marker.bindTooltip(`${army.name}<br>Штаб: ${army.hq}`, { direction: 'top', offset: [0, -15] });
            army.marker = marker; 
        });
    },

    openPanel: function(army, marker) {
        this.currentArmy = army;
        document.getElementById('up-name').textContent = army.name;
        document.getElementById('up-hierarchy').innerHTML = `
            <span class="hierarchy-parent">${army.armedForcesName}</span> > 
            <span class="hierarchy-child">${army.branchName}</span>
        `;
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
    
    // ... (Функции showHighCommandPanel, showSofPanel, showGruPanel остаются без изменений, 
    // они просто открывают окна, которые мы сделали ранее) ...
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
