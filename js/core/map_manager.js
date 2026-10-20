// map_manager.js

window.MapManager = {
    map: null,
    provincesLayer: null,
    provincesData: null,
    // Храним владельцев провинций: { "RUS-1234": "RUS", "UKR-5678": "UKR" }
    ownership: {},
    // Цвета стран (базовые)
    countryColors: {
        "RUS": "#3b7a3b", // Зеленый (Россия)
        "UKR": "#f1c40f", // Желтый (Украина)
        "KAZ": "#3498db", // Синий (Казахстан)
        "CHN": "#e74c3c", // Красный (Китай)
        "USA": "#9b59b6", // Фиолетовый (США)
        "DEU": "#95a5a6", // Серый (Германия)
        "DEFAULT": "#bdc3c7"
    },
    playerCountry: "RUS",

    init: function(map, geojsonUrl) {
        this.map = map;
        this.loadProvinces(geojsonUrl);
    },

    loadProvinces: async function(url) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            this.provincesData = data;

            // Инициализируем владельцев (по умолчанию - страна, которой принадлежит провинция в Natural Earth)
            data.features.forEach(f => {
                const provId = f.properties.adm1_code || f.properties.ISO_3166_2 || f.properties.NAME;
                const ownerIso = f.properties.adm0_a3 || f.properties.ADM0_A3 || "UNKNOWN";
                this.ownership[provId] = ownerIso;
            });

            // Отрисовываем провинции
            this.provincesLayer = L.geoJSON(data, {
                style: (feature) => this.getStyle(feature),
                onEachFeature: (feature, layer) => {
                    // Подсказка при наведении
                    layer.bindTooltip(feature.properties.NAME_RU || feature.properties.NAME, { sticky: true });
                }
            }).addTo(this.map);

            // Отправляем слой вниз, чтобы он не перекрывал маркеры армий
            this.provincesLayer.bringToBack();
            
            console.log("Карта провинций загружена. Всего:", data.features.length);
        } catch (e) {
            console.error("Ошибка загрузки провинций:", e);
        }
    },

    // Получить цвет для провинции
    getStyle: function(feature) {
        const provId = feature.properties.adm1_code || feature.properties.ISO_3166_2 || feature.properties.NAME;
        const owner = this.ownership[provId] || "UNKNOWN";
        
        let color = this.countryColors[owner] || this.countryColors["DEFAULT"];
        
        // Если провинция принадлежит игроку, делаем её чуть ярче
        let opacity = (owner === this.playerCountry) ? 0.4 : 0.2;

        return {
            color: '#555',
            weight: 0.5,
            fillColor: color,
            fillOpacity: opacity
        };
    },

    // Захват провинции (вызывается из orders.js, когда армия прибывает на место)
    captureProvince: function(lat, lng, newOwner) {
        if (!this.provincesLayer) return;

        // Ищем, в какую провинцию кликнули
        let captured = false;
        this.provincesLayer.eachLayer(layer => {
            if (captured) return;
            // Проверяем, лежит ли точка внутри полигона провинции
            if (layer.getBounds().contains([lat, lng])) {
                // Более точная проверка (Leaflet не всегда точно определяет)
                if (layer.feature && layer.feature.geometry) {
                    // В реальной игре тут нужна проверка isPointInPolygon
                    // Но для прототипа хватит и попадания в bounding box
                    const provId = layer.feature.properties.adm1_code || layer.feature.properties.ISO_3166_2;
                    const oldOwner = this.ownership[provId];
                    
                    if (oldOwner !== newOwner) {
                        this.ownership[provId] = newOwner;
                        layer.setStyle(this.getStyle(layer.feature));
                        captured = true;
                        console.log(`Провинция ${provId} захвачена силами ${newOwner}!`);
                        
                        // Проверяем, не захвачена ли вся страна
                        this.checkCountryDestruction(oldOwner);
                    }
                }
            }
        });

        if (!captured) {
            console.log("Точка не найдена ни в одной провинции.");
        }
    },

    // Проверяем, остались ли у страны провинции
    checkCountryDestruction: function(countryIso) {
        if (countryIso === "UNKNOWN" || countryIso === this.playerCountry) return;
        
        let hasProvinces = false;
        for (const provId in this.ownership) {
            if (this.ownership[provId] === countryIso) {
                hasProvinces = true;
                break;
            }
        }

        if (!hasProvinces) {
            alert(`Страна ${countryIso} полностью захвачена!`);
            // Тут в будущем можно удалить её маркеры с карты
        }
    }
};
