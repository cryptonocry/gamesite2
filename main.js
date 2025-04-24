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
  s.play().catch();
}

// HUD
const hud             = document.getElementById("hud");
const keyCountEl      = document.getElementById("keyCount");
const batteryIconEl   = document.getElementById("batteryIcon");
const batteryPctEl    = document.getElementById("batteryPercent");

// In-game menu UI
const fullscreenButton  = document.getElementById("fullscreenButton");
const gameMenuButton    = document.getElementById("gameMenuButton");
const inGameMenuOverlay = document.getElementById("inGameMenuOverlay");
const btnFullscreenIG   = document.getElementById("btnFullscreenIG");
const btnRestartIG      = document.getElementById("btnRestartIG");
const btnMainIG         = document.getElementById("btnMainIG");

// Меню и оверлеи
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

// Game state
let gameState      = "menu";
let currentPlayer  = null;
const START_TIME   = 50;
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

// FULLSCREEN
fullscreenButton.addEventListener("click", toggleFullscreen);
btnFullscreenIG   .addEventListener("click", ()=>{
  toggleFullscreen();
  inGameMenuOverlay.style.display = "none";
});
function toggleFullscreen(){
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

// IN-GAME MENU
gameMenuButton.addEventListener("click", ()=>{
  inGameMenuOverlay.style.display = "flex";
});
btnRestartIG.addEventListener("click", ()=>{
  inGameMenuOverlay.style.display = "none";
  startGame(0);
});
btnMainIG.addEventListener("click", ()=>{
  inGameMenuOverlay.style.display = "none";
  gameState = "menu";
  updateUI();
});

// START GAME BUTTON
btnStart.addEventListener("click", ()=>{
  loginContainer.style.display = "block";
});

// LOGIN FLOW
loginOkButton.addEventListener("click", async ()=>{
  const w = walletInput.value.trim().toLowerCase();
  if (!w || w.length !== 62) return alert("Invalid wallet!");
  currentPlayer = { wallet: w, score: 0 };
  loginContainer.style.display = "none";

  const all = await fetchAllParticipantsFromXano();
  const me  = all.find(r=>r.wallet===w) || { score:0, referals:0 };
  lastRecord.textContent = me.score;
  refCount.textContent    = me.referals;
  let b=0,n=me.referals;
  if (n>=1&&n<=3) b=5;
  else if (n<=10) b=10;
  else if (n<=30) b=15;
  else if (n<=100)b=20;
  else b=25;
  timeBonusEl.textContent = b;
  btnPlayNow.textContent = `PLAY (+${b}%)`;
  summaryOverlay.style.display = "flex";
});
loginCancelButton.addEventListener("click", ()=>{
  loginContainer.style.display = "none";
});
playWithoutWalletButton.addEventListener("click", ()=>{
  currentPlayer = null;
  loginContainer.style.display = "none";
  startGame(0);
});

// PLAY NOW
btnPlayNow.addEventListener("click", ()=>{
  summaryOverlay.style.display = "none";
  startGame(currentPlayer? parseInt(timeBonusEl.textContent):0);
});

// RECORDS
btnRecords.addEventListener("click", ()=>{
  showRecordsOverlay(recordsTableContainer, recordsContainer, currentPlayer);
});
closeRecordsButton.addEventListener("click", ()=>{
  recordsContainer.style.display = "none";
  gameState = "menu";
  updateUI();
});

// RESIZE CANVAS
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
function resizeCanvas(){
  gameCanvas.width = window.innerWidth;
  gameCanvas.height = window.innerHeight;
}

// CAMERA DRAG
gameCanvas.addEventListener("mousedown", e=>{
  if (e.button===2){
    isDragging=true;
    dragStart={x:e.clientX,y:e.clientY};
    cameraStart={x:cameraX,y:cameraY};
    playSound("move.wav",0.2);
  }
});
gameCanvas.addEventListener("mousemove", e=>{
  if (isDragging){
    cameraX = cameraStart.x + (e.clientX - dragStart.x);
    cameraY = cameraStart.y + (e.clientY - dragStart.y);
  }
});
gameCanvas.addEventListener("mouseup", e=>{
  if (e.button===2) isDragging = false;
});
gameCanvas.addEventListener("contextmenu", e=>e.preventDefault());

// CLICK TO COLLECT
gameCanvas.addEventListener("click", e=>{
  if (gameState!=="game") return;
  const r = gameCanvas.getBoundingClientRect();
  const mx=e.clientX-r.left, my=e.clientY-r.top;
  const key = getClickedIcon(mx,my,cameraX,cameraY);
  if (!key) return;
  const ic = cells[key];
  if (ic.removeStart) return;
  const now = performance.now();
  if (ic.type==="key"){
    ic.removeStart = now;
    scoreTotal++;
    playSound("plus.wav",0.4);
  } else if (ic.type==="clock"){
    ic.removeStart = now;
    playSound("time.wav",0.4);
    batteryIconEl.src = "icons/perplus.svg";
    setTimeout(updateHUD,500);
  } else {
    batteryPercent = Math.max(0,batteryPercent-6);
    missEvents.push({key,time:now});
    playSound("miss.wav",0.5);
  }
  updateHUD();
});

// UPDATE HUD
function updateHUD(){
  keyCountEl.textContent = scoreTotal;
  const pct = Math.max(0,Math.min(100,Math.floor(batteryPercent)));
  batteryPctEl.textContent = pct + "%";
  let icon="per0";
  if (pct>80) icon="per100";
  else if(pct>60) icon="per80";
  else if(pct>40) icon="per60";
  else if(pct>20) icon="per40";
  else if(pct>0) icon="per20";
  batteryIconEl.src = `icons/${icon}.svg`;
}

// START GAME
function startGame(bonus=0){
  Object.keys(cells).forEach(k=>delete cells[k]);
  generatedChunks.clear();
  scoreTotal=0;
  batteryPercent=100+bonus;
  missEvents=[];
  Icon.shakeFactor=1;
  cameraX=cameraY=0;
  gameStartTime=performance.now();
  playSound("start.wav",0.7);
  updateHUD();
  gameState="game";
  updateUI();
}

// UPDATE & DRAW
function update(dt){
  if (gameState!=="game") return;
  const now=performance.now();
  const elapsed=(now-gameStartTime)/1000;
  Icon.shakeFactor = 1 + Math.min(elapsed/START_TIME,1)*2;
  batteryPercent -= 2*(dt/1000);
  if (batteryPercent<=0){
    gameState="game_over";
    if (currentPlayer){
      currentPlayer.score=scoreTotal;
      addParticipantToXano(currentPlayer.wallet,scoreTotal);
    }
    playSound("end.wav",0.5);
    updateUI();
    return;
  }
  ensureVisibleChunks(cameraX,cameraY,gameCanvas.width,gameCanvas.height);
  updateHUD();
}

function draw(){
  if (gameState!=="game") return;
  ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);
  drawCells(ctx,cameraX,cameraY,gameCanvas.width,gameCanvas.height);
  const now=performance.now();
  for (let i=missEvents.length-1;i>=0;i--){
    const ev=missEvents[i];
    const ic=cells[ev.key];
    if (!ic||now-ev.time>1000){ missEvents.splice(i,1); continue; }
    const pos=ic.screenPosition(cameraX,cameraY,now);
    const S=30;
    ctx.save();
      ctx.globalAlpha=0.5*(1-(now-ev.time)/1000);
      ctx.fillStyle="red";
      ctx.fillRect(pos.x-S/2,pos.y-S/2,S,S);
    ctx.restore();
  }
  const w=gameCanvas.width,h=gameCanvas.height;
  ctx.save();
    const grad=ctx.createRadialGradient(
      cursorX,cursorY,0,
      cursorX,cursorY,spotlightRadius
    );
    grad.addColorStop(0,"rgba(0,0,0,0)");
    grad.addColorStop(1,"rgba(0,0,0,1)");
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,w,h);
  ctx.restore();
  if (batteryPercent<=20){
    const alpha=1-(batteryPercent/20);
    ctx.save();
      ctx.fillStyle=`rgba(0,0,0,${alpha})`;
      ctx.fillRect(0,0,w,h);
    ctx.restore();
  }
}

let last=performance.now();
function loop(){
  const now=performance.now();
  update(now-last);
  draw();
  last=now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// SHOW/HIDE UI
function updateUI(){
  const isGame = gameState==="game";
  hud.style.display            = isGame?"flex":"none";
  gameMenuButton.style.display = isGame?"block":"none";
  fullscreenButton.style.display = (gameState==="menu")?"block":"none";

  if (gameState==="menu"){
    menuContainer.style.display     ="flex";
    loginContainer.style.display    ="none";
    summaryOverlay.style.display    ="none";
    gameCanvas.style.display        ="none";
    gameOverOverlay.style.display   ="none";
    recordsContainer.style.display  ="none";
  }
  else if(gameState==="game"){
    menuContainer.style.display     ="none";
    loginContainer.style.display    ="none";
    summaryOverlay.style.display    ="none";
    gameCanvas.style.display        ="block";
    gameOverOverlay.style.display   ="none";
    recordsContainer.style.display  ="none";
  }
  else if(gameState==="game_over"){
    menuContainer.style.display     ="none";
    loginContainer.style.display    ="none";
    summaryOverlay.style.display    ="none";
    gameCanvas.style.display        ="block";
    gameOverOverlay.style.display   ="block";
    recordsContainer.style.display  ="none";
    finalScore.textContent          =`Your score: ${scoreTotal}`;
  }
}

// Инициализация
updateUI();
