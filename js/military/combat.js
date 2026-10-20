// js/military/combat.js

window.CombatSystem = {
    activeBattle: null,

    startBattle: function(attacker, defender, targetProvId) {
        this.activeBattle = {
            attacker: attacker,
            defender: defender,
            provId: targetProvId,
            attackerHp: attacker.strength,
            defenderHp: defender.strength,
            timer: 5,
            interval: null
        };

        const modal = document.getElementById('combat-modal');
        document.getElementById('cm-attacker-name').textContent = attacker.name;
        document.getElementById('cm-attacker-hp').textContent = attacker.strength.toLocaleString();
        document.getElementById('cm-defender-name').textContent = defender.name;
        document.getElementById('cm-defender-hp').textContent = defender.strength.toLocaleString();
        document.getElementById('cm-status').textContent = "Бой идет...";
        document.getElementById('cm-status').style.color = "#f1c40f";
        modal.style.display = 'block';

        this.activeBattle.interval = setInterval(() => {
            this.tickBattle();
        }, 1000);
    },

    tickBattle: function() {
        const b = this.activeBattle;
        if (!b) return;

        let atkDmg = this.getDamage(b.attacker);
        let defDmg = this.getDamage(b.defender);

        b.defenderHp -= atkDmg;
        b.attackerHp -= defDmg;

        document.getElementById('cm-attacker-hp').textContent = Math.max(0, b.attackerHp).toLocaleString();
        document.getElementById('cm-defender-hp').textContent = Math.max(0, b.defenderHp).toLocaleString();

        if (b.defenderHp <= 0) this.endBattle(true);
        else if (b.attackerHp <= 0) this.endBattle(false);
    },

    getDamage: function(army) {
        let dmg = army.strength * 0.1;
        if (army.type === 'armor') dmg *= 1.5;
        if (army.type === 'airborne') dmg *= 1.2;
        return Math.floor(dmg);
    },

    endBattle: function(attackerWon) {
        const b = this.activeBattle;
        clearInterval(b.interval);

        const statusEl = document.getElementById('cm-status');
        
        if (attackerWon) {
            statusEl.textContent = "ПОБЕДА! Враг уничтожен.";
            statusEl.style.color = "#2ecc71";
            if (window.MapManager) MapManager.captureProvince(b.attacker.coord[0], b.attacker.coord[1], "RUS");
            if (b.defender.marker && b.defender.marker.remove) b.defender.marker.remove();
        } else {
            statusEl.textContent = "ПОРАЖЕНИЕ! Армия уничтожена.";
            statusEl.style.color = "#e74c3c";
            if (b.attacker.marker && b.attacker.marker.remove) b.attacker.marker.remove();
        }

        setTimeout(() => {
            document.getElementById('combat-modal').style.display = 'none';
            this.activeBattle = null;
        }, 3000);
    }
};
