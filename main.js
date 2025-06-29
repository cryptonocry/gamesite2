
import { drawCells, ensureVisibleChunks, getClickedIcon } from "./game.js";
import { onClickIcon } from "./ui.js";

const gameCanvas = document.getElementById("game");
const ctx = gameCanvas.getContext("2d");
export { gameCanvas, ctx };

export let cameraX = 0, cameraY = 0;
export let gameState = "menu";
export let missEvents = [];

let cursorX = 0, cursorY = 0;
let mouseClientX = 0, mouseClientY = 0;

gameCanvas.addEventListener("mousemove", e => {
  mouseClientX = e.clientX;
  mouseClientY = e.clientY;
});

gameCanvas.addEventListener("click", (e) => {
  if (gameState !== "game") return;
  const rect = gameCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const key = getClickedIcon(mx, my, cameraX, cameraY);
  if (key) {
    onClickIcon(key);
  } else {
    missEvents.push({ key: null, time: performance.now() });
  }
});

function resizeCanvas() {
  gameCanvas.width = window.innerWidth;
  gameCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function updateCamera(dt) {
  // Можно добавить плавное движение камеры, если нужно
}

function draw() {
  if (gameState !== "game") return;

  const now = performance.now();

  const rect = gameCanvas.getBoundingClientRect();
  cursorX = mouseClientX - rect.left;
  cursorY = mouseClientY - rect.top;

  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  drawCells(ctx, cameraX, cameraY, gameCanvas.width, gameCanvas.height, now);

  // Подсветка красным при промахах
  for (let i = missEvents.length - 1; i >= 0; i--) {
    const ev = missEvents[i];
    if (!ev.time || now - ev.time > 1000) {
      missEvents.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - (now - ev.time) / 1000);
    ctx.fillStyle = "red";
    ctx.fillRect(cursorX - 15, cursorY - 15, 30, 30);
    ctx.restore();
  }

  // Фонарь
  const gradient = ctx.createRadialGradient(cursorX, cursorY, 0, cursorX, cursorY, 150);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.85)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
}

function update(dt) {
  ensureVisibleChunks(cameraX, cameraY, gameCanvas.width, gameCanvas.height);
  updateCamera(dt);
}

let last = performance.now();
function loop() {
  const now = performance.now();
  update(now - last);
  draw();
  last = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
