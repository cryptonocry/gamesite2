// main.js
import { addParticipantToXano, fetchAllParticipantsFromXano } from "./api.js";
import { showRecordsOverlay } from "./ui.js";
import { Icon } from "./digit.js";
import {
  cells, generatedChunks,
  ensureVisibleChunks, drawCells,
  getClickedIcon
} from "./game.js";

function playSound(src, vol=0.5) {
  const s = new Audio(src);
  s.volume = vol;
  s.play().catch(e=>console.error(e));
}

// HTML elements
const fullscreenButton = document.getElementById("fullscreenButton");
const topNav           = document.getElementById("topNav");
const loginContainer   = document.getElementById("loginContainer");
const walletInput      = document.getElementById("walletInput");
const loginOkButton    = document.getElementById("loginOkButton");
const loginCancelButton= document.getElementById("loginCancelButton");
const playWithoutWalletButton = document.getElementById("playWithoutWalletButton");

const summaryOverlay   = document.getElementById("summaryOverlay");
const lastRecord       = document.getElementById("lastRecord");
const refCount         = document.getElementById("refCount");
const timeBonusEl      = document.getElementById("timeBonus");
const btnPlayNow       = document.getElementById("btnPlayNow");

const menuContainer    = document.getElementById("menuContainer");
const btnStart         = document.getElementById("btnStart");
const btnRecords       = document.getElementById("btnRecords");
const btnBuy           = document.getElementById("btnBuy");

const gameCanvas       = document.getElementById("gameCanvas");
const ctx              = gameCanvas.getContext("2d");

const gameOverOverlay  = document.getElementById("gameOverOverlay");
const finalScore       = document.getElementById("finalScore");
const btnMenuOver      = document.getElementById("btnMenu");
const btnRestartOver   = document.getElementById("btnRestart");

const recordsContainer      = document.getElementById("recordsContainer");
const recordsTableContainer = document.getElementById("recordsTableContainer");
const closeRecordsButton    = document.getElementById("closeRecordsButton");

const errorOverlay    = document.getElementById("errorOverlay");

// Game state
let gameState      = "menu";
let currentPlayer  = null;
const START_TIME   = 60;
let timeLeft       = 0;
let scoreTotal     = 0;
let cameraX = 0, cameraY = 0;
let isDragging = false, dragStart, cameraStart;
let lastTime   = performance.now();
let missEvents  = [];
let gameStartTime = 0;

// Spotlight
let cursorX = 0, cursorY = 0;
const spotlightRadius = 500; // увеличен в 2 раза
gameCanvas.addEventListener("mousemove", e => {
  const r = gameCanvas.getBoundingClientRect();
  cursorX = e.clientX - r.left;
  cursorY = e.clientY - r.top;
});

// Error handling
window.onerror = (msg,url,line,col,err) => {
  errorOverlay.style.display = "block";
  errorOverlay.textContent = `Error: ${msg} at ${line}:${col}`;
  return true;
};
window.onunhandledrejection = ev => {
  errorOverlay.style.display = "block";
  errorOverlay.textContent = `Promise rejection: ${ev.reason}`;
  return true;
};

// Fullscreen toggle
fullscreenButton.addEventListener("click", ()=>{
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
});

// Menu
btnStart.addEventListener("click", ()=>{
  walletInput.value = "";
  loginContainer.style.display = "block";
});
btnRecords.addEventListener("click", ()=>{
  showRecordsOverlay(recordsTableContainer, recordsContainer, currentPlayer);
});
btnBuy.addEventListener("click", ()=> window.open("https://site.com","_blank"));

// Login flow
loginOkButton.addEventListener("click", async ()=>{
  const w = walletInput.value.trim().toLowerCase();
  if (!w || w.length !== 62) return alert("Invalid wallet!");
  currentPlayer = { wallet: w, score: 0, timeBonus: 0 };
  loginContainer.style.display = "none";

  const all = await fetchAllParticipantsFromXano();
  const me  = all.find(r=>r.wallet===w) || { score:0, referals:0 };
  lastRecord.textContent = me.score;
  refCount.textContent    = me.referals;

  let b = 0, n = me.referals;
  if (n>=1&&n<=3)   b = 5;
  if (n>=4&&n<=10)  b = 10;
  if (n>=11&&n<=30) b = 15;
  if (n>=31&&n<=100)b = 20;
  if (n>100)        b = 25;
  timeBonusEl.textContent = b;
  currentPlayer.timeBonus = b;

  summaryOverlay.style.display = "block";
});
loginCancelButton.addEventListener("click", ()=>{
  loginContainer.style.display = "none";
});
playWithoutWalletButton.addEventListener("click", ()=>{
  currentPlayer = null;
  loginContainer.style.display = "none";
  startGame(0);
});

// Play now
btnPlayNow.addEventListener("click", ()=>{
  summaryOverlay.style.display = "none";
  startGame(currentPlayer ? currentPlayer.timeBonus : 0);
});

// Game over
btnRestartOver.addEventListener("click", ()=> startGame(0));
btnMenuOver.addEventListener("click", ()=>{
  gameState = "menu"; updateUI();
});

// Close records
closeRecordsButton.addEventListener("click", ()=>{
  recordsContainer.style.display = "none";
  gameState = "menu"; updateUI();
});

// Resize
function resize(){
  gameCanvas.width = innerWidth;
  gameCanvas.height= innerHeight;
}
window.addEventListener("resize", resize);
resize();

// Camera drag
gameCanvas.addEventListener("mousedown", e=>{
  if (e.button === 2) {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    cameraStart = { x: cameraX, y: cameraY };
    playSound("move.wav", 0.2);
  }
});
gameCanvas.addEventListener("mousemove", e=>{
  if (isDragging) {
    cameraX = cameraStart.x + (e.clientX - dragStart.x);
    cameraY = cameraStart.y + (e.clientY - dragStart.y);
  }
});
gameCanvas.addEventListener("mouseup", e=>{
  if (e.button === 2) isDragging = false;
});
gameCanvas.addEventListener("contextmenu", e=> e.preventDefault());

// Click handling
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
    playSound("plus.wav", 0.4);
  }
  else if (ic.type === "clock") {
    ic.removeStart = now;
    timeLeft += 10;
    playSound("time.wav", 0.4);
  }
  else {
    timeLeft = Math.max(0, timeLeft - 3);
    missEvents.push({ key, time: now });
    playSound("miss.wav", 0.5);
  }
});

// Update & Draw
function update(dt){
  if (gameState === "game") {
    const now = performance.now();
    const elapsed = (now - gameStartTime)/1000;
    const frac = Math.min(elapsed/START_TIME, 1);
    Icon.shakeFactor = 1 + frac*2;

    timeLeft -= dt/1000;
    if (timeLeft <= 0) {
      gameState = "game_over";
      if (currentPlayer) {
        currentPlayer.score = scoreTotal;
        addParticipantToXano(currentPlayer.wallet, scoreTotal);
      }
      playSound("end.wav", 0.5);
      updateUI();
      return;
    }
    ensureVisibleChunks(cameraX, cameraY, gameCanvas.width, gameCanvas.height);
  }
}

function draw(){
  if (gameState === "game") {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // 1) Иконки + fade
    drawCells(ctx, cameraX, cameraY, gameCanvas.width, gameCanvas.height);

    // 2) Штрафные вспышки
    const now = performance.now();
    for (let i = missEvents.length - 1; i >= 0; i--) {
      const ev = missEvents[i];
      const ic = cells[ev.key];
      if (!ic || now - ev.time > 1000) {
        missEvents.splice(i,1);
        continue;
      }
      const pos = ic.screenPosition(cameraX, cameraY, now);
      const SIZE = 30;
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - (now-ev.time)/1000);
      ctx.fillStyle = "red";
      ctx.fillRect(pos.x - SIZE/2, pos.y - SIZE/2, SIZE, SIZE);
      ctx.restore();
    }

    // 3) Градиентный фонарик (source-over)
    const w = gameCanvas.width, h = gameCanvas.height;
    ctx.save();
      const grad = ctx.createRadialGradient(
        cursorX, cursorY, 0,
        cursorX, cursorY, spotlightRadius
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");    // центр — прозрачный
      grad.addColorStop(1, "rgba(0,0,0,1)");    // край — чёрный
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // 4) Батарейка: затемнение экрана 10→0 с
    if (timeLeft <= 10) {
      ctx.save();
      const alpha = 1 - (timeLeft / 10);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 5) UI
    ctx.save();
      ctx.font="24px Arial"; ctx.fillStyle="#33484f"; ctx.textAlign="left";
      ctx.fillText(`Score: ${scoreTotal}`,15,32);
      ctx.textAlign="center";
      ctx.fillText(`${Math.floor(timeLeft)} s`,w/2,32);
    ctx.restore();
  }
}

function loop(){
  const now = performance.now();
  const dt = now - lastTime;
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function startGame(bonus=0){
  Object.keys(cells).forEach(k=>delete cells[k]);
  generatedChunks.clear();
  scoreTotal   = 0;
  timeLeft     = START_TIME + bonus;
  missEvents   = [];
  Icon.shakeFactor = 1;
  cameraX = cameraY = 0;
  gameStartTime = performance.now();
  playSound("start.wav", 0.7);
  gameState = "game";
  updateUI();
}

function updateUI(){
  if (gameState === "menu") {
    menuContainer.style.display = "flex";
    gameCanvas.style.display    = "none";
    loginContainer.style.display =
    summaryOverlay.style.display =
    gameOverOverlay.style.display =
    recordsContainer.style.display = "none";
    topNav.style.display =
    fullscreenButton.style.display = "block";
  } else if (gameState === "game") {
    menuContainer.style.display =
    loginContainer.style.display =
    summaryOverlay.style.display =
    gameOverOverlay.style.display =
    recordsContainer.style.display = "none";
    gameCanvas.style.display = "block";
    topNav.style.display =
    fullscreenButton.style.display = "none";
  } else if (gameState === "game_over") {
    menuContainer.style.display =
    loginContainer.style.display =
    summaryOverlay.style.display =
    recordsContainer.style.display = "none";
    gameCanvas.style.display =
    gameOverOverlay.style.display = "block";
    finalScore.textContent = `Your score: ${scoreTotal}`;
    topNav.style.display =
    fullscreenButton.style.display = "none";
  }
}
updateUI();
