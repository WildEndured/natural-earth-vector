import { CONFIG, USGroups } from './config.js';
import { 
    getSelectedUnits, setSelectedUnits, 
    setOrderMode, getOrderMode, 
    getGlobalAIMode, setGlobalAIMode,
    getRuUnits, getUsUnits, getBullets, getExplosions, getDamageTexts,
    setBullets, setExplosions, setDamageTexts
} from './state.js';
import { camera } from './state.js';
import { Formation } from './formations.js';
import { screenToWorld } from './camera.js';

export function showStatus(msg) {
    const el = document.getElementById('status-message');
    if (!el) return;
    el.textContent = msg;
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => { el.textContent = ''; }, 2500);
}
window.showStatus = showStatus;

export function updateUI() {
    const ruUnits = getRuUnits();
    const usUnits = getUsUnits();
    const ruAlive = ruUnits.filter(u => !u.dead).length;
    const usAlive = usUnits.filter(u => !u.dead).length;
    document.getElementById('ru-count').textContent = `Живых: ${ruAlive}/${ruUnits.length}`;
    document.getElementById('us-count').textContent = `Живых: ${usAlive}/${usUnits.length}`;
    const statusText = { neutral: 'нейтральна', RU: '🇷🇺 РФ', US: '🇺🇸 США' }[getObjective().owner];
    document.getElementById('objective-status').textContent = `(${statusText})`;
    const min = Math.floor(getGameTime() / 60).toString().padStart(2, '0');
    const sec = Math.floor(getGameTime() % 60).toString().padStart(2, '0');
    document.getElementById('mission-timer').textContent = `${min}:${sec}`;
    updateSelectedUI();
}

export function updateSelectedUI() {
    const infoPanel = document.getElementById('weapon-info');
    const selectedUnits = getSelectedUnits();
    if (!selectedUnits.length) {
        if (infoPanel) infoPanel.classList.remove('visible');
        return;
    }
    const u = selectedUnits[0], w = u.weapon;
    const el = document.getElementById('selected-unit');
    if (el) {
        const aimPct = Math.round((u.aimLevel || 0) * 100);
        const stanceName = CONFIG.stanceModifiers[u.stance].name;
        const moralePct = Math.round(u.morale);
        const moraleIcon = u.moraleState === 'surrendered' ? '🏳️' : u.moraleState === 'routing' ? '🏃' : u.moraleState === 'panicked' ? '😱' : u.moraleState === 'cautious' ? '⚠️' : '';
        el.innerHTML = `<b>${u.roleName}</b> | HP ${Math.ceil(u.hp)} | ${stanceName}` +
                       (aimPct > 5 ? ` | 🎯 ${aimPct}%` : '') +
                       (u.suppressionLevel > 40 ? ' | ПОДАВЛЕН' : '') +
                       (moralePct < 100 ? ` | ${moraleIcon} ${moralePct}%` : '') +
                       (u.manualControl ? ' | РУЧНОЙ' : '');
    }
    if (infoPanel) {
        document.getElementById('wi-name').textContent = w.name;
        document.getElementById('wi-caliber').textContent = w.caliber || '—';
        document.getElementById('wi-weight').textContent = (w.weight || 0) + ' кг';
        let ammoStr = `${u.ammo} / ${w.maxAmmo}`;
        if (w.hasGL) ammoStr += ` (ГП: ${u.glAmmo})`;
        document.getElementById('wi-ammo').textContent = ammoStr;
        document.getElementById('wi-range').textContent = `${w.effRange || 0} / ${w.maxRange || 0} м`;
        document.getElementById('wi-rpm').textContent = `${w.rpm || 0} в/м`;
        infoPanel.classList.add('visible');
    }
}

export function setOrderModeUI(mode) {
    // вызывается из input.js
    setOrderMode(mode);
    document.querySelectorAll('#orders button').forEach(b => b.classList.remove('active'));
    const aiBtn = document.getElementById('btn-ai-mode');
    if (aiBtn) aiBtn.style.background = getGlobalAIMode() ? '#4a3a6a' : '#6a3a3a';
    updateFormationButton();
    const map = { move: 'btn-move', attack: 'btn-attack', hold: 'btn-hold', follow: 'btn-follow' };
    const btn = document.getElementById(map[mode]);
    if (btn) btn.classList.add('active');
}

export function updateFormationButton() {
    const btn = document.getElementById('btn-formation');
    if (!btn) return;
    btn.textContent = Formation.current === 'march' ? 'Колонна' : 'Цепь';
    btn.classList.toggle('active', Formation.current === 'battle');
}

export function toggleAIModeUI() {
    const btn = document.getElementById('btn-ai-mode');
    const selectedUnits = getSelectedUnits();
    if (getGlobalAIMode()) {
        const aliveSelected = selectedUnits.filter(u => !u.dead);
        if (aliveSelected.length === 0) { showStatus('Выберите живого солдата'); return; }
        const isCmd = aliveSelected.some(u => u.role === 'commander');
        if (isCmd) { getRuUnits().forEach(u => u.manualControl = true); showStatus('Ручное управление отделением'); }
        else { aliveSelected.forEach(u => u.manualControl = true); showStatus(`Ручное: ${aliveSelected[0].roleName}`); }
        setGlobalAIMode(false);
        btn.textContent = 'ИИ: ВЫКЛ'; btn.style.background = '#6a3a3a';
    } else {
        getRuUnits().forEach(u => { u.manualControl = false; u.moveTarget = null; u.followTarget = null; u.holding = false; u.formationPos = null; });
        setGlobalAIMode(true);
        btn.textContent = 'ИИ: ВКЛ'; btn.style.background = '#4a3a6a';
        showStatus('Управление ИИ');
    }
}
