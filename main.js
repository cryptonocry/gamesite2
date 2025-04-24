// main.js
import { addParticipantToXano, fetchAllParticipantsFromXano } from "./api.js";
import { showRecordsOverlay } from "./ui.js";
import { Icon } from "./digit.js";
import {
  cells, generatedChunks,
  ensureVisibleChunks, drawCells,
  getClickedIcon
} from "./game.js";

// Sounds
function playSound(src, vol = 0.5) {
  const s = new Audio(src);
  s.volume = vol;
  s.play().catch();
}

// HUD elements
const keyCountEl    = document.getElementById("keyCount");
const batteryIconEl = document.getElementById("batteryIcon");
const batteryPctEl  = document.getElementById("batteryPercent");

// Other DOM refs (fullscreen, login, menu, overlays) — as in previous versions
const fullscreenButton       = document.getElementById("fullscreenButton");
const topNav                 = document.getElementById("topNav");
const loginContainer         = document.getElementById("loginContainer");
const walletInput            = document.getElementById("walletInput");
const loginOkButton          = document.getElementById("loginOkButton");
const loginCancelButton      = document.getElementById("loginCancelButton");
const playWithoutWalletButton= document.getElementById("playWithoutWalletButton");

const summaryOverlay         = document.getElementById("summaryOverlay");
const lastRecord             = document.getElementById("lastRecord");
const refCount               = document.getElementById("refCount");
const timeBonusEl            = document.getElementById("timeBonus");
const btnPlayNow             = document.getElementById("btnPlayNow");

const menuContainer          = document.getElementById("menuContainer");
const btnStart               = document.getElementById("btnStart");
const btnRecords             = document.getElementById("btnRecords");
const btnBuy                 = document.getElementById("btnBuy");

const gameCanvas             = document.getElementById("gameCanvas");
const ctx                    = gameCanvas.getContext("2d");

const gameOverOverlay        = document.getElementById("gameOverOverlay");
const finalScore             = document.getElementById("finalScore");
const btnMenuOver            = document.getElementById("btnMenu");
const btnRestartOver         = document.getElementById("btnRestart");

const recordsContainer       = document.getElementById("recordsContainer");
const recordsTableContainer  = document.getElementById("recordsTableContainer");
const closeRecordsButton     = document.getElementById("closeRecordsButton");

const errorOverlay           = document.getElementById("errorOverlay");

// Game state
let gameState      = "menu";
let currentPlayer  = null;
const START_TIME   = 50;  // 50s at 2% per sec
let batteryPercent = 100;
let scoreTotal     = 0;
let cameraX = 0, cameraY = 0;
let isDragging = false, dragStart, cameraStart;
let lastFrame = performance.now();
let missEvents = [];
let gameStartTime = 0;

// Spotlight
let cursorX = 0, cursorY = 0;
const spotlightRadius = 500;
gameCanvas.addEventListener("mousemove", e => {
  const r = gameCanvas.getBoundingClientRect();
  cursorX = e.clientX - r.left;
  cursorY = e.clientY - r.top;
});

// Update HUD
function updateHUD(){
  keyCountEl.textContent = scoreTotal;
  const pct = Math.max(0, Math.min(100, Math.floor(batteryPercent)));
  batteryPctEl.textContent = pct + "%";
  let iconName = "per0";
  if      (pct > 80) iconName = "per100";
  else if (pct > 60) iconName = "per80";
  else if (pct > 40) iconName = "per60";
  else if (pct > 20) iconName = "per40";
  else if (pct > 0)  iconName = "per20";
  batteryIconEl.src = `icons/${iconName}.svg`;
}

// Start game
function startGame(bonus = 0){
  Object.keys(cells).forEach(k=>delete cells[k]);
  generatedChunks.clear();
  scoreTotal     = 0;
  batteryPercent = 100;
  missEvents     = [];
  Icon.shakeFactor = 1;
  cameraX = cameraY = 0;
  gameStartTime = performance.now();
  playSound("start.wav", 0.7);
  updateHUD();
  gameState = "game";
  updateUI();
}

// Click handler
gameCanvas.addEventListener("click", e=>{
  if (gameState !== "game") return;
  const rect = gameCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const key = getClickedIcon(mx, my, cameraX, cameraY);
  if (!key) return;
  const ic = cells[key];
  if (ic.removeStart) return;
  const now = performance.now();

  if (ic.type === "key") {
    ic.removeStart = now;
    scoreTotal++;
    playSound("plus.wav",0.4);
  }
  else if (ic.type === "clock") {
    ic.removeStart = now;
    playSound("time.wav",0.4);
    batteryIconEl.src = "icons/perplus.svg";
    setTimeout(updateHUD, 500);
  }
  else {
    batteryPercent = Math.max(0, batteryPercent - 6);
    missEvents.push({ key, time: now });
    playSound("miss.wav",0.5);
  }
  updateHUD();
});

// Update loop
function update(dt){
  if (gameState !== "game") return;
  const now = performance.now();
  const elapsed = (now - gameStartTime)/1000;
  Icon.shakeFactor = 1 + Math.min(elapsed/START_TIME,1)*2;

  batteryPercent -= 2 * (dt/1000);
  if (batteryPercent <= 0) {
    gameState = "game_over";
    if (currentPlayer) {
      currentPlayer.score = scoreTotal;
      addParticipantToXano(currentPlayer.wallet, scoreTotal);
    }
    playSound("end.wav",0.5);
    updateUI();
    return;
  }
  ensureVisibleChunks(cameraX, cameraY, gameCanvas.width, gameCanvas.height);
  updateHUD();
}

// Draw loop
function draw(){
  if (gameState !== "game") return;
  ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);

  drawCells(ctx,cameraX,cameraY,gameCanvas.width,gameCanvas.height);

  // miss flashes
  const now = performance.now();
  for (let i = missEvents.length-1; i>=0; i--) {
    const ev = missEvents[i];
    const ic = cells[ev.key];
    if (!ic || now-ev.time>1000) { missEvents.splice(i,1); continue; }
    const pos = ic.screenPosition(cameraX,cameraY,now);
    const SIZE = 30;
    ctx.save();
    ctx.globalAlpha = 0.5*(1 - (now-ev.time)/1000);
    ctx.fillStyle = "red";
    ctx.fillRect(pos.x-SIZE/2, pos.y-SIZE/2, SIZE, SIZE);
    ctx.restore();
  }

  // flashlight gradient
  const w = gameCanvas.width, h = gameCanvas.height;
  ctx.save();
    const grad = ctx.createRadialGradient(
      cursorX, cursorY, 0,
      cursorX, cursorY, spotlightRadius
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);
  ctx.restore();

  // battery dying fade last 10s
  if (batteryPercent <= 20) {
    const alpha = 1 - (batteryPercent/20);
    ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0,0,w,h);
    ctx.restore();
  }
}

// Main loop
function loop(){
  const now = performance.now();
  const dt = now - lastFrame;
  lastFrame = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ... resize, menu/login/records/game-over handlers unchanged ...
