
/* ===== ui.clean.js ===== */

import { fetchAllParticipantsFromXano } from "./api.js";

export async function showRecordsOverlay(recordsTableContainer, recordsContainer, currentPlayer) {

  recordsContainer.style.display = "block";
  recordsTableContainer.innerHTML = `
    <div class="loader"></div>
    <div class="loaderText">Loading leaderboard…</div>
  `;

  const records = await fetchAllParticipantsFromXano();
  if (!records || records.length === 0) {
    recordsTableContainer.innerHTML = "No records found.";
    recordsContainer.style.display = "block";
    return;
  }
  records.sort((a, b) => b.score - a.score);
  let html = "<table><tr><th>#</th><th>Wallet</th><th>Score</th></tr>";
  records.forEach((rec, i) => {
    const rank = i + 1;
    const highlight = currentPlayer && rec.wallet === currentPlayer.wallet
      ? "id='currentPlayerRow'" : "";
    html += `
      <tr ${highlight}>
        <td>${rank}</td>
        <td>${rec.wallet}</td>
        <td>${rec.score}</td>
      </tr>
    `;
  });
  html += "</table>";
  recordsTableContainer.innerHTML = html;
  recordsContainer.style.display = "block";
  setTimeout(() => {
    const row = document.getElementById("currentPlayerRow");
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
}
/* ===== api.clean.js ===== */


const BASE = "https://x8ki-letl-twmt.n7.xano.io/api:7fuLzq6k";

const XANO_GET_URL    = `${BASE}/gamerecords_get`;

const XANO_START_URL  = `${BASE}/start`;
const XANO_SUBMIT_URL = `${BASE}/gamerecords_post`;

export async function fetchAllParticipantsFromXano() {
  try {
    const resp = await fetch(XANO_GET_URL);
    return await resp.json();
  } catch (e) {
    console.error("Error fetching data from Xano:", e);
    return [];
  }
}

export async function startSession(wallet) {
  try {
    const resp = await fetch(XANO_START_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: wallet || null })
    });
    if (!resp.ok) throw new Error("start failed");
    const data = await resp.json();

    return {
      sessionId: data.id,
      token: data.token,
      createdAt: data.created_at,
      issuedAt: data.issued_at,
      used: data.used,
      wallet: data.wallet,
      ip: data.ip
    };
  } catch (e) {
    console.error("startSession error:", e);
    return null;
  }
}

export async function submitScore(session, score, wallet) {
  try {

    const resp = await fetch(XANO_SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: session?.token,
        wallet: wallet || null,
        score
      })
    });

    let data;
    try { data = await resp.json(); } catch { data = await resp.text(); }

    if (!resp.ok) {
      console.error("submitScore failed:", data);
      return null;
    }
    return data;
  } catch (e) {
    console.error("submitScore error:", e);
    return null;
  }
}
/* ===== digit.clean.js ===== */
export class Icon {
  static shakeFactor = 1;

  constructor(gx, gy, type, spawnTime) {
    this.gx = gx;
    this.gy = gy;
    this.type = type;
    this.spawnTime = spawnTime;
    this.phaseOffset = Math.random() * Math.PI * 2;
    const baseAmp = 3, baseSpd = 0.5;
    this.baseAmplitude = baseAmp * 1.5;
    this.baseSpeed = baseSpd * 1.2;
    if (!Icon.images) Icon._loadImages();
  }

  static _loadImages() {
    Icon.images = {};
    [
      "mask", "letterS", "cd", "xicon",
      "clock", "key", "ethicon", "btcicon",
      "eye", "lock", "scroll", "dna", "flask",
      "per0", "per20", "per40", "per60", "per80", "per100", "perplus"
    ].forEach(name => {
      const img = new Image();
      img.src = `icons/${name}.svg`;
      Icon.images[name] = img;
    });
  }

  screenPosition(camX, camY, now) {
    const CELL = 80;
    const baseX = this.gx * CELL + camX;
    const baseY = this.gy * CELL + camY;
    const dt = (now - this.spawnTime) / 1000;
    const amp = this.baseAmplitude * Icon.shakeFactor;
    const dx = amp * Math.cos(this.baseSpeed * dt + this.phaseOffset);
    const dy = amp * Math.sin(this.baseSpeed * dt + this.phaseOffset);
    return { x: baseX + dx, y: baseY + dy };
  }

  draw(ctx, camX, camY, now, alpha = 1) {
    const pos = this.screenPosition(camX, camY, now);
    const img = Icon.images[this.type];
    if (!img || !img.complete) return;
    const SIZE = 30;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, pos.x - SIZE / 2, pos.y - SIZE / 2, SIZE, SIZE);
    // Наложение белого цвета для всех иконок в игре
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(pos.x - SIZE / 2, pos.y - SIZE / 2, SIZE, SIZE);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}
/* ===== game.clean.js ===== */
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
/* ===== main.clean.js ===== */
import { fetchAllParticipantsFromXano, startSession, submitScore } from "./api.js";
import { showRecordsOverlay } from "./ui.js";
import { Icon } from "./digit.js";
import {
  cells, generatedChunks,
  ensureVisibleChunks, drawCells,
  getClickedIcon
} from "./game.js";

function playSound(src, vol = 0.5) {
  const s = new Audio(src);
  s.volume = vol;
  s.play().catch(e => console.error("Sound playback failed:", e));
}

let backgroundMusic = new Audio("music.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.3;

function preloadAudio() {
  backgroundMusic.load();
}
preloadAudio();

const FX = {
  particles: [],
  ripples: [],
  trails: [],
  flashAlpha: 0,
  flashColor: [255, 204, 0],
};

const rand = (a, b) => a + Math.random() * (b - a);

function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const ang = rand(0, Math.PI * 2);
    const spd = rand(90, 220);
    FX.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: rand(300, 600),
      age: 0,
      size: rand(2, 4),
      color,
      alpha: 1
    });
  }
}

function spawnRipple(x, y, color) {
  FX.ripples.push({
    x, y,
    r: 0,
    maxR: 120,
    life: 400,
    age: 0,
    alpha: 1,
    color
  });
}

function spawnTrail(x, y, img, copies = 3) {
  const now = performance.now();
  for (let i = 0; i < copies; i++) {
    FX.trails.push({
      x, y,
      img,
      start: now + i * 20,
      life: 220,
      alpha: 1,
      scale: 1,
    });
  }
}

function bump(el, cls = "bump", dur = 220) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), dur + 30);
}

function pulse(el) { bump(el, "pulse", 260); }

function spawnPickupEffects(type, x, y) {
  if (type === "key") {
    const col = [255, 250, 200];
    spawnParticles(x, y, 18, col);
    spawnRipple(x, y, col);
    FX.flashColor = col;
    FX.flashAlpha = Math.min(0.1, FX.flashAlpha + 0.18);
    bump(keyCountEl);
  } else if (type === "clock") {
    const col = [120, 220, 255];
    spawnParticles(x, y, 16, col);
    spawnRipple(x, y, col);
    FX.flashColor = col;
    FX.flashAlpha = Math.min(0.1, FX.flashAlpha + 0.16);
    pulse(batteryIconEl);
  }
}

const hud           = document.getElementById("hud");
const keyCountEl    = document.getElementById("keyCount");
const batteryIconEl = document.getElementById("batteryIcon");
const batteryPctEl  = document.getElementById("batteryPercent");
const plusTextEl    = document.getElementById("plusText");

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

const btnCloseMenuIcon = document.getElementById("btnCloseMenuIcon");
if (btnCloseMenuIcon) {
  btnCloseMenuIcon.addEventListener("click", () => {
    inGameMenuOverlay.style.display = "none";
  });
}

let enableEdgePan      = true;
let enableKeyboardPan  = true;
let enableRightDragPan = true;

const cbEdgePan      = document.getElementById("cbEdgePan");
const cbKeyboardPan  = document.getElementById("cbKeyboardPan");
const cbRightDragPan = document.getElementById("cbRightDragPan");
const cbEdgePanMain  = document.getElementById("cbEdgePanMain");
const cbKeyboardPanMain  = document.getElementById("cbKeyboardPanMain");
const cbRightDragPanMain = document.getElementById("cbRightDragPanMain");

if (cbEdgePan) cbEdgePan.addEventListener("change", () => { enableEdgePan = cbEdgePan.checked; });
if (cbKeyboardPan) cbKeyboardPan.addEventListener("change", () => { enableKeyboardPan = cbKeyboardPan.checked; });
if (cbRightDragPan) { cbRightDragPan.checked = true; cbRightDragPan.disabled = true; }
if (cbEdgePanMain) cbEdgePanMain.addEventListener("change", () => { enableEdgePan = cbEdgePanMain.checked; });
if (cbKeyboardPanMain) cbKeyboardPanMain.addEventListener("change", () => { enableKeyboardPan = cbKeyboardPanMain.checked; });
if (cbRightDragPanMain) { cbRightDragPanMain.checked = true; cbRightDragPanMain.disabled = true; }

function syncAllCheckboxes() {
  if (cbEdgePan) cbEdgePan.checked = enableEdgePan;
  if (cbKeyboardPan) cbKeyboardPan.checked = enableKeyboardPan;
  if (cbRightDragPan) { cbRightDragPan.checked = true; cbRightDragPan.disabled = true; }
  if (cbEdgePanMain) cbEdgePanMain.checked = enableEdgePan;
  if (cbKeyboardPanMain) cbKeyboardPanMain.checked = enableKeyboardPan;
  if (cbRightDragPanMain) { cbRightDragPanMain.checked = true; cbRightDragPanMain.disabled = true; }
}

function syncMainMenuSettings() {
  if (cbEdgePanMain) cbEdgePanMain.checked = enableEdgePan;
  if (cbKeyboardPanMain) cbKeyboardPanMain.checked = enableKeyboardPan;
  if (cbRightDragPanMain) { cbRightDragPanMain.checked = true; cbRightDragPanMain.disabled = true; }
}

gameMenuButton.addEventListener("click", () => {
  syncAllCheckboxes();
  inGameMenuOverlay.style.display = "flex";
});

const loginContainer          = document.getElementById("loginContainer");
const walletInput             = document.getElementById("walletInput");
const loginOkButton           = document.getElementById("loginOkButton");
const loginCloseIcon          = document.getElementById("loginCloseIcon");
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
const walletSearch          = document.getElementById("walletSearch");

function filterRecords() {
  const searchValue = walletSearch.value.toLowerCase();
  const table = recordsTableContainer.querySelector('table');
  if (!table) return;

  const rows = table.querySelectorAll('tr');
  let foundIndex = -1;
  let visibleRows = 0;

  const existingNoResults = recordsTableContainer.querySelector('#noResults');
  if (existingNoResults) existingNoResults.remove();

  rows.forEach((row, index) => {
    if (index === 0) return;
    const walletCell = row.cells[1];
    if (walletCell) {
      const walletText = walletCell.textContent.toLowerCase();
      const matches = walletText.includes(searchValue);
      row.style.display = matches || searchValue === '' ? '' : 'none';
      if (matches) visibleRows++;
      if (matches && foundIndex === -1) foundIndex = index;
    }
  });

  if (searchValue !== '' && visibleRows === 0) {
    const noResults = document.createElement('div');
    noResults.id = 'noResults';
    noResults.style.color = '#FF4444';
    noResults.style.marginTop = '10px';
    noResults.textContent = 'No wallets found.';
    recordsTableContainer.appendChild(noResults);
  }

  if (foundIndex !== -1 && searchValue !== '') {
    const row = rows[foundIndex];
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.style.background = 'rgba(255, 255, 0, 0.2)';
    setTimeout(() => row.style.background = '', 2000);
  }
}

walletSearch.addEventListener('input', filterRecords);

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

let currentSession = null;

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

btnRestartIG.addEventListener("click", async () => {
  inGameMenuOverlay.style.display = "none";
  await beginNewRun();
});
btnMainIG.addEventListener("click", () => {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  }
  inGameMenuOverlay.style.display = "none";
  gameState = "menu";
  updateUI();
  syncMainMenuSettings();
});

btnMenuOver.addEventListener("click", () => {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  }
  gameState = "menu";
  updateUI();
  syncMainMenuSettings();
});
btnRestartOver.addEventListener("click", async () => {
  await beginNewRun();
});

btnStart.addEventListener("click", () => {
  loginContainer.style.display = "block";
});

loginOkButton.addEventListener("click", async () => {
  const w = walletInput.value.trim();
  const isValid = /^0x[a-fA-F0-9]{40}$/.test(w);
  if (!isValid) return alert("Invalid wallet!");

  const walletLower = w.toLowerCase();
  currentPlayer = { wallet: walletLower, score: 0 };
  loginContainer.style.display = "none";

  const all = await fetchAllParticipantsFromXano();
  const me = all.find(r => r.wallet === walletLower) || { score: 0 };

  lastRecord.textContent = me.score;
  summaryOverlay.style.display = "flex";
});

if (loginCloseIcon) {
  loginCloseIcon.addEventListener("click", () => {
    loginContainer.style.display = "none";
  });
}

playWithoutWalletButton.addEventListener("click", async () => {
  currentPlayer = null;
  loginContainer.style.display = "none";
  await beginNewRun();
});

btnPlayNow.addEventListener("click", async () => {
  summaryOverlay.style.display = "none";
  await beginNewRun();
});

btnRecords.addEventListener("click", async () => {
  const prevText = btnRecords.textContent;
  btnRecords.textContent = "Loading…";
  btnRecords.disabled = true;

  try {
    await showRecordsOverlay(recordsTableContainer, recordsContainer, currentPlayer);
    walletSearch.value = '';
    filterRecords();
  } finally {
    btnRecords.disabled = false;
    btnRecords.textContent = prevText;
  }
});

closeRecordsButton.addEventListener("click", () => {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  }
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

  const pos = ic.screenPosition(cameraX, cameraY, now);

  if (ic.type === "key") {
    ic.removeStart = now;

    const img = Icon.images[ic.type];
    if (img && img.complete) spawnTrail(pos.x, pos.y, img, 3);

    scoreTotal++;
    playSound("plus.wav", 0.4);
    spawnPickupEffects("key", pos.x, pos.y);
    updateHUD();
  }
  else if (ic.type === "clock") {
    ic.removeStart = now;

    const img = Icon.images[ic.type];
    if (img && img.complete) spawnTrail(pos.x, pos.y, img, 3);

    batteryPercent = Math.min(100, batteryPercent + 10);
    playSound("time.wav", 0.4);
    spawnPickupEffects("clock", pos.x, pos.y);
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

function startGame() {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  }

  Object.keys(cells).forEach(k => delete cells[k]);
  generatedChunks.clear();
  scoreTotal = 0;
  batteryPercent = 100;
  missEvents = [];
  blinkUntil = 0;
  lastPct = null;
  Icon.shakeFactor = 1;
  cameraX = cameraY = 0;
  gameStartTime = performance.now();

  FX.particles.length = 0;
  FX.ripples.length = 0;
  FX.trails.length = 0;
  FX.flashAlpha = 0;

  if (backgroundMusic) {
    backgroundMusic.play().catch(e => console.error("Music playback failed:", e));
  }

  playSound("start.wav", 0.7);
  updateHUD();
  gameState = "game";
  updateUI();
}

async function beginNewRun() {
  const wallet = currentPlayer?.wallet || null;
  currentSession = await startSession(wallet);
  if (!currentSession) {
    alert("Server isn’t ready. Try again.");
    return;
  }
  startGame(0);
}

function update(dt) {
  if (gameState !== "game") return;

  const dtSec   = dt / 1000;
  const w       = gameCanvas.width;
  const h       = gameCanvas.height;
  const centerX = w / 2;
  const centerY = h / 2;

  if (enableRightDragPan && isRightDragging) {
    // ПКМ — движется в mousemove
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
        else if (cursorY > centerY + dzY) fy = (cursorY - (centerX + dzY)) / (centerX - dzX);

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

    if (currentSession) {
      submitScore(currentSession, scoreTotal, currentPlayer?.wallet || null).catch(console.error);
      currentSession = null;
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

  for (let i = FX.particles.length - 1; i >= 0; i--) {
    const p = FX.particles[i];
    p.age += dt;
    if (p.age >= p.life) { FX.particles.splice(i,1); continue; }
    const t = p.age / p.life;
    p.vy += 200 * dtSec;
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
    p.alpha = 1 - t;
  }

  for (let i = FX.ripples.length - 1; i >= 0; i--) {
    const r = FX.ripples[i];
    r.age += dt;
    if (r.age >= r.life) { FX.ripples.splice(i,1); continue; }
    const t = r.age / r.life;
    r.r = r.maxR * t;
    r.alpha = 1 - t;
  }

  const nowFx = performance.now();
  for (let i = FX.trails.length - 1; i >= 0; i--) {
    const tr = FX.trails[i];
    const age = nowFx - tr.start;
    if (age < 0) continue;
    if (age >= tr.life) { FX.trails.splice(i,1); continue; }
    tr.alpha = 1 - (age / tr.life);
    tr.scale = 1 + 0.25 * (age / tr.life);
  }

  FX.flashAlpha = Math.max(0, FX.flashAlpha - dtSec * 1.6);
}

function draw() {
  if (gameState !== "game") return;

  const now = performance.now();
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  drawCells(ctx, cameraX, cameraY, gameCanvas.width, gameCanvas.height, now);

  ctx.save();
  for (const tr of FX.trails) {
    if (!tr.img || tr.alpha <= 0) continue;
    ctx.globalAlpha = tr.alpha * 0.6;
    const size = 30 * (tr.scale || 1);
    ctx.drawImage(tr.img, tr.x - size/2, tr.y - size/2, size, size);
  }
  ctx.restore();

  for (const r of FX.ripples) {
    ctx.save();
    ctx.globalAlpha = (r.alpha || 1) * 0.45;
    ctx.strokeStyle = `rgba(${r.color[0]}, ${r.color[1]}, ${r.color[2]}, ${r.alpha || 1})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of FX.particles) {
    ctx.globalAlpha = p.alpha || 1;
    ctx.fillStyle = `rgb(${p.color[0]}, ${p.color[1]}, ${p.color[2]})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

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

  if (FX.flashAlpha > 0) {
    ctx.save();
    const [fr, fg, fb] = [255, 255, 220];
    const a = Math.min(1, Math.pow(FX.flashAlpha, 0.6) * 0.2);
    const R = Math.max(gameCanvas.width, gameCanvas.height) * 0.5;
    const grad2 = ctx.createRadialGradient(cursorX, cursorY, 0, cursorX, cursorY, R);
    grad2.addColorStop(0, `rgba(${fr}, ${fg}, ${fb}, ${a})`);
    grad2.addColorStop(1, `rgba(${fr}, ${fg}, ${fb}, 0)`);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
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
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
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
    finalScore.innerHTML           = `Your score: ${scoreTotal} <img src="icons/key.svg" alt="Key" style="filter: invert(100%); vertical-align: middle; width: 24px; height: 24px;" />`;
  }
}

updateUI();
Icon._loadImages();