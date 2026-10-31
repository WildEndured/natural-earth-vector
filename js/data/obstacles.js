// Типы препятствий. Размеры в метрах.
// blocksBullets — блокирует ли пулю
// blocksMove   — блокирует ли движение
// cover        — множитель hitChance для цели ЗА этим препятствием
//                (1.0 = не укрытие, 0.5 = хорошее укрытие)
// color        — цвет для рендера
export const OBSTACLE_TYPES = {
  house: {
    blocksBullets: true,
    blocksMove: true,
    cover: 0.5,
    color: '#5a5a5a',
    borderColor: '#222',
  },
  wall: {
    blocksBullets: true,
    blocksMove: true,
    cover: 0.6,
    color: '#8B7355',
    borderColor: '#5a4a35',
  },
  tree: {
    blocksBullets: false,
    blocksMove: true,
    cover: 0.75,
    color: '#2a5a2a',
    borderColor: '#1a3a1a',
  },
  bush: {
    blocksBullets: false,
    blocksMove: false,
    cover: 0.85,
    color: 'rgba(40,100,40,0.7)',
    borderColor: 'rgba(30,70,30,0.9)',
  },
  car: {
    blocksBullets: true,
    blocksMove: true,
    cover: 0.55,
    color: '#4a6a8a',
    borderColor: '#2a3a4a',
  },
};
