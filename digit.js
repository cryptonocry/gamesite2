// digit.js → Icon.js
export class Icon {
  constructor(gx, gy, type, spawnTime = performance.now()) {
    this.gx = gx;
    this.gy = gy;
    this.type = type; // mask, letterS, cd, ufo, glitch, clock, key
    this.spawnTime = spawnTime;
    this.phaseOffset = Math.random() * Math.PI * 2;
    this.baseAmplitude = (type === "key" || type === "clock") ? 5 : 3;
    this.baseSpeed     = (type === "key" || type === "clock") ? 1 : 0.5;

    if (!Icon.images) Icon._loadImages();
  }

  static _loadImages() {
    Icon.images = {};
    ["mask","letterS","cd","ufo","glitch","clock","key"].forEach(name => {
      const img = new Image();
      img.src = `icons/${name}.svg`;
      img.onerror = () => console.error(`Failed to load icon: ${name}.svg`);
      Icon.images[name] = img;
    });
  }

  screenPosition(cameraX, cameraY, now) {
    const CELL = 80;
    const baseX = this.gx * CELL + cameraX;
    const baseY = this.gy * CELL + cameraY;
    const dt = (now - this.spawnTime) / 1000;
    const dx = this.baseAmplitude * Math.cos(this.baseSpeed * dt + this.phaseOffset);
    const dy = this.baseAmplitude * Math.sin(this.baseSpeed * dt + this.phaseOffset);
    return { x: baseX + dx, y: baseY + dy };
  }

  draw(ctx, cameraX, cameraY, now) {
    const pos = this.screenPosition(cameraX, cameraY, now);
    const img = Icon.images[this.type];
    if (!img || !img.complete) return;
    const size = 48;
    ctx.drawImage(img, pos.x - size/2, pos.y - size/2, size, size);
  }
}
