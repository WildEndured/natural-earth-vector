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

        b.defenderH
