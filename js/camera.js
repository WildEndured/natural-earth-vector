import { camera } from './state.js';
import { WORLD } from './config.js';

let W = 0, H = 0;

export function setViewport(w, h) { W = w; H = h; }
export function getViewport() { return { W, H }; }

export function screenToWorld(sx, sy) {
    return { x: (sx - W / 2) / camera.zoom + camera.x, y: (sy - H / 2) / camera.zoom + camera.y };
}
export function worldToScreen(wx, wy) {
    return { x: (wx - camera.x) * camera.zoom + W / 2, y: (wy - camera.y) * camera.zoom + H / 2 };
}
export function clampCamera() {
    if (!W || !H) return;
    const halfW = (W / 2) / camera.zoom, halfH = (H / 2) / camera.zoom;
    if (WORLD.width * camera.zoom < W) camera.x = WORLD.width / 2;
    else camera.x = Math.max(halfW, Math.min(WORLD.width - halfW, camera.x));
    if (WORLD.height * camera.zoom < H) camera.y = WORLD.height / 2;
    else camera.y = Math.max(halfH, Math.min(WORLD.height - halfH, camera.y));
}
export function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * factor));
    const after = screenToWorld(sx, sy);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    clampCamera();
}
export function resetCamera(w, h) {
    camera.x = WORLD.width / 2;
    camera.y = WORLD.height / 2;
    const fitZoom = Math.min(w / WORLD.width, h / WORLD.height) * 0.95;
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, fitZoom));
    clampCamera();
}
