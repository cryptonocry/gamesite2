import { addParticipantToXano, fetchAllParticipantsFromXano } from "./api.js";
import { showRecordsOverlay } from "./ui.js";
import { Icon } from "./digit.js";
import {
  cells, generatedChunks,
  ensureVisibleChunks, drawCells,
  getClickedIcon
} from "./game.js";

// — Звуки —
function playSound(src, vol = 0.5) {
  const s = new Audio(src);
  s.volume = vol;
  s.play().catch(e => console.error("Sound playback failed:", e));
}

// — Предварительная загрузка фоновой музыки —
let backgroundMusic = new Audio("music.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.3;

function preloadAudio() {
  backgroundMusic.load(); // Загружаем музыку заранее
}
preloadAudio();

// HUD
const hud           = document.getElementById("hud");
const keyCountEl    = document.getElementById("keyCount");
const batteryIconEl = document.getElementById("batteryIcon");
const batteryPctEl  = document.getElementById("batteryPercent");
const plusTextEl    = document.getElementById("plusText");

// In-game menu UI
const fullscreenButton  = document.getElementById("fullscreenButton");
const gameMenuButton    = document.getElementById("gameMenuButton");
const inGameMenuOverlay = document.getElementById("inGameMenuOverlay");
const btnFullscreenIG   = document.getElementById("btnFullscreenIG");
const btnRestartIG      = document.getElementById("btnRestartIG");
const btnMainIG         = document.getElementById("btnMainIG");
const btnCloseMenu      = document.getElementById("btnCloseMenu");
btnCloseMenu.addEventListener("click", () => {
  inGameMenuOverlay.style.display = "none";
});

// — CAMERA MODE TOGGLES —
let enableEdgePan      = true;
let enableKeyboardPan  = true;
let enableRightDragPan = true; // Всегда включено

// Найдём чекбоксы для in-game и main menu
const cbEdgePan      = document.getElementById("cbEdgePan");
const cbKeyboardPan  = document.getElementById("cbKeyboardPan");
const cbRightDragPan = document.getElementById("cbRightDragPan");
const cbEdgePanMain  = document.getElementById("cbEdgePanMain");
const cbKeyboardPanMain  = document.getElementById("cbKeyboardPanMain");
const cbRightDragPanMain = document.getElementById("cbRightDragPanMain");

// Проверка, что все элементы найдены
console.log("cbEdgePan:", cbEdgePan);
console.log("cbKeyboardPan:", cbKeyboardPan);
console.log("cbRightDragPan:", cbRightDragPan);
console.log("cbEdgePanMain:", cbEdgePanMain);
console.log("cbKeyboardPanMain:", cbKeyboardPanMain);
console.log("cbRightDragPanMain:", cbRightDragPanMain);

// Простая обработка событий
if (cbEdgePan) cbEdgePan.addEventListener("change", () => { enableEdgePan = cbEdgePan.checked; console.log("Edge Pan:", enableEdgePan); });
if (cbKeyboardPan) cbKeyboardPan.addEventListener("change", () => { enableKeyboardPan = cbKeyboardPan.checked; console.log("Keyboard Pan:", enableKeyboardPan); });
// Чекбокс для ПКМ всегда включён и неактивен
if (cbRightDragPan) {
  cbRightDragPan.checked = true;
  cbRightDragPan.disabled = true; // Неактивен
}
if (cbEdgePanMain) cbEdgePanMain.addEventListener("change", () => { enableEdgePan = cbEdgePanMain.checked; console.log("Edge Pan Main:", enableEdgePan); });
if (cbKeyboardPanMain) cbKeyboardPanMain.addEventListener("change", () => { enableKeyboardPan = cbKeyboardPanMain.checked; console.log("Keyboard Pan Main:", enableKeyboardPan); });
if (cbRightDragPanMain) {
  cbRightDragPanMain.checked = true;
  cbRightDragPanMain.disabled = true; // Неактивен
}

// Синхронизация всех чекбоксов с текущими настройками
function syncAllCheckboxes() {
  if (cbEdgePan) cbEdgePan.checked = enableEdgePan;
  if (cbKeyboardPan) cbKeyboardPan.checked = enableKeyboardPan;
  if (cbRightDragPan) {
    cbRightDragPan.checked = true; // Всегда включено
    cbRightDragPan.disabled = true; // Неактивно
  }
  if (cbEdgePanMain) cbEdgePanMain.checked = enableEdgePan;
  if (cbKeyboardPanMain) cbKeyboardPanMain.checked = enableKeyboardPan;
  if (cbRightDragPanMain) {
    cbRightDragPanMain.checked = true; // Всегда включено
    cbRightDragPanMain.disabled = true; // Неактивно
  }
}

// Sync main menu settings when returning to menu
function syncMainMenuSettings() {
  if (cbEdgePanMain) cbEdgePanMain.checked = enableEdgePan;
  if (cbKeyboardPanMain) cbKeyboardPanMain.checked = enableKeyboardPan;
  if (cbRightDragPanMain) {
    cbRightDragPanMain.checked = true; // Всегда включено
    cbRightDragPanMain.disabled = true; // Неактивно
  }
}

// Синхронизация при открытии игрового меню
gameMenuButton.addEventListener("click", () => {
  syncAllCheckboxes(); // Обновляем все галки перед показом меню
  inGameMenuOverlay.style.display = "flex";
});

// Login & overlays
const loginContainer          = document.getElementById("loginContainer");
const walletInput             = document.getElementById("walletInput");
const loginOkButton           = document.getElementById("loginOkButton");
const loginCancelButton       = document.getElementById("loginCancelButton");
const playWithoutWalletButton = document.getElementById("playWithoutWalletButton");

const summaryOverlay = document.getElementById("summaryOverlay");
const lastRecord     = document.getElementById("lastRecord");
const refCount       = document.getElementById("refCount");
const timeBonusEl    = document.getElementById("timeBonus");
const btnPlayNow     = document.getElementById("btnPlayNow");

const menuContainer  = document.getElementById("menuContainer");
const btnStart       = document.getElementById("btnStart");
const btnRecords     = document.getElementById("btnRecords");
const btnBuy         = document.getElementById("btnBuy");

const gameCanvas     = document.getElementById("gameCanvas");
const ctx            = gameCanvas.getContext("2d");

const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScore      = document.getElementById("finalScore");
const btnMenuOver     = document.getElementById("btnMenu");
const btnRestartOver  = document.getElementById("btnRestart");

const recordsContainer      = document.getElementById("recordsContainer");
const recordsTableContainer = document.getElementById("recordsTableContainer");
const closeRecordsButton    = document.getElementById("closeRecordsButton");

// Game state
let gameState      = "menu";
let currentPlayer  = null;
const START_TIME   = 50;
let batteryPercent = 100;
let scoreTotal     = 0;
let cameraX = 0, cameraY = 0;
let missEvents = [];
let gameStartTime = 0;

let blinkUntil = 0;
let lastPct    = null;

let isRightDragging = false;
let dragStartRM     = { x: 0, y: 0 };
let cameraStartRM   = { x: 0, y: 0 };

gameCanvas.addEventListener("mousedown", e => {
  if (e.button === 2) {
    isRightDragging = true;
    dragStartRM     = { x: e.clientX, y: e.clientY };
    cameraStartRM   = { x: cameraX,    y: cameraY };
    playSound("move.wav", 0.2);
  }
});

gameCanvas.addEventListener("mousemove", e => {
  if (isRightDragging) {
    const dx = e.clientX - dragStartRM.x;
    const dy = e.clientY - dragStartRM.y;
    cameraX = cameraStartRM.x + dx;
    cameraY = cameraStartRM.y + dy;
  }
});

gameCanvas.addEventListener("mouseup", e => {
  if (e.button === 2) isRightDragging = false;
});

gameCanvas.addEventListener("contextmenu", e => e.preventDefault());

const keysPressed = new Set();

window.addEventListener("keydown", e => {
  switch(e.code) {
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

let cursorX = 0, cursorY = 0;
const spotlightRadius = 500;

const edgeThreshold = 500;
const panSpeed      = 400;

gameCanvas.addEventListener("mousemove", e => {
  const r = gameCanvas.getBoundingClientRect();
  cursorX = e.clientX - r.left;
  cursorY = e.clientY - r.top;
});

fullscreenButton.addEventListener("click", toggleFullscreen);
btnFullscreenIG.addEventListener("click", () => {
  toggleFullscreen();
});
function toggleFullscreen() {
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen();
  else
    document.exitFullscreen();
}

gameMenuButton.addEventListener("click", () => {
  syncAllCheckboxes(); // Обновляем все галки перед показом меню
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
  syncMainMenuSettings();
});

btnMenuOver.addEventListener("click", () => {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0; // Сбрасываем позицию
  }
  gameState = "menu";
  updateUI();
  syncMainMenuSettings();
});
btnRestartOver.addEventListener("click", () => {
  startGame(0);
});

btnStart.addEventListener("click", () => {
  loginContainer.style.display = "block";
});

loginOkButton.addEventListener("click", async () => {
  const w = walletInput.value.trim().toLowerCase();
  if (!w || w.length !== 62) return alert("Invalid wallet!");
  currentPlayer = { wallet: w, score: 0 };
  loginContainer.style.display = "none";

  const all = await fetchAllParticipantsFromXano();
  const me = all.find(r => r.wallet === w) || { score: 0, referals: 0 };
  lastRecord.textContent = me.score;
  refCount.textContent   = me.referals;
  let b = 0, n = me.referals;
  if      (n >= 1 && n <= 3) b = 5;
  else if (n <= 10)          b = 10;
  else if (n <= 30)          b = 15;
  else if (n <= 100)         b = 20;
  else                        b = 25;
  timeBonusEl.textContent = b;
  btnPlayNow.textContent  = `PLAY (+${b}%)`;
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

btnPlayNow.addEventListener("click", () => {
  summaryOverlay.style.display = "none";
  startGame(currentPlayer ? parseInt(timeBonusEl.textContent) : 0);
});

btnRecords.addEventListener("click", () => {
  showRecordsOverlay(recordsTableContainer, recordsContainer, currentPlayer);
});
closeRecordsButton.addEventListener("click", () => {
  recordsContainer.style.display = "none";
  gameState = "menu";
  updateUI();
  syncMainMenuSettings();
});

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
function resizeCanvas() {
  gameCanvas.width  = window.innerWidth;
  gameCanvas.height = window.innerHeight;
}

gameCanvas.addEventListener("click", e => {
  if (gameState !== "game") return;
  const r  = gameCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const key = getClickedIcon(mx, my, cameraX, cameraY);
  if (!key) return;
  const ic = cells[key];
  if (ic.removeStart) return;
  const now = performance.now();

  if (ic.type === "key") {
    ic.removeStart = now;
    scoreTotal++;
    playSound("plus.wav", 0.4);
    updateHUD();
  }
  else if (ic.type === "clock") {
    ic.removeStart = now;
    batteryPercent = Math.min(100, batteryPercent + 10);
    playSound("time.wav", 0.4);
    blinkUntil = now + 1000;
    batteryPctEl.textContent = `${Math.floor(batteryPercent)}%`;
    batteryIconEl.src        = "icons/perplus.svg";
    plusTextEl.classList.remove("play");
    void plusTextEl.offsetWidth;
    plusTextEl.classList.add("play");
  }
  else {
    batteryPercent = Math.max(0, batteryPercent - 6);
    missEvents.push({ key, time: now });
    playSound("error.wav", 0.5);
    updateHUD();
  }
});

function updateHUD() {
  keyCountEl.textContent = scoreTotal;

  const pct = Math.max(0, Math.min(100, Math.floor(batteryPercent)));
  batteryPctEl.textContent = `${pct}%`;

  if (performance.now() < blinkUntil) return;

  let iconName = "per0";
  if      (pct > 80) iconName = "per100";
  else if (pct > 60) iconName = "per80";
  else if (pct > 40) iconName = "per60";
  else if (pct > 20) iconName = "per40";
  else if (pct > 0)  iconName = "per20";

  batteryIconEl.src = `icons/${iconName}.svg`;
}

function startGame(bonus = 0) {
  // Останавливаем музыку, если она уже играет
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  }

  Object.keys(cells).forEach(k => delete cells[k]);
  generatedChunks.clear();
  scoreTotal = 0;
  batteryPercent = 100 + bonus;
  missEvents = [];
  blinkUntil = 0;
  lastPct = null;
  Icon.shakeFactor = 1;
  cameraX = cameraY = 0;
  gameStartTime = performance.now();

  // Запускаем музыку
  if (backgroundMusic) {
    backgroundMusic.play().catch(e => console.error("Music playback failed:", e));
  }

  playSound("start.wav", 0.7);
  updateHUD();
  gameState = "game";
  updateUI();
}

function update(dt) {
  if (gameState !== "game") return;

  const dtSec   = dt / 1000;
  const w       = gameCanvas.width;
  const h       = gameCanvas.height;
  const centerX = w / 2;
  const centerY = h / 2;

  if (enableRightDragPan && isRightDragging) {
  } else {
    if (enableKeyboardPan) {
      const keySpeed = panSpeed * 1.2;
      if (keysPressed.has("KeyW")   || keysPressed.has("ArrowUp"))    cameraY += keySpeed * dtSec;
      if (keysPressed.has("KeyS")   || keysPressed.has("ArrowDown"))  cameraY -= keySpeed * dtSec;
      if (keysPressed.has("KeyA")   || keysPressed.has("ArrowLeft"))  cameraX += keySpeed * dtSec;
      if (keysPressed.has("KeyD")   || keysPressed.has("ArrowRight")) cameraX -= keySpeed * dtSec;
    }

    if (enableEdgePan) {
      const dzX = w * 0.35;
      const dzY = h * 0.35;
      if (
        cursorX <  centerX - dzX ||
        cursorX >  centerX + dzX ||
        cursorY <  centerY - dzY ||
        cursorY >  centerY + dzY
      ) {
        let dx = (cursorX - centerX) / centerX;
        let dy = (cursorY - centerY) / centerY;
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }

        let fx = 0, fy = 0;
        if (cursorX <  centerX - dzX) fx = ((centerX - dzX) - cursorX) / (centerX - dzX);
        else if (cursorX > centerX + dzX) fx = (cursorX - (centerX + dzX)) / (centerX - dzX);
        if (cursorY <  centerY - dzY) fy = ((centerY - dzY) - cursorY) / (centerY - dzY);
        else if (cursorY > centerY + dzY) fy = (cursorY - (centerY + dzY)) / (centerY - dzY);

        const factor = Math.min(1, Math.max(fx, fy));
        const speed  = panSpeed * (1 + factor);

        cameraX -= dx * speed * dtSec;
        cameraY -= dy * speed * dtSec;
      }
    }
  }

  const now     = performance.now();
  const elapsed = (now - gameStartTime) / 1000;
  Icon.shakeFactor = 1 + Math.min(elapsed / START_TIME, 1) * 2;

  batteryPercent -= 2 * dtSec;
  const pct = Math.max(0, Math.min(100, Math.floor(batteryPercent)));
  if (pct !== lastPct && now >= blinkUntil) {
    lastPct = pct;
    updateHUD();
  }

  if (batteryPercent <= 0) {
    gameState = "game_over";
    if (currentPlayer) {
      currentPlayer.score = scoreTotal;
      addParticipantToXano(currentPlayer.wallet, scoreTotal);
    }
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
    playSound("end.wav", 0.5);
    updateUI();
    return;
  }

  ensureVisibleChunks(cameraX, cameraY, w, h);
}

function draw() {
  if (gameState !== "game") return;

  const now = performance.now();
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  drawCells(ctx, cameraX, cameraY, gameCanvas.width, gameCanvas.height, now);

  for (let i = missEvents.length - 1; i >= 0; i--) {
    const ev = missEvents[i];
    const ic = cells[ev.key];
    if (!ic || now - ev.time > 1000) {
      missEvents.splice(i, 1);
      continue;
    }
    const pos = ic.screenPosition(cameraX, cameraY, now);
    const S = 30;
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - (now - ev.time) / 1000);
    ctx.fillStyle = "red";
    ctx.fillRect(pos.x - S/2, pos.y - S/2, S, S);
    ctx.restore();
  }

  const w = gameCanvas.width, h = gameCanvas.height;
  ctx.save();
  const grad = ctx.createRadialGradient(
    cursorX, cursorY, 0,
    cursorX, cursorY, spotlightRadius
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

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
  try {
    update(now - last);
    draw();
  } catch (e) {
    console.error("Error in loop:", e);
  }
  last = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function updateUI() {
  const isGame = (gameState === "game");
  hud.style.display            = isGame ? "flex"   : "none";
  gameMenuButton.style.display = isGame ? "block"  : "none";
  fullscreenButton.style.display = (gameState === "menu") ? "block" : "none";

  if (gameState === "menu") {
    menuContainer.style.display     = "flex";
    loginContainer.style.display    = "none";
    summaryOverlay.style.display    = "none";
    gameCanvas.style.display        = "none";
    gameOverOverlay.style.display   = "none";
    recordsContainer.style.display  = "none";
  }
  else if (gameState === "game") {
    menuContainer.style.display     = "none";
    loginContainer.style.display    = "none";
    summaryOverlay.style.display    = "none";
    gameCanvas.style.display        = "block";
    gameOverOverlay.style.display   = "none";
    recordsContainer.style.display  = "none";
  }
  else if (gameState === "game_over") {
    menuContainer.style.display     = "none";
    loginContainer.style.display    = "none";
    summaryOverlay.style.display    = "none";
    gameCanvas.style.display        = "block";
    gameOverOverlay.style.display   = "block";
    recordsContainer.style.display  = "none";
    finalScore.textContent          = `Your score: ${scoreTotal} <img src="icons/key.svg" alt="Key" style="filter: invert(100%); vertical-align: middle; width: 24px; height: 24px;" />`;
  }
}

updateUI();
Icon._loadImages();
