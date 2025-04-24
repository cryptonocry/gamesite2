// digit.js → Icon.js
export class Icon {
  constructor(gx, gy, type, spawnTime = performance.now()) {
    this.gx = gx;
    this.gy = gy;
    this.type = type; // mask, letterS, cd, xicon, clock, key, ethicon, btcicon, eye, lock, scroll, dna, flask
    this.spawnTime = spawnTime;
    this.phaseOffset = Math.random() * Math.PI * 2;

    // усиленная анимация: амплитуда×1.5, скорость×1.2
    const baseAmp = (type === "key" || type === "clock") ? 5 : 3;
    const baseSpd = (type === "key" || type === "clock") ? 1 : 0.5;
    this.baseAmplitude = baseAmp * 1.5;
    this.baseSpeed     = baseSpd * 1.2;

    if (!Icon.images) Icon._loadImages();
  }

  static _loadImages() {
    Icon.images = {};
    [
      "mask","letterS","cd","xicon",
      "clock","key","ethicon","btcicon",
      "eye","lock","scroll","dna","flask"
    ].forEach(name => {
      const img = new Image();
      img.src = `icons/${name}.svg`;
      img.onerror = () => console.error(`Failed to load icon: ${name}.svg`);
      Icon.images[name] = img;
    });
  }

  screenPosition(camX, camY, now) {
    const CELL = 80;
    const baseX = this.gx * CELL + camX;
    const baseY = this.gy * CELL + camY;
    const dt = (now - this.spawnTime) / 1000;
    const dx = this.baseAmplitude * Math.cos(this.baseSpeed * dt + this.phaseOffset);
    const dy = this.baseAmplitude * Math.sin(this.baseSpeed * dt + this.phaseOffset);
    return { x: baseX + dx, y: baseY + dy };
  }

  draw(ctx, camX, camY, now) {
    const pos = this.screenPosition(camX, camY, now);
    const img = Icon.images[this.type];
    if (!img || !img.complete) return;
    const SIZE = 30; // 48 → 30 (–40%)
    ctx.drawImage(img, pos.x - SIZE/2, pos.y - SIZE/2, SIZE, SIZE);
  }
}
