// digit.js
export class Icon {
  static shakeFactor = 1;
  static images = null;

  constructor(gx, gy, type, spawnTime = performance.now()) {
    this.gx = gx;
    this.gy = gy;
    this.type = type;
    this.spawnTime = spawnTime;
    this.phaseOffset = Math.random() * Math.PI * 2;
    const baseAmp = 3, baseSpd = 0.5;
    this.baseAmplitude = baseAmp * 1.05;
    this.baseSpeed = baseSpd * 0.9;
    if (!Icon.images) Icon._loadImages();
  }

  static _loadImages() {
    Icon.images = new Map();
    const iconNames = [
      "mask", "letterS", "cd", "xicon",
      "clock", "key", "ethicon", "btcicon",
      "eye", "lock", "scroll", "dna", "flask"
    ];
    iconNames.forEach(name => {
      const img = new Image();
      img.src = `icons/${name}.svg`;
      img.onerror = () => console.warn(`Failed to load icon ${name}.svg`);
      img.onload = () => Icon.images.set(name, img);
    });
  }

  screenPosition(camX, camY, now) {
    const CELL = 80; // Вернул оригинальный размер ячейки
    const baseX = this.gx * CELL + camX;
    const baseY = this.gy * CELL + camY;
    const dt = (now - this.spawnTime) / 1000;
    const amp = this.baseAmplitude * Icon.shakeFactor;
    const dx = amp * Math.cos(this.baseSpeed * dt + this.phaseOffset);
    const dy = amp * Math.sin(this.baseSpeed * dt + this.phaseOffset);
    return { x: baseX + dx, y: baseY + dy };
  }

  draw(ctx, camX, camY, now, alpha = 1) {
    const pos = this.screenPosition(camX, camY, now);
    const img = Icon.images.get(this.type);
    if (!img || !img.complete) return;
    const SIZE = 30;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, pos.x - SIZE / 2, pos.y - SIZE / 2, SIZE, SIZE);
    ctx.restore();
  }
}
