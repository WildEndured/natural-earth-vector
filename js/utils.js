// ==================== UTILS.JS ====================

class SpatialHash {
    constructor(cellSize = 50) { this.cellSize = cellSize; this.cells = new Map(); }
    clear() { this.cells.clear(); }
    key(x, y) { const gx = Math.floor(x / this.cellSize), gy = Math.floor(y / this.cellSize); return ((gx & 0xFFFF) << 16) | (gy & 0xFFFF); }
    insert(obj) { const k = this.key(obj.x, obj.y); let list = this.cells.get(k); if (!list) { list = []; this.cells.set(k, list); } list.push(obj); }
    queryRadius(x, y, radius) {
        const result = [];
        const minX = Math.floor((x - radius) / this.cellSize), maxX = Math.floor((x + radius) / this.cellSize);
        const minY = Math.floor((y - radius) / this.cellSize), maxY = Math.floor((y + radius) / this.cellSize);
        for (let cx = minX; cx <= maxX; cx++) {
            for (let cy = minY; cy <= maxY; cy++) {
                const k = ((cx & 0xFFFF) << 16) | (cy & 0xFFFF);
                const list = this.cells.get(k);
                if (list) for (let i = 0; i < list.length; i++) result.push(list[i]);
            }
        }
        return result;
    }
}

function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

function pointInRect(x, y, rect, padding = 0) {
    return x > rect.x - rect.w / 2 - padding && x < rect.x + rect.w / 2 + padding && y > rect.y - rect.h / 2 - padding && y < rect.y + rect.h / 2 + padding;
}

function pointInAnyObstacle(x, y, obstacles, skipTypes = []) {
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (skipTypes.indexOf(obs.type) !== -1) continue;
        if (pointInRect(x, y, obs)) return obs;
    }
    return null;
}

function segmentIntersectsRect(x1, y1, x2, y2, rect) {
    const minX = rect.x - rect.w / 2, maxX = rect.x + rect.w / 2, minY = rect.y - rect.h / 2, maxY = rect.y + rect.h / 2;
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy], q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) { if (q[i] < 0) return false; }
        else {
            const r = q[i] / p[i];
            if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
            else { if (r < t0) return false; if (r < t1) t1 = r; }
        }
    }
    return t0 < t1;
}

function rayBlocked(x1, y1, x2, y2, obstacles) {
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (obs.type === 'tree') continue;
        if (segmentIntersectsRect(x1, y1, x2, y2, obs)) return obs;
    }
    return null;
}

function isInViewCone(viewer, target, coneAngleDeg = 120) {
    const angleToTarget = Math.atan2(target.y - viewer.y, target.x - viewer.x);
    let diff = Math.abs(angleToTarget - viewer.facing);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    const halfCone = (coneAngleDeg * Math.PI / 180) / 2;
    return diff <= halfCone;
}

function applyBulletDrop(tx, ty, distance, weapon) {
    if (!weapon.bulletSpeed || weapon.isAntiTank) return { tx, ty };
    const t = distance / weapon.bulletSpeed;
    const drop = 0.5 * 9.81 * t * t * 10; // Коэффициент 10
    return { tx, ty: ty + drop };
}

function calculateRicochet(hitX, hitY, targetX, targetY, obstacles) {
    for (const obs of obstacles) {
        if (obs.type !== 'house' && obs.type !== 'wall') continue;
        const distToLine = Math.hypot(obs.x - hitX, obs.y - hitY);
        if (distToLine > 15) continue;
        
        // Если попали в стену под острым углом (меньше 30 градусов) - рикошет
        const angle = Math.atan2(targetY - hitY, targetX - hitX);
        if (Math.random() < 0.3) {
            const ricochetX = targetX + (Math.random() - 0.5) * 50;
            const ricochetY = targetY + (Math.random() - 0.5) * 50;
            return { x: ricochetX, y: ricochetY };
        }
    }
    return null;
}

function nearestCoverPoint(x, y, obstacles, maxDist) {
    let best = null, bestDist = maxDist;
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (obs.type === 'tree' || obs.type === 'bush') continue;
        const dx = x - obs.x, dy = y - obs.y, d = Math.hypot(dx, dy);
        if (d < 0.01 || d > maxDist) continue;
        const halfW = obs.w / 2, halfH = obs.h / 2, dirX = -dx / d, dirY = -dy / d;
        const tX = dirX !== 0 ? halfW / Math.abs(dirX) : Infinity, tY = dirY !== 0 ? halfH / Math.abs(dirY) : Infinity;
        const t = Math.min(tX, tY);
        const px = obs.x + dirX * t - dirX * 1.5, py = obs.y + dirY * t - dirY * 1.5;
        const edgeDist = Math.hypot(px - x, py - y);
        if (edgeDist < bestDist) { bestDist = edgeDist; best = { x: px, y: py }; }
    }
    return best;
}

const Camera = {
    x: 500, y: 500, zoom: 0.8, minZoom: 0.3, maxZoom: 4.0, panSpeed: 800,
    screenToWorld(sx, sy, W, H) { return { x: (sx - W / 2) / this.zoom + this.x, y: (sy - H / 2) / this.zoom + this.y }; },
    worldToScreen(wx, wy, W, H) { return { x: (wx - this.x) * this.zoom + W / 2, y: (wy - this.y) * this.zoom + H / 2 }; },
    clamp(W, H) {
        if (!W || !H) return;
        const halfW = (W / 2) / this.zoom, halfH = (H / 2) / this.zoom;
        if (WORLD.width * this.zoom < W) this.x = WORLD.width / 2;
        else this.x = Math.max(halfW, Math.min(WORLD.width - halfW, this.x));
        if (WORLD.height * this.zoom < H) this.y = WORLD.height / 2;
        else this.y = Math.max(halfH, Math.min(WORLD.height - halfH, this.y));
    },
    zoomAt(sx, sy, factor, W, H) {
        const before = this.screenToWorld(sx, sy, W, H);
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
        const after = this.screenToWorld(sx, sy, W, H);
        this.x += before.x - after.x; this.y += before.y - after.y; this.clamp(W, H);
    }
};
