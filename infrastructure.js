// infrastructure.js
window.Infrastructure = {
    map: null, roadsLayer: null, railroadsLayer: null, roadCoords: [], railCoords: [], isLoaded: false,
    init: function(map) { this.map = map; this.loadInfrastructure(); },
    loadInfrastructure: async function() {
        try {
            const res = await fetch('./geojson/ne_10m_roads.geojson');
            if (res.ok) {
                const data = await res.json();
                this.roadsLayer = L.geoJSON(data, { style: { color: '#888', weight: 1, opacity: 0.6 }, interactive: false }).addTo(this.map);
                data.features.forEach(f => {
                    if (f.geometry.type === 'LineString') this.roadCoords.push(...f.geometry.coordinates);
                    else if (f.geometry.type === 'MultiLineString') f.geometry.coordinates.forEach(l => this.roadCoords.push(...l));
                });
            }
        } catch (e) { console.warn("Дороги не загружены", e); }
        try {
            const res = await fetch('./geojson/ne_10m_railroads.geojson');
            if (res.ok) {
                const data = await res.json();
                this.railroadsLayer = L.geoJSON(data, { style: { color: '#000', weight: 1.5, dashArray: '4, 4', opacity: 0.7 }, interactive: false }).addTo(this.map);
                data.features.forEach(f => {
                    if (f.geometry.type === 'LineString') this.railCoords.push(...f.geometry.coordinates);
                    else if (f.geometry.type === 'MultiLineString') f.geometry.coordinates.forEach(l => this.railCoords.push(...l));
                });
            }
        } catch (e) { console.warn("ЖД не загружены", e); }
        this.isLoaded = true;
    },
    toggleVisibility: function(type, visible) {
        if (type === 'roads' && this.roadsLayer) visible ? this.roadsLayer.addTo(this.map) : this.map.removeLayer(this.roadsLayer);
        else if (type === 'rails' && this.railroadsLayer) visible ? this.railroadsLayer.addTo(this.map) : this.map.removeLayer(this.railroadsLayer);
    },
    checkLogistics: function(lat, lng) {
        if (!this.isLoaded) return { speedMultiplier: 1.0, logisticsText: "Данные в пути", hasRoad: false, hasRail: false };
        const target = L.latLng(lat, lng);
        let hasRoad = false, hasRail = false;
        for (let i = 0; i < this.roadCoords.length; i++) { if (target.distanceTo(L.latLng(this.roadCoords[i][1], this.roadCoords[i][0])) < 15000) { hasRoad = true; break; } }
        for (let i = 0; i < this.railCoords.length; i++) { if (target.distanceTo(L.latLng(this.railCoords[i][1], this.railCoords[i][0])) < 15000) { hasRail = true; break; } }
        let speedMultiplier = 1.0, logisticsText = "Бездорожье";
        if (hasRail) { speedMultiplier = 0.25; logisticsText = "Железная дорога"; }
        else if (hasRoad) { speedMultiplier = 0.5; logisticsText = "Автодорога"; }
        return { speedMultiplier, logisticsText, hasRoad, hasRail };
    }
};
