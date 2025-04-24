// digit.js → Icon.js
export class Icon {
  constructor(gx, gy, type, spawnTime = performance.now()) {
    this.gx = gx;
    this.gy = gy;
    this.type = type; // 'mask','letterS','cd','ufo','glitch','clock','key'
    this.spawnTime = spawnTime;
    this.phaseOffset = Math.random() * Math.PI * 2;
    this.baseAmplitude = (type === 'key' || type === 'clock') ? 5 : 3;
    this.baseSpeed     = (type === 'key' || type === 'clock') ? 1 : 0.5;

    if (!Icon.images) Icon._loadImages();
  }

  static _loadImages() {
    Icon.images = {};
    const types = ['mask','letterS','cd','ufo','glitch','clock','key'];
    types.forEach(name => {
      const img = new Image();
      img.src = `icons/${name}.svg`;
      Icon.images[name] = img;
    });
  }

  screenPosition(cameraX, cameraY, currentTime) {
    const CELL_SIZE = 80;
    const baseX = this.gx * CELL_SIZE + cameraX;
    const baseY = this.gy * CELL_SIZE + cameraY;
    const dt = (currentTime - this.spawnTime) / 1000;
    const angle = this.baseSpeed * dt + this.phaseOffset;
    const dx = this.baseAmplitude * Math.cos(angle);
    const dy = this.baseAmplitude * Math.sin(angle);
    return { x: baseX + dx, y: baseY + dy, scale: 1, alpha: 1 };
  }

  draw(ctx, cameraX, cameraY, currentTime) {
    const pos = this.screenPosition(cameraX, cameraY, currentTime);
    const img = Icon.images[this.type];
    if (!img) return;
    const size = 48; // базовый размер
    ctx.save();
    ctx.globalAlpha = pos.alpha;
    ctx.drawImage(
      img,
      pos.x - size/2,
      pos.y - size/2,
      size,
      size
    );
    ctx.restore();
  }
}
