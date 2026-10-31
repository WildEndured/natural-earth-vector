export class World {
  constructor({ width, height, tileSize = 64 }) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.tiles = new Uint8Array(
      Math.ceil(width / tileSize) * Math.ceil(height / tileSize)
    );
    this.objective = { x: width / 2, y: height / 2, radius: 100, owner: 'neutral' };
  }
  getTile(tx, ty) {
    const w = Math.ceil(this.width / this.tileSize);
    return this.tiles[ty * w + tx] ?? 1;
  }
}
