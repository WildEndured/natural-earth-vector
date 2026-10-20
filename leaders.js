// leaders.js
const NAME_POOLS = {
    RUS: { first: ["Иван", "Дмитрий", "Сергей", "Алексей", "Владимир", "Николай"], last: ["Иванов", "Смирнов", "Кузнецов", "Попов", "Соколов"] },
    USA: { first: ["John", "James", "Robert", "Michael", "William", "David"], last: ["Smith", "Johnson", "Williams", "Brown", "Jones"] },
    DEU: { first: ["Hans", "Peter", "Wolfgang", "Klaus", "Jürgen"], last: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber"] },
    DEFAULT: { first: ["Alex", "Max", "Leon", "Victor", "Karl", "George"], last: ["Smith", "Novak", "Kim", "Garcia", "Dubois", "Rossi"] }
};
const IDEOLOGIES = [
    { id: "democracy", name: "Демократия", color: "#3498db", aggression: 0.2 },
    { id: "authoritarian", name: "Авторитаризм", color: "#95a5a6", aggression: 0.5 },
    { id: "nationalism", name: "Национализм", color: "#e67e22", aggression: 0.8 },
    { id: "communism", name: "Коммунизм", color: "#e74c3c", aggression: 0.6 }
];

window.Leaders = {
    allLeaders: {},
    currentPlayerCountry: null,
    init: function(countriesData) {
        if (!countriesData) return;
        countriesData.features.forEach(f => {
            const id = f.properties.ADM0_A3 || f.properties.ISO_A3 || f.properties.NAME;
            if (!this.allLeaders[id]) this.allLeaders[id] = this.generateLeader(id, f.properties.NAME_RU || f.properties.NAME);
        });
    },
    generateLeader: function(countryId, countryName) {
        const pool = NAME_POOLS[countryId] || NAME_POOLS.DEFAULT;
        const firstName = pool.first[Math.floor(Math.random() * pool.first.length)];
        const lastName = pool.last[Math.floor(Math.random() * pool.last.length)];
        const ideology = IDEOLOGIES[Math.floor(Math.random() * IDEOLOGIES.length)];
        return {
            id: `${countryId}_L${Date.now()}`,
            name: `${firstName} ${lastName}`,
            title: "Президент",
            age: Math.floor(Math.random() * 35) + 40,
            ideology: ideology,
            health: 100,
            countryId: countryId,
            countryName: countryName
        };
    },
    tick: function(monthsPassed) {
        for (const countryId in this.allLeaders) {
            const leader = this.allLeaders[countryId];
            if (!leader) continue;
            leader.age += monthsPassed / 12;
            if (leader.age > 60) {
                const deathChance = (leader.age - 60) * 0.005 * monthsPassed;
                if (Math.random() < deathChance) this.killLeader(countryId);
            }
        }
    },
    killLeader: function(countryId) {
        const oldLeader = this.allLeaders[countryId];
        const newLeader = this.generateLeader(countryId, oldLeader.countryName);
        this.allLeaders[countryId] = newLeader;
        if (countryId === this.currentPlayerCountry) {
            if (window.GameTime) window.GameTime.addPenalty(3);
            alert(`Смена власти в ${oldLeader.countryName}!\nНовый лидер: ${newLeader.name}\nПриказы заблокированы на 3 месяца.`);
        }
    }
};
