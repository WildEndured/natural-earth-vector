// Возвращает множитель hitChance для цели в точке (x,y).
// 1.0 = не укрыта, 0.5 = за домом
export function coverMultiplier(target, shooter, obstacles) {
  // Смотрим на стены, которые blocksBullets и находятся РЯДОМ с целью
  // (в радиусе 2 м от края — "прижался к стене")
  let best = 1.0;

  for (const o of obstacles) {
    if (!o.blocksBullets) continue;
    // расстояние от цели до ближайшей точки прямоугольника
    const nearestX = Math.max(o.x - o.w / 2, Math.min(target.x, o.x + o.w / 2));
    const nearestY = Math.max(o.y - o.h / 2, Math.min(target.y, o.y + o.h / 2));
    const dx = target.x - nearestX;
    const dy = target.y - nearestY;
    const distToEdge = Math.hypot(dx, dy);

    // цель "прижалась" к стене, если в пределах 3 м
    if (distToEdge > 3) continue;

    // Проверяем: стена МЕЖДУ стрелком и целью?
    // Простой способ — проверить, пересекает ли отрезок shooter→target этот прямоугольник
    if (segmentIntersectsRectSimple(shooter.x, shooter.y, target.x, target.y, o)) {
      // Стена прямо на линии — хорошее укрытие
      best = Math.min(best, o.cover);
    } else {
      // Стена сбоку/сзади — небольшой бонус
      best = Math.min(best, (o.cover + 1) / 2);
    }
  }

  return best;
}

// Простая проверка пересечения (без padding, для укрытия)
function segmentIntersectsRectSimple(x1, y1, x2, y2, rect) {
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
