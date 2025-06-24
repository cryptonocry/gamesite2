// game.js
import { Icon } from "./digit.js";

export const CELL_SIZE  = 80;
export const CHUNK_SIZE = 20;

// Структура: ключ чанка -> массив Icon
export let cellsByChunk = {};
export let generatedChunks = new Set();

function getChunkKey(cx, cy) {
  return `${cx}_${cy}`;
}

export function getChunkCoords(cx, cy) {
  const arr = [];
  const bx = cx * CHUNK_SIZE, by = cy * CHUNK_SIZE;
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      arr.push({ x: bx + x, y: by + y });
    }
  }
  return arr;
}

export function generateChunk(cx, cy) {
  const chunkKey = getChunkKey(cx, cy);
  if (generatedChunks.has(chunkKey)) return;
  generatedChunks.add(chunkKey);
  cellsByChunk[chunkKey] = [];

  const slots = getChunkCoords(cx, cy);
  for (let s of slots) {
    const r = Math.random();
    let type;
    if (r < 0.005)        type = "key";
    else if (r < 0.010)   type = "clock";
    else {
      const d = [
        "mask","letterS","cd","xicon",
        "ethicon","btcicon","eye","lock",
        "scroll","dna","flask"
      ];
      type = d[Math.floor(Math.random() * d.length)];
    }
    const icon = new Icon(s.x, s.y, type);
    cellsByChunk[chunkKey].push(icon);
  }
}

// Обновление видимых чанков (вызывать периодически)
let lastChunkCheck = 0;
export function ensureVisibleChunks(camX, camY, w, h) {
  const now = performance.now();
  if (now - lastChunkCheck < 200) return;
  lastChunkCheck = now;

  const left   = -camX / CELL_SIZE;
  const top    = -camY / CELL_SIZE;
  const right  = (w - camX) / CELL_SIZE;
  const bottom = (h - camY) / CELL_SIZE;
  const cxMin = Math.floor(left / CHUNK_SIZE) - 1;
  const cxMax = Math.floor(right / CHUNK_SIZE) + 1;
  const cyMin = Math.floor(top / CHUNK_SIZE) - 1;
  const cyMax = Math.floor(bottom / CHUNK_SIZE) + 1;

  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cy = cyMin; cy <= cyMax; cy++) {
      generateChunk(cx, cy);
    }
  }
}

// Оптимизированная отрисовка: пробегаем только по видимым чанкам и их иконкам
export function drawCells(ctx, camX, camY, w, h) {
  const now = performance.now();
  const padding = CELL_SIZE;  // запас за границами экрана

  // Рассчитываем диапазон чанков, которые потенциально видны
  const left   = -camX / CELL_SIZE;
  const top    = -camY / CELL_SIZE;
  const right  = (w - camX) / CELL_SIZE;
  const bottom = (h - camY) / CELL_SIZE;
  const cxMin = Math.floor(left / CHUNK_SIZE) - 1;
  const cxMax = Math.floor(right / CHUNK_SIZE) + 1;
  const cyMin = Math.floor(top / CHUNK_SIZE) - 1;
  const cyMax = Math.floor(bottom / CHUNK_SIZE) + 1;

  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cy = cyMin; cy <= cyMax; cy++) {
      const chunkKey = getChunkKey(cx, cy);
      const list = cellsByChunk[chunkKey];
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const ic = list[i];

        // Быстрая проверка базового положения
        const baseX = ic.gx * CELL_SIZE + camX;
        const baseY = ic.gy * CELL_SIZE + camY;
        if (
          baseX < -padding || baseX > w + padding ||
          baseY < -padding || baseY > h + padding
        ) continue;

        // Позиция с анимацией
        const pos = ic.screenPosition(camX, camY, now);
        if (
          pos.x < -padding || pos.x > w + padding ||
          pos.y < -padding || pos.y > h + padding
        ) continue;

        // Альфа для удаления
        let alpha = 1;
        if (ic.removeStart) {
          const dt = now - ic.removeStart;
          alpha = 1 - dt / 500;
          if (alpha <= 0) {
            list.splice(i, 1);
            i--;
            continue;
          }
        }

        const img = Icon.images[ic.type];
        if (!img || !img.complete) continue;
        const SIZE = 30;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, pos.x - SIZE/2, pos.y - SIZE/2, SIZE, SIZE);
        ctx.restore();
      }
    }
  }
}

// Поиск клика по иконкам — тоже только по видимым чанкам
export function getClickedIcon(mx, my, camX, camY) {
  const now = performance.now();
  let best = null, dmin = Infinity;

  // Перебираем только видимые чанки
  const left   = -camX / CELL_SIZE;
  const top    = -camY / CELL_SIZE;
  const right  = (ctx.canvas.width  - camX) / CELL_SIZE;
  const bottom = (ctx.canvas.height - camY) / CELL_SIZE;
  const cxMin = Math.floor(left / CHUNK_SIZE) - 1;
  const cxMax = Math.floor(right / CHUNK_SIZE) + 1;
  const cyMin = Math.floor(top / CHUNK_SIZE) - 1;
  const cyMax = Math.floor(bottom / CHUNK_SIZE) + 1;

  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cy = cyMin; cy <= cyMax; cy++) {
      const chunkKey = getChunkKey(cx, cy);
      const list = cellsByChunk[chunkKey];
      if (!list) continue;
      for (const ic of list) {
        const pos = ic.screenPosition(camX, camY, now);
        const dx = mx - pos.x;
        const dy = my - pos.y;
        const d = Math.hypot(dx, dy);
        if (d < 32 && d < dmin) {
          dmin = d;
          best = ic;
        }
      }
    }
  }
  return best;
}
