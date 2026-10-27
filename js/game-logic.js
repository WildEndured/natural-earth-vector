import { CONFIG } from './config.js';
import { getRuUnits, getUsUnits, getObjective, setObjective, getGameOver, setGameOver } from './state.js';

export function checkObjective(dt) {
    const objective = getObjective();
    const ruUnits = getRuUnits();
    const usUnits = getUsUnits();
    // ... (логика захвата из game.js)
}

export function endGame(team) {
    setGameOver(true);
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('result-text').textContent = team === 'RU' ? '🏆 Победа России!' : '🏆 Победа США!';
}
