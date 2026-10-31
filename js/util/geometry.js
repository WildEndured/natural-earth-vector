export function dist(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.hypot(dx, dy);
}
export function distSq(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return dx * dx + dy * dy;
}
