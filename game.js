// game.js
import { Icon } from "./digit.js";

export const CELL_SIZE  = 80;
export const CHUNK_SIZE = 20;

export let cells = {};
export let generatedChunks = new Set();

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
  const key = `${cx}_${cy}`;
  if (generatedChunks.has(key)) return;
  generatedChunks.add(key);
  const slots = getChunkCoords(cx, cy);
  for (let s of slots) {
    const slotKey = `${s.x}_${s.y}`;
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
    cells[slotKey] = new Icon(s.x, s.y, type, performance.now());
  }
}

export function ensureVisibleChunks(camX, camY, w, h) {
  const left   = -camX / CELL_SIZE;
  const top    = -camY / CELL_SIZE;
  const right  = (w - camX) / CELL_SIZE;
  const bottom = (h - camY) / CELL_SIZE;
  const cxMin = Math.floor(left/CHUNK_SIZE) - 1;
  const cxMax = Math.floor(right/CHUNK_SIZE) + 1;
  const cyMin = Math.floor(top/CHUNK_SIZE) - 1;
  const cyMax = Math.floor(bottom/CHUNK_SIZE) + 1;
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cy = cyMin; cy <= cyMax; cy++) {
      generateChunk(cx, cy);
    }
  }
}

export function drawCells(ctx, camX, camY, w, h, now) {
  const left   = Math.floor(-camX / CELL_SIZE) - 1;
  const right  = Math.ceil((w - camX) / CELL_SIZE) + 1;
  const top    = Math.floor(-camY / CELL_SIZE) - 1;
  const bottom = Math.ceil((h - camY) / CELL_SIZE) + 1;

  for (let gx = left; gx <= right; gx++) {
    for (let gy = top; gy <= bottom; gy++) {
      const key = `${gx}_${gy}`;
      const ic = cells[key];
      if (!ic) continue;

      if (ic.removeStart) {
        const dt = now - ic.removeStart;
        const alpha = 1 - dt / 500;
        if (alpha <= 0) {
          delete cells[key];
          continue;
        }
        ic.draw(ctx, camX, camY, now, alpha);
      } else {
        ic.draw(ctx, camX, camY, now, 1);
      }
    }
  }
}

export function getClickedIcon(mx, my, camX, camY) {
  const now = performance.now();
  let best = null, dmin = Infinity;
  for (const k of Object.keys(cells)) {
    const ic = cells[k];
    const pos = ic.screenPosition(camX, camY, now);
    const dx = mx - pos.x, dy = my - pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 32 && d < dmin) { dmin = d; best = k; }
  }
  return best;
}
