// infrastructure.js

window.Infrastructure = {
    roadsLayer: null,
    railroadsLayer: null,
    roadCoords: [],    // Массив координат для быстрого поиска
    railCoords: [],

    init: function(map) {
        this.map = map;
        this.loadInfrastructure();
    },

    loadInfrastructure: async function() {
        // Загружаем дороги (10m или 50m, в зависимости от наличия)
        try {
            const roadsRes = await fetch('./geojson/ne_10m_roads.geojson');
            const roadsData = await roadsRes.json();
            
            this.roadsLayer = L.geoJSON(roadsData, {
                style: { color: '#888', weight: 1, opacity: 0.6 },
                interactive: false // Чтобы не мешали кликать по странам
            }).addTo(this.map);

            // Собираем все координаты дорог в один массив для расчета расстояния
            roadsData.features.forEach(f => {
                if (f.geometry.type === 'LineString') {
                    this.roadCoords.push(...f.geometry.coordinates);
                } else if (f.geometry.type === 'MultiLineString') {
                    f.geometry.coordinates.forEach(line => this.roadCoords.push(...line));
                }
            });

        } catch (e) {
            console.warn("Дороги не загружены (файл не найден)", e);
        }

        // Загружаем ЖД
        try {
            const railsRes = await fetch('./geojson/ne_10m_railroads.geojson');
            const railsData = await railsRes.json();
            
            this.railroadsLayer = L.geoJSON(railsData, {
                style: { color: '#000', weight: 1.5, dashArray: '4, 4', opacity: 0.7 },
                interactive: false
            }).addTo(this.map);

            railsData.features.forEach(f => {
                if (f.geometry.type === 'LineString') {
                    this.railCoords.push(...f.geometry.coordinates);
                } else if (f.geometry.type === 'MultiLineString') {
                    f.geometry.coordinates.forEach(line => this.railCoords.push(...line));
                }
            });

        } catch (e) {
            console.warn("ЖД не загружены (файл не найден)", e);
        }
    },

    // Поиск ближайшей инфраструктуры к точке (для расчета логистики)
    checkLogistics: function(lat, lng) {
        const target = L.latLng(lat, lng);
        let hasRoad = false;
        let hasRail = false;
        let minRoadDist = Infinity;
        let minRailDist = Infinity;

        // В реальной игре тут нужен spatial index (например, turf.js), 
        // но для прототипа хватит простого перебора
        this.roadCoords.forEach(coord => {
            const dist = target.distanceTo(L.latLng(coord[1], coord[0]));
            if (dist < minRoadDist) minRoadDist = dist;
            if (dist < 5000) hasRoad = true; // Если дорога ближе 5 км — считаем, что она есть
        });

        this.railCoords.forEach(coord => {
            const dist = target.distanceTo(L.latLng(coord[1], coord[0]));
            if (dist < minRailDist) minRailDist = dist;
            if (dist < 5000) hasRail = true;
        });

        // Определяем множитель времени
        let speedMultiplier = 1.0;
        let logisticsText = "Бездорожье";

        if (hasRail) {
            speedMultiplier = 0.25;
            logisticsText = "Железная дорога";
        } else if (hasRoad) {
            speedMultiplier = 0.5;
            logisticsText = "Автодорога";
        }

        return { speedMultiplier, logisticsText, hasRoad, hasRail };
    }
};
