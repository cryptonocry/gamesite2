// main.js
import { addParticipantToXano, fetchAllParticipantsFromXano } from "./api.js";
import { showRecordsOverlay } from "./ui.js";
import { Icon } from "./digit.js";
import {
  cells, generatedChunks,
  ensureVisibleChunks, drawCells,
  getClickedIcon
} from "./game.js";

// — звуки
function playSound(src, vol=0.5) {
  const s = new Audio(src); s.volume = vol; s.play().catch();
}

// HUD
const keyCountEl    = document.getElementById("keyCount");
const batteryIconEl = document.getElementById("batteryIcon");
const batteryPctEl  = document.getElementById("batteryPercent");

// UI
const fullscreenButton    = document.getElementById("fullscreenButton");
const gameMenuButton      = document.getElementById("gameMenuButton");
const inGameMenuOverlay   = document.getElementById("inGameMenuOverlay");
const btnFullscreenIG     = document.getElementById("btnFullscreenIG");
const btnRestartIG        = document.getElementById("btnRestartIG");
const btnMainIG           = document.getElementById("btnMainIG");

// остальные элементы (login, menu, canvas, overlays) — как у вас было
// …

// Game state
let gameState      = "menu";
let currentPlayer  = null;
const START_TIME   = 50;     // 50s при –2%/с
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

// Обработчики fullscreen (верхняя кнопка и в-игре)
fullscreenButton.addEventListener("click", toggleFullscreen);
btnFullscreenIG .addEventListener("click", ()=>{
  toggleFullscreen();
  inGameMenuOverlay.style.display = "none";
});

function toggleFullscreen(){
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

// Кнопка MENU во время игры
gameMenuButton.addEventListener("click", ()=>{
  inGameMenuOverlay.style.display = "flex";
});

// In-Game Menu: RESTART
btnRestartIG.addEventListener("click", ()=>{
  inGameMenuOverlay.style.display = "none";
  startGame(0);
});

// In-Game Menu: MAIN PAGE
btnMainIG.addEventListener("click", ()=>{
  inGameMenuOverlay.style.display = "none";
  gameState = "menu";
  updateUI();
});

// … остальной код login, menu, records …

// Обновление HUD
function updateHUD(){
  keyCountEl.textContent = scoreTotal;
  const pct = Math.max(0, Math.min(100, Math.floor(batteryPercent)));
  batteryPctEl.textContent = pct + "%";
  let iconName = "per0";
  if (pct > 80) iconName = "per100";
  else if (pct > 60) iconName = "per80";
  else if (pct > 40) iconName = "per60";
  else if (pct > 20) iconName = "per40";
  else if (pct > 0) iconName = "per20";
  batteryIconEl.src = `icons/${iconName}.svg`;
}

// Запуск игры
function startGame(bonus=0){
  Object.keys(cells).forEach(k=>delete cells[k]);
  generatedChunks.clear();
  scoreTotal = 0;
  batteryPercent = 100 + bonus;
  missEvents = [];
  Icon.shakeFactor = 1;
  cameraX = cameraY = 0;
  gameStartTime = performance.now();
  playSound("start.wav",0.7);
  updateHUD();
  gameState = "game";
  updateUI();
}

// Главный цикл обновления
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

function draw(){
  if (gameState !== "game") return;
  ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);
  drawCells(ctx,cameraX,cameraY,gameCanvas.width,gameCanvas.height);

  // промахи...
  const now = performance.now();
  for (let i = missEvents.length-1; i>=0; i--){
    const ev = missEvents[i];
    const ic = cells[ev.key];
    if (!ic || now-ev.time>1000) { missEvents.splice(i,1); continue; }
    const pos = ic.screenPosition(cameraX,cameraY,now);
    const SIZE=30;
    ctx.save();
      ctx.globalAlpha = 0.5*(1-(now-ev.time)/1000);
      ctx.fillStyle = "red";
      ctx.fillRect(pos.x-SIZE/2,pos.y-SIZE/2,SIZE,SIZE);
    ctx.restore();
  }

  // фонарик
  const w=gameCanvas.width,h=gameCanvas.height;
  ctx.save();
    const grad = ctx.createRadialGradient(
      cursorX,cursorY,0,
      cursorX,cursorY,spotlightRadius
    );
    grad.addColorStop(0,"rgba(0,0,0,0)");
    grad.addColorStop(1,"rgba(0,0,0,1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);
  ctx.restore();

  // последние 10s — затемнение
  if (batteryPercent <= 20){
    const alpha = 1 - (batteryPercent/20);
    ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0,0,w,h);
    ctx.restore();
  }
}

// Цикл
let last = performance.now();
function loop(){
  const now = performance.now();
  update(now-last);
  draw();
  last = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Обновление видимости UI
function updateUI(){
  const showGameMenu = gameState === "game";
  gameMenuButton.style.display = showGameMenu ? "block" : "none";
  inGameMenuOverlay.style.display = "none";

  if (gameState === "menu"){
    menuContainer.style.display    = "flex";
    loginContainer.style.display   =
    summaryOverlay.style.display   =
    gameCanvas.style.display       =
    gameOverOverlay.style.display  =
    recordsContainer.style.display = "none";
    topNav.style.display           = "flex";
    fullscreenButton.style.display = "block";
  }
  else if (gameState === "game"){
    menuContainer.style.display    =
    loginContainer.style.display   =
    summaryOverlay.style.display   =
    gameOverOverlay.style.display  =
    recordsContainer.style.display = "none";
    gameCanvas.style.display       = "block";
    topNav.style.display           =
    fullscreenButton.style.display = "none";
  }
  else if (gameState === "game_over"){
    menuContainer.style.display    =
    loginContainer.style.display   =
    summaryOverlay.style.display   =
    recordsContainer.style.display = "none";
    gameCanvas.style.display       =
    gameOverOverlay.style.display  = "block";
    finalScore.textContent         = `Your score: ${scoreTotal}`;
    topNav.style.display           =
    fullscreenButton.style.display = "none";
  }
}

// стартовое состояние
updateUI();
