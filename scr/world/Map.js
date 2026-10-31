import { MAPS } from '../data/maps.js';

export class Map {
  constructor(id) {
    const data = MAPS[id];
    if (!data) throw new Error(`Unknown map: ${id}`);
    this.id = id;
    this.name = data.name;
    this.width = data.width;
    this.height = data.height;
    this.objective = {
      ...data.objective,
      owner: 'neutral',
      holdTime: 0,
    };
  }
}
