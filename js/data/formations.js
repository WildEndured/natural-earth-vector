// Формации возвращают массив смещений {x, y} для N юнитов.
// Индекс 0 — лидер (командир).
// Смещения в метрах.

const SPACING = 3; // расстояние между юнитами в линии, м

// ===== ЛИНИЯ =====
// Лидер в центре, стрелки по бокам в одну линию, перпендикулярно facing
export function lineFormation(n) {
  const offsets = [{ x: 0, y: 0 }];
  if (n <= 1) return offsets;

  const shooters = n - 1;
  const half = Math.ceil(shooters / 2);

  for (let i = 0; i < shooters; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const idx = Math.floor(i / 2) + 1;
    offsets.push({ x: 0, y: side * idx * SPACING });
  }
  return offsets;
}

// ===== КОЛОННА =====
// Лидер впереди, стрелки по 2 в ряд позади
export function columnFormation(n) {
  const offsets = [{ x: 0, y: 0 }];
  if (n <= 1) return offsets;

  const shooters = n - 1;
  for (let i = 0; i < shooters; i++) {
    const row = Math.floor(i / 2) + 1;
    const col = i % 2 === 0 ? -1 : 1;
    offsets.push({ x: -row * SPACING, y: col * SPACING * 0.6 });
  }
  return offsets;
}

// ===== КЛИН =====
// Лидер впереди, стрелки треугольником — по 1, 2, 3, ...
export function wedgeFormation(n) {
  const offsets = [{ x: 0, y: 0 }];
  if (n <= 1) return offsets;

  let placed = 1;
  let row = 1;
  while (placed < n) {
    const rowCount = row + 1;
    for (let i = 0; i < rowCount && placed < n; i++) {
      const side = i - (rowCount - 1) / 2;
      offsets.push({
        x: -row * SPACING,
        y: side * SPACING,
      });
      placed++;
    }
    row++;
  }
  return offsets;
}

// ===== КОЛЬЦО =====
// Лидер в центре, стрелки по кругу
export function circleFormation(n) {
  const offsets = [{ x: 0, y: 0 }];
  if (n <= 1) return offsets;

  const shooters = n - 1;
  const radius = Math.max(4, shooters * 0.7);
  for (let i = 0; i < shooters; i++) {
    const angle = (i / shooters) * Math.PI * 2 - Math.PI / 2;
    offsets.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }
  return offsets;
}

// ===== РЕЕСТР =====
export const FORMATIONS = {
  line: {
    id: 'line',
    name: 'Линия',
    icon: '═',
    generate: lineFormation,
  },
  column: {
    id: 'column',
    name: 'Колонна',
    icon: '║',
    generate: columnFormation,
  },
  wedge: {
    id: 'wedge',
    name: 'Клин',
    icon: '▲',
    generate: wedgeFormation,
  },
  circle: {
    id: 'circle',
    name: 'Кольцо',
    icon: '●',
    generate: circleFormation,
  },
};

export const DEFAULT_FORMATION = 'line';

// Поворот смещения на угол facing
export function rotateOffset(offset, facing) {
  const cos = Math.cos(facing);
  const sin = Math.sin(facing);
  return {
    x: offset.x * cos - offset.y * sin,
    y: offset.x * sin + offset.y * cos,
  };
}
