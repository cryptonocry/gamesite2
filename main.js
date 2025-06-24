// main.js
import { addParticipantToXano, fetchAllParticipantsFromXano } from "./api.js";
import { showRecordsOverlay } from "./ui.js";
import { Icon } from "./digit.js";
import {
  cells, generatedChunks,
  ensureVisibleChunks, drawCells, getClickedIcon
} from "./game.js";

// Звуки
function playSound(src, vol = 0.5) {
  const s = new Audio(src);
  s.volume = vol;
  s.play().catch(e => console.warn(`Failed to play sound ${src}:`, e));
}

// HUD
const hud = document.getElementById("hud");
const keyCountEl = document.getElementById("keyCount");
const batteryIconEl = document.getElementById("batteryIcon");
const batteryPctEl = document.getElementById("batteryPercent");
const plusTextEl = document.getElementById("plusText");

// In-game menu UI
const fullscreenButton = document.getElementById("fullscreenButton");
const gameMenuButton = document.getElementById("gameMenuButton");
const inGameMenuOverlay = document.getElementById("inGameMenuOverlay");
const btnFullscreenIG = document.getElementById("btnFullscreenIG");
const btnRestartIG = document.getElementById("btnRestartIG");
const btnMainIG = document.getElementById("btnMainIG");
const btnCloseMenu = document.getElementById("btnCloseMenu");

btnCloseMenu.addEventListener("click", () => {
  inGameMenuOverlay.style.display = "none";
});

// Camera mode toggles
let enableEdgePan = true;
let enableKeyboardPan = true;
let enableRightDragPan = true;

const cbEdgePan = document.getElementById("cbEdgePan");
const cbKeyboardPan = document.getElementById("cbKeyboardPan");
const cbRightDragPan = document.getElementById("cbRightDragPan");

cbEdgePan.addEventListener("change", () => enableEdgePan = cbEdgePan.checked);
cbKeyboardPan.addEventListener("change", () => enableKeyboardPan = cbKeyboardPan.checked);
cbRightDragPan.addEventListener("change", () => enableRightDragPan = cbRightDragPan.checked);

// Login & overlays
const loginContainer = document.getElementById("loginContainer");
const walletInput = document.getElementById("walletInput");
const loginOkButton = document.getElementById("loginOkButton");
const loginCancelButton = document.getElementById("loginCancelButton");
const playWithoutWalletButton = document.getElementById("playWithoutWalletButton");

const summaryOverlay = document.getElementById("summaryOverlay");
const lastRecord = document.getElementById("lastRecord");
const refCount = document.getElementById("refCount");
const timeBonusEl = document.getElementById("timeBonus");
const btnPlayNow = document.getElementById("btnPlayNow");

const menuContainer = document.getElementById("menuContainer");
const btnStart = document.getElementById("btnStart");
const btnRecords = document.getElementById("btnRecords");
const btnBuy = document.getElementById("btnBuy");

const gameCanvas = document.getElementById("gameCanvas");
const ctx = gameCanvas.getContext("2d");

const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScore = document.getElementById("finalScore");
const btnMenuOver = document.getElementById("btnMenu");
const btnRestartOver = document.getElementById("btnRestart");

const recordsContainer = document.getElementById("recordsContainer");
const recordsTableContainer = document.getElementById("recordsTableContainer");
const closeRecordsButton = document.getElementById("closeRecordsButton");

// Offscreen canvas для фонарика
let offscreenCanvas = null;
let offscreenCtx = null;
let lastSpotlightRadius = 0;
let lastCursorX = -1;
let lastCursorY = -1;

function initOffscreenCanvas(w, h) {
  offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = w;
  offscreenCanvas.height = h;
  offscreenCtx = offscreenCanvas.getContext("2d");
}

function updateSpotlight(w, h, cursorX, cursorY, spotlightRadius) {
  if (
    lastCursorX === cursorX &&
    lastCursorY === cursorY &&
    lastSpotlightRadius === spotlightRadius &&
    offscreenCanvas.width === w &&
    offscreenCanvas.height === h
  ) return;

  lastCursorX = cursorX;
  lastCursorY = cursorY;
  lastSpotlightRadius = spotlightRadius;

  offscreenCanvas.width = w;
  offscreenCanvas.height = h;

  const grad = offscreenCtx.createRadialGradient(
    cursorX, cursorY, 0,
    cursorX, cursorY, spotlightRadius
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.8, "rgba(0,0,0,0.7)");
  grad.addColorStop(1, "rgba(0,0,0,1)");
  offscreenCtx.fillStyle = grad;
  offscreenCtx.fillRect(0, 0, w, h);
}

// Game state
let gameState = "menu";
let currentPlayer = null;
const START_TIME = 60; // Увеличено для лучшего баланса
let batteryPercent = 100;
let scoreTotal = 0;
let cameraX = 0, cameraY = 0;
let missEvents = [];
let gameStartTime = 0;
let blinkUntil = 0;
let lastPct = null;

// Right-click drag
let isRightDragging = false;
let dragStartRM = { x: 0, y: 0 };
let cameraStartRM = { x: 0, y: 0 };

gameCanvas.addEventListener("mousedown", e => {
  if (e.button === 2 && enableRightDragPan) {
    isRightDragging = true;
    dragStartRM = { x: e.clientX, y: e.clientY };
    cameraStartRM = { x: cameraX, y: cameraY };
    playSound("move.wav", 0.2);
  }
});

gameCanvas.addEventListener("mousemove", e => {
  if (isRightDragging && enableRightDragPan) {
    const dx = e.clientX - dragStartRM.x;
    const dy = e.clientY - dragStartRM.y;
    cameraX = cameraStartRM.x + dx;
    cameraY = cameraStartRM.y + dy;
  }
});

gameCanvas.addEventListener("mouseup", e => {
  if (e.button === 2) isRightDragging = false;
});

gameCanvas.addEventListener("mouseleave", () => {
  isRightDragging = false;
});

gameCanvas.addEventListener("contextmenu", e => e.preventDefault());

// Keyboard controls
const keysPressed = new Set();

window.addEventListener("keydown", e => {
  switch (e.code) {
    case "KeyW": case "ArrowUp":
    case "KeyA": case "ArrowLeft":
    case "KeyS": case "ArrowDown":
    case "KeyD": case "ArrowRight":
      keysPressed.add(e.code);
      break;
  }
});

window.addEventListener("keyup", e => {
  keysPressed.delete(e.code);
});

// Spotlight
let cursorX = 0, cursorY = 0;
let baseSpotlightRadius = 400; // Уменьшен для оптимизации

// Panning settings
const edgeThreshold = 100;
const panSpeed = 300;

gameCanvas.addEventListener("mousemove", e => {
  const r = gameCanvas.getBoundingClientRect();
  cursorX = e.clientX - r.left;
  cursorY = e.clientY - r.top;
});

// Fullscreen
fullscreenButton.addEventListener("click", toggleFullscreen);
btnFullscreenIG.addEventListener("click", toggleFullscreen);

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(console.warn);
  } else {
    document.exitFullscreen();
  }
}

// In-game menu
gameMenuButton.addEventListener("click", () => {
  inGameMenuOverlay.style.display = "flex";
});

btnRestartIG.addEventListener("click", () => {
  inGameMenuOverlay.style.display = "none";
  startGame(0);
});

btnMainIG.addEventListener("click", () => {
  inGameMenuOverlay.style.display = "none";
  gameState = "menu";
  updateUI();
});

// Game over buttons
btnMenuOver.addEventListener("click", () => {
  gameState = "menu";
  updateUI();
});

btnRestartOver.addEventListener("click", () => {
  startGame(0);
});

// Start game button
btnStart.addEventListener("click", () => {
  loginContainer.style.display = "block";
});

// Login flow
loginOkButton.addEventListener("click", async () => {
  const w = walletInput.value.trim().toLowerCase();
  if (!/^[a-z0-9]{62}$/.test(w)) return alert("Invalid wallet! Must be 62 lowercase alphanumeric characters.");
  currentPlayer = { wallet: w, score: 0 };
  loginContainer.style.display = "none";

  const all = await fetchAllParticipantsFromXano();
  const me = all.find(r => r.wallet === w) || { score: 0, referrals: 0 };
  lastRecord.textContent = me.score;
  refCount.textContent = me.referrals || 0;
  let b = 0, n = me.referrals || 0;
  if (n >= 1 && n <= 3) b = 5;
  else if (n <= 10) b = 10;
  else if (n <= 30) b = 15;
  else if (n <= 100) b = 20;
  else b = 25;
  timeBonusEl.textContent = b;
  btnPlayNow.textContent = `PLAY (+${b}%)`;
  summaryOverlay.style.display = "flex";
});

loginCancelButton.addEventListener("click", () => {
  loginContainer.style.display = "none";
});

playWithoutWalletButton.addEventListener("click", () => {
  currentPlayer = null;
  loginContainer.style.display = "none";
  startGame(0);
});

// Play now
btnPlayNow.addEventListener("click", () => {
  summaryOverlay.style.display = "none";
  startGame(currentPlayer ? parseInt(timeBonusEl.textContent) : 0);
});

// Records
btnRecords.addEventListener("click", () => {
  showRecordsOverlay(recordsTableContainer, recordsContainer, currentPlayer);
});

closeRecordsButton.addEventListener("click", () => {
  recordsContainer.style.display = "none";
  gameState = "menu";
  updateUI();
});

// Canvas resize
window.addEventListener("resize", resizeCanvas);
function resizeCanvas() {
  gameCanvas.width = window.innerWidth;
  gameCanvas.height = window.innerHeight;
  initOffscreenCanvas(gameCanvas.width, gameCanvas.height);
}
resizeCanvas();

// Click to collect
gameCanvas.addEventListener("click", e => {
  if (gameState !== "game") return;
  const r = gameCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  const key = getClickedIcon(mx, my, cameraX, cameraY);
  if (!key) return;
  const ic = cells.get(key);
  if (!ic || ic.removeStart) return;
  const now = performance.now();

  if (ic.type === "key") {
    ic.removeStart = now;
    scoreTotal++;
    playSound("plus.wav", 0.4);
    updateHUD();
  } else if (ic.type === "clock") {
    ic.removeStart = now;
    batteryPercent = Math.min(100, batteryPercent + 10);
    playSound("time.wav",  } else {
      blinkUntil = now + 1000;
      batteryIconEl.src = "icons/perplus.svg";
      plusTextEl.classList.remove("play");
      void plusTextEl.offsetWidth;
      plusTextEl.classList.add("play");
    } else {
      batteryPercent = Math.max(0, batteryPercent - 6);
      missEvents.push({ key, time: now });
      playSound("miss.wav", 0.5);
      updateHUD();
    }
});

// Update HUD
function updateHUD() {
  keyCountEl.textContent = scoreTotal;
  const pct = Math.max(0, Math.min(100, Math.floor(batteryPercent)));
  batteryPctEl.textContent = `${pct}%`;

  if (performance.now() < blinkUntil) return;

  let iconName = "per0";
  if (pct > 80) iconName = "per100";
  else if (pct > 60) iconName = "per80";
  else if (pct > 40) iconName = "per60";
  else if (pct > 20) iconName = "per40";
  else if (pct > 0) iconName = "per20";

  batteryIconEl.src = `icons/${iconName}.svg`;
}

// Start game
function startGame(bonus = 0) {
  cells.clear();
  generatedChunks.clear();
  scoreTotal = 0;
  batteryPercent = 100 + bonus;
  missEvents = [];
  blinkUntil = 0;
  lastPct = null;
  Icon.shakeFactor = 1;
  cameraX = cameraY = 0;
  gameStartTime = performance.now();
  lastCursorX = -1; // Сброс кэша фонарика
  playSound("start.wav", 0.7);
  updateHUD();
  gameState = "game";
  updateUI();
}

// Update & Draw
function update(dt) {
  if (gameState !== "game") return;

  dt = Math.min(dt, 50); // Ограничиваем dt до 50 мс
  const dtSec = dt / 1000;
  const w = gameCanvas.width;
  const h = gameCanvas.height;
  const centerX = w / 2;
  const centerY = h / 2;

  // Right-click drag or other panning
  if (enableRightDragPan && isRightDragging) {
    // Обновляется в mousemove
  } else {
    // Keyboard panning
    if (enableKeyboardPan) {
      const keySpeed = panSpeed * 1.2;
      if (keysPressed.has("KeyW") || keysPressed.has("ArrowUp")) cameraY += keySpeed * dtSec;
      if (keysPressed.has("KeyS") || keysPressed.has("ArrowDown")) cameraY -= keySpeed * dtSec;
      if (keysPressed.has("KeyA") || keysPressed.has("ArrowLeft")) cameraX += keySpeed * dtSec;
      if (keysPressed.has("KeyD") || keysPressed.has("ArrowRight")) cameraX -= keySpeed * dtSec;
    }

    // Edge panning
    if (enableEdgePan) {
      const dzX = w * 3;
      const dzY = h * 0.3;
      if (
        cursorX < centerX - dzX ||
        cursorX > centerX + dzX ||
        cursorY < centerY - dzY ||
        cursorY > centerY + dzY
      ) {
        let dx = (cursorX - centerX) / centerX;
        let dy = (cursorY - centerY) / centerY;
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }

        let fx = 0, fy = 0;
        if (cursorX < centerX - dzX) fx = ((centerX - dzX) - cursorX) / (centerX - dzX);
        else if (cursorX > centerX + dzX) fx = (cursorX - (centerX + dzX)) / (centerX - dzX);
        if (cursorY < centerY - dzY) fy = ((centerY - dzY) - cursorY) / (centerY - dzY);
        else if (cursorY > centerY + dzY) fy = (cursorY - (centerY + dzY)) / (centerY - dzY);

        const factor = Math.min(1, Math.max(fx, fy));
        const speed = panSpeed * (1 + factor);

        cameraX -= dx * speed * dtSec;
        cameraY -= dy * speed * dtSec;
      }
    }
  }

  // Update shake and battery
  const now = performance.now();
  const elapsed = (now - gameStartTime) / 1000;
  Icon.shakeFactor = 1 + Math.min(elapsed / START_TIME, 1) * 1.5; // Уменьшена тряска

  batteryPercent -= 1.5 * dtSec; // Уменьшен расход батареи
  const pct = Math.max(0, Math.min(100, Math.floor(batteryPercent)));
  if (pct !== lastPct && now >= blinkUntil) {
    lastPct = pct;
    updateHUD();
  }

  if (batteryPercent <= 0) {
    gameState = "game_over";
    if (currentPlayer) {
      currentPlayer.score = scoreTotal;
      addParticipantToXano(currentPlayer.wallet, scoreTotal).catch(console.error);
    }
    playSound("end.wav", 0.5);
    updateUI();
    return;
  }

  ensureVisibleChunks(cameraX, cameraY, w, h);
}

function draw() {
  if (gameState !== "game") return;

  const w = gameCanvas.width;
  const h = gameCanvas.height;
  ctx.clearRect(0, 0, w, h);

  drawCells(ctx, cameraX, cameraY, w, h);

  const now = performance.now();
  // Miss highlights
  for (let i = missEvents.length - 1; i >= 0; i--) {
    const ev = missEvents[i];
    const ic = cells.get(ev.key);
    if (!ic || now - ev.time > 1000) {
      missEvents.splice(i, 1);
      continue;
    }
    const pos = ic.screenPosition(cameraX, cameraY, now);
    const SIZE = 30;
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - (now - ev.time) / 1000);
    ctx.fillStyle = "red";
    ctx.fillRect(pos.x - SIZE / 2, pos.y - SIZE / 2, SIZE, SIZE);
    ctx.restore();
  }

  // Spotlight
  const spotlightRadius = baseSpotlightRadius * (batteryPercent / 100);
  updateSpotlight(w, h, cursorX, cursorY, spotlightRadius);
  ctx.drawImage(offscreenCanvas, 0, 0);

  // Low battery fade
  if (batteryPercent <= 20) {
    const alpha = 1 - (batteryPercent / 20);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
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

// UI
function updateUI() {
  const isGame = gameState === "game";
  hud.style.display = isGame ? "flex" : "none";
  gameMenuButton.style.display = isGame ? "block" : "none";
  fullscreenButton.style.display = gameState === "menu" ? "block" : "false";

  if (gameState === "menu") {
    menuContainer.style.display = "flex";
    loginContainer.style.display = "none";
    summaryOverlay.style.display = "none";
    gameCanvas.style.display = "none";
    gameOverOverlay.style.display = "none";
    recordsContainer.style.display = "none";
  } else if (gameState === "game") {
    menuContainer.style.display = "none";
    loginContainer.style.display = "none";
    summaryOverlay.style.display = "none";
    gameCanvas.style.display = "block";
    gameOverOverlay.style.display = "none";
    recordsContainer.style.display = "none";
  } else if (gameState === "game_over") {
    menuContainer.style.display = "none";
    loginContainer.style.display = "none";
    summaryOverlay.style.display = "none";
    gameCanvas.style.display = "block";
    gameOverOverlay.style.display = "flex";
    recordsContainer.style.display = "none";
    finalScore.textContent = `Your score: ${scoreTotal}`;
  }
}

// Initialize
updateUI();
