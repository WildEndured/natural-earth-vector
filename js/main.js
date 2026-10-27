import { resize, setViewport, resetCamera } from './camera.js';
import { generateMap, setMapType } from './terrain.js';
import { init } from './spawn.js';
import { initInput } from './input.js';
import { setOrderModeUI, updateFormationButton } from './ui.js';
import { loop } from './loop.js';
import { USGroups } from './config.js';
import { resetGame, setGlobalAIMode } from './state.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;

function onResize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    setViewport(W, H);
    clampCamera();
}
window.addEventListener('resize', onResize);
onResize();

function startGameWithMap(mapType) {
    document.getElementById('map-select').style.display = 'none';
    // Сброс состояния
    USGroups.reset();
    setGlobalAIMode(true);
    setMapType(mapType);
    generateMap(mapType);
    init();
    resetCamera(W, H);
    initInput();
    setOrderModeUI('move');
    requestAnimationFrame(loop);
}

document.getElementById('map-open').onclick   = () => startGameWithMap('open');
document.getElementById('map-forest').onclick = () => startGameWithMap('forest');
document.getElementById('map-city').onclick   = () => startGameWithMap('city');
