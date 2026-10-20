// world_ai.js

window.WorldAI = {
    countries: {},
    map: null,

    init: function(map, countriesData) {
        this.map = map;
        if (!countriesData) return;

        const testCountries = ["USA", "CHN", "DEU", "UKR", "KAZ", "FRA", "GBR", "JPN"];
        
        testCountries.forEach(iso => {
            const feature = countriesData.features.find(f => f.properties.ADM0_A3 === iso || f.properties.ISO_A3 === iso);
            if (!feature) return;

            const center = this.getCenter(feature.geometry);
            const strength = Math.floor(Math.random() * 50000) + 30000;
            
            this.countries[iso] = {
                name: feature.properties.NAME_RU || feature.properties.NAME,
                iso: iso,
                coord: center,
                strength: strength,
                target: null,
                atWar: false,
                marker: null,
                color: this.getRandomColor()
            };

            this.spawnArmyMarker(iso);
        });
    },

    spawnArmyMarker: function(iso) {
        const c = this.countries[iso];
        if (!c || !c.coord) return;

        const svg = `<svg width="24" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="14" fill="${c.color}" stroke="#000" stroke-width="1.5"/>
            <line x1="2" y1="2" x2="22" y2="16" stroke="#000" stroke-width="1.5"/>
            <line x1="22" y1="2" x2="2" y2="16" stroke="#000" stroke-width="1.5"/>
            <text x="12" y="23" font-family="Arial" font-size="7" font-weight="bold" fill="#000" text-anchor="middle" stroke="#fff" stroke-width="0.5" paint-order="stroke">${iso}</text>
        </svg>`;

        const icon = L.divIcon({ className: 'nato-icon', html: svg, iconSize: [24, 30], iconAnchor: [12, 15] });
        
        c.marker = L.marker(c.coord, { icon: icon }).addTo(this.map);
        c.marker.bindTooltip(`${c.name}<br>Армия: ${Math.round(c.strength/1000)}k`, { direction: 'top', offset: [0, -15] });
    },

    tick: function() {
        for (const iso in this.countries) {
            if (Math.random() < 0.2) { 
                this.moveArmy(iso);
            }
        }
    },

    moveArmy: function(iso) {
        const c = this.countries[iso];
        if (!c || !c.marker) return;

        const newLat = c.coord[0] + (Math.random() - 0.5) * 5;
        const newLng = c.coord[1] + (Math.random() - 0.5) * 5;
        
        const start = c.marker.getLatLng();
        const end = L.latLng(newLat, newLng);
        const duration = 2000;
        const startTime = performance.now();

        const animate = (time) => {
            const progress = Math.min((time - startTime) / duration, 1);
            c.marker.setLatLng([
                start.lat + (end.lat - start.lat) * progress,
                start.lng + (end.lng - start.lng) * progress
            ]);
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        
        c.coord = [newLat, newLng];
    },

    getCenter: function(geometry) {
        if (!geometry) return [0, 0];
        let coords = [];
        if (geometry.type === 'Polygon') coords = geometry.coordinates[0];
        else if (geometry.type === 'MultiPolygon') coords = geometry.coordinates[0][0];
        
        let lat = 0, lng = 0;
        coords.forEach(c => { lng += c[0]; lat += c[1]; });
        return [lat / coords.length, lng / coords.length];
    },

    getRandomColor: function() {
        const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#9b59b6", "#3498db", "#1abc9c"];
        return colors[Math.floor(Math.random() * colors.length)];
    }
};
