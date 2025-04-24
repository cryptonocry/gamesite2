// main.js
import { addParticipantToXano, fetchAllParticipantsFromXano } from "./api.js";
import { 
  cells, generatedChunks,
  ensureVisibleChunks, drawCells,
  getClickedIcon
} from "./game.js";

// звуки
function playSound(name, vol=0.5) {
  const s = new Audio(name);
  s.volume = vol;
  s.play();
}

// html-элементы
const fullscreenButton = document.getElementById("fullscreenButton");
const loginContainer   = document.getElementById("loginContainer");
const walletInput      = document.getElementById("walletInput");
const loginOkButton    = document.getElementById("loginOkButton");
const loginCancelButton= document.getElementById("loginCancelButton");
const playWithoutWalletButton = document.getElementById("playWithoutWalletButton");

const summaryOverlay = document.getElementById("summaryOverlay");
const lastRecord     = document.getElementById("lastRecord");
const refCount       = document.getElementById("refCount");
const timeBonusEl    = document.getElementById("timeBonus");
const btnPlayNow     = document.getElementById("btnPlayNow");

const menuContainer = document.getElementById("menuContainer");
const btnStart      = document.getElementById("btnStart");
const btnRecords    = document.getElementById("btnRecords");
const btnBuy        = document.getElementById("btnBuy");

const gameCanvas   = document.getElementById("gameCanvas");
const ctx          = gameCanvas.getContext("2d");
const vignette     = document.getElementById("vignette");

const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScore      = document.getElementById("finalScore");
const btnMenuOver     = document.getElementById("btnMenu");
const btnRestartOver  = document.getElementById("btnRestart");

const recordsContainer      = document.getElementById("recordsContainer");
const recordsTableContainer = document.getElementById("recordsTableContainer");
const closeRecordsButton    = document.getElementById("closeRecordsButton");

// состояние
let gameState = "menu";
let currentPlayer = null; // { wallet, score, timeBonus }
const START_TIME = 60;
let timeLeft, scoreTotal;
let cameraX=0, cameraY=0, isDragging=false, dragStart, cameraStart;
let lastTime = performance.now();

// fullscreen
fullscreenButton.addEventListener("click", () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
});

// MENU
btnStart.addEventListener("click", () => {
  walletInput.value = "";
  loginContainer.style.display = "block";
});

btnRecords.addEventListener("click", () => {
  import("./ui.js").then(m => {
    m.showRecordsOverlay(recordsTableContainer, recordsContainer, currentPlayer);
  });
});

btnBuy.addEventListener("click", () => window.open("https://site.com","_blank"));

// LOGIN
loginOkButton.addEventListener("click", async () => {
  const w = walletInput.value.trim().toLowerCase();
  if (!w || w.length !== 62) return alert("Invalid wallet!");
  currentPlayer = { wallet: w, score: 0, timeBonus: 0 };
  loginContainer.style.display = "none";

  // получаем прежний рекорд и рефералов
  const all = await fetchAllParticipantsFromXano();
  const me  = all.find(r=>r.wallet===w) || { score:0, referals:0 };
  lastRecord.textContent = me.score;
  refCount.textContent    = me.referals;

  // рассчитываем бонус
  let b=0, n=me.referals;
  if (n>=1&&n<=3) b=5;
  if (n>=4&&n<=10) b=10;
  if (n>=11&&n<=30) b=15;
  if (n>=31&&n<=100) b=20;
  if (n>100) b=25;
  timeBonusEl.textContent  = b;
  currentPlayer.timeBonus = b;

  summaryOverlay.style.display = "block";
});

loginCancelButton.addEventListener("click", () => {
  loginContainer.style.display = "none";
});

playWithoutWalletButton.addEventListener("click", () => {
  currentPlayer = null;
  loginContainer.style.display = "none";
  startGame(0);
});

// PLAY NOW
btnPlayNow.addEventListener("click", () => {
  summaryOverlay.style.display = "none";
  startGame(currentPlayer ? currentPlayer.timeBonus : 0);
});

// GAME OVER
btnRestartOver.addEventListener("click", () => startGame(0));
btnMenuOver.addEventListener("click", () => {
  gameState="menu"; updateUI();
});

// RESIZE
function resize() {
  gameCanvas.width = window.innerWidth;
  gameCanvas.height= window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// CAMERA drag
gameCanvas.addEventListener("mousedown", e => {
  if (e.button===2) {
    isDragging=true;
    dragStart={x:e.clientX,y:e.clientY};
    cameraStart={x:cameraX,y:cameraY};
    playSound("move.wav",0.2);
  }
});
gameCanvas.addEventListener("mousemove", e => {
  if (isDragging) {
    cameraX = cameraStart.x + (e.clientX - dragStart.x);
    cameraY = cameraStart.y + (e.clientY - dragStart.y);
  }
});
gameCanvas.addEventListener("mouseup", e => {
  if (e.button===2) isDragging=false;
});
gameCanvas.addEventListener("contextmenu", e => e.preventDefault());

// CLICK collect
gameCanvas.addEventListener("click", e => {
  if (gameState!=="game") return;
  const rect = gameCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const key = getClickedIcon(mx, my, cameraX, cameraY);
  if (!key) return;
  const icon = cells[key];
  delete cells[key]; // убираем сразу
  if (icon.type==="key") {
    scoreTotal++;
    playSound("plus.wav",0.4);
  } else if (icon.type==="clock") {
    timeLeft+=10;
    playSound("time.wav",0.4);
  }
});

// game loop
function update(dt) {
  if (gameState==="game") {
    timeLeft -= dt/1000;
    if (timeLeft<=0) {
      gameState="game_over";
      if (currentPlayer) {
        currentPlayer.score = scoreTotal;
        addParticipantToXano(currentPlayer.wallet, scoreTotal);
      }
      playSound("end.wav",0.5);
      updateUI();
      return;
    }
    ensureVisibleChunks(cameraX, cameraY, gameCanvas.width, gameCanvas.height);

    // vignette
    if (timeLeft<=10) {
      vignette.style.display="block";
      vignette.style.opacity = `${1 - timeLeft/10}`;
    } else {
      vignette.style.display="none";
    }
  }
}

function draw() {
  if (gameState==="game") {
    ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);
    drawCells(ctx, cameraX, cameraY, gameCanvas.width, gameCanvas.height);

    // UI: score & timer
    ctx.save();
    ctx.font="24px Arial"; ctx.fillStyle="#33484f"; ctx.textAlign="left";
    ctx.fillText(`Score: ${scoreTotal}`, 15, 30);
    ctx.textAlign="center";
    ctx.fillText(`${Math.floor(timeLeft)} s`, gameCanvas.width/2, 30);
    ctx.restore();
  }
}

function loop() {
  const now = performance.now();
  const dt  = now - lastTime;
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// startGame
function startGame(bonusTime=0) {
  // reset
  cells = {};
  generatedChunks.clear();
  scoreTotal = 0;
  timeLeft   = START_TIME + bonusTime;
  cameraX = cameraY = 0;

  // предген нескольких чанков
  for (let cx=-1; cx<=2; cx++){
    for (let cy=-1; cy<=2; cy++){
      ensureVisibleChunks(0,0,gameCanvas.width,gameCanvas.height);
    }
  }

  playSound("start.wav",0.7);
  gameState="game";
  updateUI();
}

function updateUI(){
  if (gameState==="menu"){
    menuContainer.style.display="flex";
    gameCanvas.style.display="none";
    loginContainer.style.display=summaryOverlay.style.display=gameOverOverlay.style.display=recordsContainer.style.display="none";
    vignette.style.display="none";
    fullscreenButton.style.display=topNav.style.display="block";
  } else if (gameState==="game"){
    menuContainer.style.display=loginContainer.style.display=summaryOverlay.style.display=gameOverOverlay.style.display=recordsContainer.style.display="none";
    gameCanvas.style.display="block";
    topNav.style.display=fullscreenButton.style.display="none";
  } else if (gameState==="game_over"){
    menuContainer.style.display=loginContainer.style.display=summaryOverlay.style.display=recordsContainer.style.display="none";
    gameCanvas.style.display=gameOverOverlay.style.display="block";
    finalScore.textContent = `Your score: ${scoreTotal}`;
    topNav.style.display=fullscreenButton.style.display="none";
  }
}
updateUI();
