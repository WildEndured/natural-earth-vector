// Liang-Barsky: пересекает ли отрезок (x1,y1)-(x2,y2) прямоугольник rect
export function segmentIntersectsRect(x1, y1, x2, y2, rect) {
  const minX = rect.x - rect.w / 2;
  const maxX = rect.x + rect.w / 2;
  const minY = rect.y - rect.h / 2;
  const maxY = rect.y + rect.h / 2;

  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 < t1;
}

// Возвращает первое препятствие на отрезке (только blocksBullets),
// либо null если путь свободен
export function rayBlocked(x1, y1, x2, y2, obstacles) {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (!o.blocksBullets) continue;
    if (segmentIntersectsRect(x1, y1, x2, y2, o)) return o;
  }
  return null;
}

// Проверка: точка внутри препятствия (для движения)
export function pointInRect(x, y, rect, padding = 0) {
  return (
    x > rect.x - rect.w / 2 - padding &&
    x < rect.x + rect.w / 2 + padding &&
    y > rect.y - rect.h / 2 - padding &&
    y < rect.y + rect.h / 2 + padding
  );
}

// Возвращает препятствие, в котором находится точка (blocksMove)
export function pointInBlockingObstacle(x, y, obstacles) {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (!o.blocksMove) continue;
    if (pointInRect(x, y, o)) return o;
  }
  return null;
}
