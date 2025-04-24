// game.js
import { Icon } from "./digit.js";

export const CELL_SIZE  = 80;
export const CHUNK_SIZE = 20;

export let cells = {};              // { "x_y": Icon }
export let generatedChunks = new Set();

export function getChunkCoords(cx, cy) {
  const out = [];
  const baseX = cx * CHUNK_SIZE, baseY = cy * CHUNK_SIZE;
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      out.push({ x: baseX + lx, y: baseY + ly });
    }
  }
  return out;
}

// спавним в чанк
export function generateChunk(cx, cy) {
  const key = `${cx}_${cy}`;
  if (generatedChunks.has(key)) return;
  generatedChunks.add(key);

  const coords = getChunkCoords(cx, cy);
  for (let coord of coords) {
    const slot = `${coord.x}_${coord.y}`;
    // рандом:
    const r = Math.random();
    let type;
    if (r < 0.005)       type = "key";     // ≈0.5%
    else if (r < 0.010)  type = "clock";   // ≈0.5%
    else {
      // рандом-дистракторы
      const d = ["mask","letterS","cd","ufo","glitch"];
      type = d[Math.floor(Math.random()*d.length)];
    }
    cells[slot] = new Icon(coord.x, coord.y, type);
  }
}

export function ensureVisibleChunks(cameraX, cameraY, w, h) {
  const left   = -cameraX / CELL_SIZE;
  const top    = -cameraY / CELL_SIZE;
  const right  = (w - cameraX) / CELL_SIZE;
  const bottom = (h - cameraY) / CELL_SIZE;
  const cxMin = Math.floor(left/CHUNK_SIZE)-1;
  const cxMax = Math.floor(right/CHUNK_SIZE)+1;
  const cyMin = Math.floor(top/CHUNK_SIZE)-1;
  const cyMax = Math.floor(bottom/CHUNK_SIZE)+1;
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cy = cyMin; cy <= cyMax; cy++) {
      generateChunk(cx, cy);
    }
  }
}

export function drawCells(ctx, cameraX, cameraY, w, h) {
  const now = performance.now();
  for (let key in cells) {
    const icon = cells[key];
    const pos = icon.screenPosition(cameraX, cameraY, now);
    if (
      pos.x < -CELL_SIZE || pos.x > w + CELL_SIZE ||
      pos.y < -CELL_SIZE || pos.y > h + CELL_SIZE
    ) continue;
    icon.draw(ctx, cameraX, cameraY, now);
  }
}

export function getClickedIcon(mouseX, mouseY, cameraX, cameraY) {
  const now = performance.now();
  let closest = null, distMin = Infinity;
  for (let key in cells) {
    const ic = cells[key];
    const pos = ic.screenPosition(cameraX, cameraY, now);
    const dx = mouseX - pos.x, dy = mouseY - pos.y;
    const d  = Math.hypot(dx,dy);
    if (d < 32 && d < distMin) {
      distMin = d;
      closest = key;
    }
  }
  return closest; // слот или null
}
