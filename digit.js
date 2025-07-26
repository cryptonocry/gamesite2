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
      "per0", "per20", "per40", "per60", "per80", "per100", "perplus" // Добавлены иконки батареи
    ].forEach(name => {
      const img = new Image();
      img.src = `icons/${name}.svg`;
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
    ctx.drawImage(img, pos.x - SIZE / 2, pos.y - SIZE / 2, SIZE, SIZE);
    
    // Применяем белый цвет поверх иконки
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(pos.x - SIZE / 2, pos.y - SIZE / 2, SIZE, SIZE);
    ctx.globalCompositeOperation = 'source-over'; // Возвращаем стандартный режим
    ctx.restore();
  }
}
