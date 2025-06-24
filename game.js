// game.js
import { Icon } from "./digit.js";

export const CELL_SIZE = 50;
export const CHUNK_SIZE = 16; // Уменьшен для меньшей загрузки
export const MAX_CHUNKS = 25; // Ограничение на активные члены

export let cells = new Map();
export let generatedChunks = new Set();

let chunkToCells = new Map();

export function getChunkCoords(cx, cy) {
  const arr = [];
  const bx = cx * CHUNK_SIZE;
  const by = cy * CHUNK_SIZE;
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      arr.push({ x: bx + x, y: by + y });
    }
  }
  return arr;
}

export function generateChunk(cx, cy) {
  const key = `${cx}_${cy}`;
  if (generatedChunks.has(key)) return;
  generatedChunks.add(key);
  const slots = getChunkCoords(cx, cy);
  const chunkCells = new Set();
  let idCounter = 0;

  for (const { x, y } of slots) {
    const slotKey = `${x}_${y}`;
    const r = Math.random();
    let type;
    if (r < 0.01) type = "key"; // Увеличен шанс ключей
    else if (r < 0.015) type = "clock"; // Увеличен шанс часов
    else {
      const types = [
        "mask", "letterS", "cd", "compass",
        "photon", "xicon", "eye", "hat",
        "scroll", "compass", "flask"
      ];
      type = types[Math.floor(Math.random() * types.length)];
    }
    const icon = new Icon(x, y, type, `${slotKey}_${idCounter++}`);
    cells.set(slotKey, icon);
    chunkCells.add(slotKey);
  }
  chunkToCells.set(key, chunkCells);
}

export function cleanupChunks(cx, cy) {
  // Удаляем чанки дальше 5 от текущей позиции камеры
  const maxDist = 5;
  const chunksToRemove = [];
  for (const chunk of generatedChunks) {
    const [x, y] = chunk.split('_').map(Number);
    if (Math.abs(cx - cx) > maxDist || Math.abs(cy - y) > maxDist) {
      chunksToRemove.push(chunk);
    }
  }

  for (const chunk of chunksToRemove) {
    const chunkCells = chunkToCells.get(chunk);
    if (chunkCells) {
      for (const cellKey of chunkCells) {
        cells.delete(cellKey);
      }
      chunkToCells.delete(chunk);
    }
    generatedChunks.delete(chunk);
  }
}

export function ensureVisibleChunks(camX, camY, w, h) {
  const left = -camX / CELL_SIZE;
  const top = -camY / CELL_SIZE;
  const right = (w - camX) / CELL_SIZE;
  const bottom = (h - camY) / CELL_SIZE;
  const cxMin = Math.floor(left / CHUNK_SIZE) - 1;
  const cxMax = Math.floor(right / CHUNK_SIZE) + 1;
  const cyMin = Math.floor(top / CHUNK_SIZE) - 1;
  const cyMax = Math.floor(bottom / CHUNK_SIZE) + 1;

  const currentCx = Math.floor((-camX / CELL_SIZE) / CHUNK_SIZE);
  const currentCy = Math.floor((-camY / CELL_SIZE) / CHUNK_SIZE);

  if (generatedChunks.size > MAX_CHUNKS) {
    cleanupChunks(currentCx, currentCy);
  }

  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cy = cyMin; cy <= cyMax; cy++) {
      generateChunk(cx, cy);
    }
  }
}

export function drawCells(ctx, camX, camY, w, h) {
  const now = performance.now();
  const margin = CELL_SIZE * 2; // Запас для рендеринга
  for (const [key, ic] of cells) {
    const pos = ic.screenPosition(camX, camY, now);
    if (
      pos.x < -margin || pos.x > w + margin ||
      pos.y < -margin || pos.y > h + margin
    ) continue;

    if (ic.removeStart) {
      const dt = now - ic.removeStart;
      const alpha = 1 - dt / 500;
      if (alpha <= 0) {
        cells.delete(key);
        continue;
      }
      ic.draw(ctx, camX, camY, now, alpha);
    } else {
      ic.draw(ctx, camX, camY, now);
    }
  }
}

export function getClickedIcon(mx, my, camX, camY) {
  const now = performance.now();
  let bestKey = null;
  let dmin = Infinity;
  const clickRadius = 32;

  for (const [key, ic] of cells) {
    const pos = ic.screenPosition(camX, camY, now);
    const dx = mx - pos.x;
    const dy = my - pos.y;
    const d = Math.hypot(dx, dy);
    if (d < clickRadius && d < dmin) {
      dmin = d;
      bestKey = key;
    }
  }
  return bestKey;
}
