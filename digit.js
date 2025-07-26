export class Icon {
  static shakeFactor = 1;

  constructor(gx, gy, type, spawnTime) {
    this.gx = gx;
    this.gy = gy;
    this.type = type;
    this.spawnTime = spawnTime;
    this.phaseOffset = Math.random() * Math.PI * 2;
    const baseAmp = 3, baseSpd = 0.5;
    this.baseAmplitude = baseAmp * 1.5;
    this.baseSpeed = baseSpd * 1.2;
    if (!Icon.images) Icon._loadImages();
  }

  static _loadImages() {
    Icon.images = {};
    [
      "mask", "letterS", "cd", "xicon",
      "clock", "key", "ethicon", "btcicon",
      "eye", "lock", "scroll", "dna", "flask",
      "per0", "per20", "per40", "per60", "per80", "per100", "perplus"
    ].forEach(name => {
      const img = new Image();
      img.onload = () => {
        // Принудительно применяем белый цвет после загрузки
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64; // Увеличим для лучшего качества
        canvas.height = 64;
        ctx.drawImage(img, 0, 0, 64, 64);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 64, 64);
        ctx.globalCompositeOperation = 'source-over';
        Icon.images[name] = canvas;
      };
      img.src = `icons/${name}.svg`;
      // Временное изображение до полной загрузки
      Icon.images[name] = img;
    });
  }

  screenPosition(camX, camY, now) {
    const CELL = 80;
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
    const img = Icon.images[this.type];
    if (!img || !img.complete) return;
    const SIZE = 30;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Рисуем предварительно обработанное изображение
    ctx.drawImage(img, pos.x - SIZE / 2, pos.y - SIZE / 2, SIZE, SIZE);
    ctx.restore();
  }
}
