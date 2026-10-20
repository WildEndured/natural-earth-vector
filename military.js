// military.js

// ==========================================
// 1. МИНИСТЕРСТВО ОБОРОНЫ (ИИ)
// ==========================================
window.MinistryOfDefense = {
    loyalty: 70,               // Лояльность лидеру (0-100)
    competence: 80,            // Компетентность (влияет на ошибки)
    doctrine: "defense",       // Текущая доктрина ("defense", "attack")
    politicalCapitalCost: 20,  // Сколько весит "продавливание" приказа
    
    // Оценка приказа (вызывается из orders.js)
    evaluateOrder: function(order) {
        // 1. Проверка на лояльность (если лояльность низкая, генералы саботируют)
        if (this.loyalty < 50 && Math.random() < 0.4) {
            return { 
                status: "negotiation", 
                reason: "Генералитет не доверяет вашей политике. Требуется прямое вмешательство лидера." 
            };
        }
        
        // 2. Проверка на доктрину (если мы в обороне, а приказ атаковать)
        if (this.doctrine === "defense" && order.type === "attack") {
            return { 
                status: "negotiation", 
                reason: "Минобороны настаивает на оборонительной доктрине. Наступательная операция требует политической воли." 
            };
        }
        
        // 3. Все хорошо
        return { status: "approved", reason: "Приказ одобрен Генштабом." };
    }
};

// ==========================================
// 2. ИЕРАРХИЯ ВООРУЖЕННЫХ СИЛ
// ==========================================
const ARMED_FORCES = {
  country: "RUS",
  name: "Вооруженные Силы Российской Федерации",
  color: "#3b7a3b",
  
  branches: {
    ground_forces: {
      name: "Сухопутные войска",
      districts: [
        {
          id: "LEN",
          name: "Ленинградский военный округ",
          hq: { city: "Санкт-Петербург", coord: [59.9343, 30.3351] },
          armies: [
            { id: "6A", name: "6-я гвардейская общевойсковая армия", type: "infantry", hq: "Санкт-Петербург", coord: [59.9343, 30.3351], strength: 30000 },
            { id: "11K", name: "11-й армейский корпус", type: "corps", hq: "Калининград", coord: [54.7104, 20.4522], strength: 15000 },
            { id: "14K", name: "14-й армейский корпус", type: "corps", hq: "Мурманск", coord: [68.9585, 33.0827], strength: 15000 },
            { id: "44K", name: "44-й армейский корпус", type: "corps", hq: "Петрозаводск", coord: [61.7849, 34.3469], strength: 12000 }
          ]
        },
        {
          id: "MOS",
          name: "Московский военный округ",
          hq: { city: "Москва", coord: [55.7558, 37.6173] },
          armies: [
            { id: "1TA", name: "1-я гвардейская танковая армия", type: "armor", hq: "Одинцово", coord: [55.6789, 37.2778], strength: 45000 },
            { id: "20A", name: "20-я гвардейская общевойсковая армия", type: "infantry", hq: "Воронеж", coord: [51.6720, 39.1843], strength: 35000 }
          ]
        },
        {
          id: "SOU",
          name: "Южный военный округ",
          hq: { city: "Ростов-на-Дону", coord: [47.2357, 39.7015] },
          armies: [
            { id: "3A", name: "3-я гвардейская общевойсковая армия", type: "infantry", hq: "Луганск", coord: [48.5740, 39.3078], strength: 30000 },
            { id: "8A", name: "8-я гвардейская общевойсковая армия", type: "infantry", hq: "Новочеркасск", coord: [47.4222, 40.0936], strength: 40000 },
            { id: "18A", name: "18-я общевойсковая армия", type: "infantry", hq: "Симферополь", coord: [44.9521, 34.1024], strength: 25000 },
            { id: "49A", name: "49-я общевойсковая армия", type: "infantry", hq: "Ставрополь", coord: [45.0428, 41.9734], strength: 25000 },
            { id: "51A", name: "51-я гвардейская общевойсковая армия", type: "infantry", hq: "Донецк", coord: [48.0159, 37.8028], strength: 30000 },
            { id: "58A", name: "58-я гвардейская общевойсковая армия", type: "infantry", hq: "Владикавказ", coord: [43.0367, 44.6678], strength: 30000 }
          ]
        },
        {
          id: "CEN",
          name: "Центральный военный округ",
          hq: { city: "Екатеринбург", coord: [56.8389, 60.6057] },
          armies: [
            { id: "2A", name: "2-я гвардейская общевойсковая армия", type: "infantry", hq: "Самара", coord: [53.1958, 50.1008], strength: 35000 },
            { id: "25A", name: "25-я общевойсковая армия", type: "infantry", hq: "Екатеринбург", coord: [56.8389, 60.6057], strength: 30000 },
            { id: "41A", name: "41-я гвардейская общевойсковая армия", type: "infantry", hq: "Новосибирск", coord: [55.0083, 82.9345], strength: 30000 },
            { id: "3K", name: "3-й армейский корпус", type: "corps", hq: "Мулино", coord: [56.3500, 43.1500], strength: 20000 }
          ]
        },
        {
          id: "EAS",
          name: "Восточный военный округ",
          hq: { city: "Хабаровск", coord: [48.4827, 135.0838] },
          armies: [
            { id: "5A", name: "5-я гвардейская общевойсковая армия", type: "infantry", hq: "Уссурийск", coord: [43.7972, 131.9453], strength: 35000 },
            { id: "29A", name: "29-я гвардейская общевойсковая армия", type: "infantry", hq: "Чита", coord: [52.0340, 113.4994], strength: 30000 },
            { id: "35A", name: "35-я гвардейская общевойсковая армия", type: "infantry", hq: "Белогорск", coord: [50.9167, 128.4667], strength: 30000 },
            { id: "36A", name: "36-я гвардейская общевойсковая армия", type: "infantry", hq: "Улан-Удэ", coord: [51.8335, 107.5841], strength: 30000 },
            { id: "68K", name: "68-й гвардейский армейский корпус", type: "corps", hq: "Южно-Сахалинск", coord: [46.9591, 142.7380], strength: 15000 }
          ]
        }
      ]
    }
  }
};

// ==========================================
// 3. ГЕНЕРАТОР ЗНАКОВ НАТО (SVG)
// ==========================================
function getNatoIcon(type) {
    const size = 24;
    const color = "#3b7a3b"; 
    const stroke = "#000";
    
    // Базовый прямоугольник
    let inner = `<rect x="2" y="2" width="20" height="14" fill="${color}" stroke="${stroke}" stroke-width="1.5"/>`;
    
    if (type === 'infantry') {
        // Крест (пехота)
        inner += `<line x1="2" y1="2" x2="22" y2="16" stroke="${stroke}" stroke-width="1.5"/>`;
        inner += `<line x1="22" y1="2" x2="2" y2="16" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (type === 'armor') {
        // Овал (бронетанковые)
        inner += `<ellipse cx="12" cy="9" rx="6" ry="4" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (type === 'corps') {
        // Три точки XXX (корпус)
        inner += `<circle cx="7" cy="9" r="1.5" fill="${stroke}"/>`;
        inner += `<circle cx="12" cy="9" r="1.5" fill="${stroke}"/>`;
        inner += `<circle cx="17" cy="9" r="1.5" fill="${stroke}"/>`;
    }

    const svg = `<svg width="${size}" height="${size + 6}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        ${inner}
        <text x="12" y="23" font-family="Arial" font-size="7" font-weight="bold" fill="#000" text-anchor="middle" stroke="#fff" stroke-width="0.5" paint-order="stroke">${type === 'corps' ? 'XXX' : 'XX'}</text>
    </svg>`;

    return L.divIcon({
        className: 'nato-icon',
        html: svg,
        iconSize: [24, 30],
        iconAnchor: [12, 15]
    });
}

// ==========================================
// 4. СИСТЕМА УПРАВЛЕНИЯ АРМИЯМИ
// ==========================================
window.Military = {
    armies: [],
    currentArmy: null,
    activeMarkerEl: null,

    init: function(map) {
        this.map = map;
        this.armies = [];
        
        // Собираем армии из вложенной структуры
        const groundForces = ARMED_FORCES.branches.ground_forces;
        
        groundForces.districts.forEach(dist => {
            dist.armies.forEach(army => {
                army.districtId = dist.id;
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
            
            // Численность под иконкой
            const labelHtml = `
                <div style="text-align:center; font-size:10px; font-weight:bold; color:#fff; text-shadow: 1px 1px 2px #000; margin-top:-2px;">
                    ${Math.round(army.strength / 1000)}k
                </div>
            `;
            icon.options.html += labelHtml;

            // Ставим маркер на карту
            const marker = L.marker(army.coord, { icon: icon }).addTo(this.map);
            
            // Клик по маркеру
            marker.on('click', function(e) {
                L.DomEvent.stopPropagation(e); // Чтобы не срабатывал клик по карте
                self.openPanel(army, marker);
            });

            // Тултип при наведении
            marker.bindTooltip(`${army.name}<br>Штаб: ${army.hq}`, { direction: 'top', offset: [0, -15] });

            army.marker = marker; 
        });
    },

    openPanel: function(army, marker) {
        this.currentArmy = army;
        
        // Заполняем данные в панели
        document.getElementById('up-name').textContent = army.name;
        
        // Иерархия (Хлебные крошки)
        document.getElementById('up-hierarchy').innerHTML = `
            <span class="hierarchy-parent">${army.armedForcesName}</span> 
            <span class="hierarchy-sep">></span> 
            <span class="hierarchy-parent">${army.branchName}</span> 
            <span class="hierarchy-sep">></span> 
            <span class="hierarchy-child">${army.districtName}</span>
        `;
        
        document.getElementById('up-hq').textContent = army.hq;
        document.getElementById('up-strength').textContent = army.strength.toLocaleString();
        
        // Иконка НАТО в панели
        const iconPreview = document.getElementById('up-icon');
        iconPreview.innerHTML = getNatoIcon(army.type).options.html;

        // Показываем панель (на мобилках выезжает снизу, на ПК - блок)
        const panel = document.getElementById('unit-panel');
        panel.classList.add('active');
        if (window.innerWidth >= 768) panel.style.display = 'block';
        
        // Подсветка маркера
        if (this.activeMarkerEl) this.activeMarkerEl.classList.remove('active');
        this.activeMarkerEl = marker.getElement();
        if (this.activeMarkerEl) this.activeMarkerEl.classList.add('active');
    },

    closePanel: function() {
        const panel = document.getElementById('unit-panel');
        panel.classList.remove('active');
        if (window.innerWidth >= 768) panel.style.display = 'none';
        
        if (this.activeMarkerEl) {
            this.activeMarkerEl.classList.remove('active');
            this.activeMarkerEl = null;
        }
        this.currentArmy = null;
    }
};
