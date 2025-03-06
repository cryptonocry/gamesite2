// Конфигурация Phaser
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    backgroundColor: '#021013' // COLOR_BG
};

const game = new Phaser.Game(config);

// Константы из вашего кода
const CELL_SIZE = 80;
const CHUNK_SIZE = 20;
const START_TIME = 60;
const FLY_DURATION = 1.0;
const RESPAWN_DELAY = 2.0;
const MIN_CLUSTER_SIZE = 5;
const MAX_CLUSTER_SIZE = 9;

let cells = {};
let generatedChunks = new Set();
let cameraX = window.innerWidth / 2;
let cameraY = window.innerHeight / 2;
let scoreTotal = 0;
let timeLeft = START_TIME;
let flyingDigits = [];
let slotsToRespawn = {};
let folderScores = [0, 0];
let difficultyFactor = 1;

// Сцены
let currentScene;

function preload() {
    // Загрузка шрифтов, если нужно
    // this.load.font('arial', 'assets/arial.ttf');
}

function create() {
    currentScene = 'menu';
    createMenu(this);
}

function update(time, delta) {
    if (currentScene === 'game') {
        timeLeft -= delta / 1000;
        if (timeLeft <= 0) {
            switchScene('game_over');
            return;
        }
        ensureVisibleChunks();
        updateGame(this, time / 1000);
    }
}

// Генерация чанка
function generateChunk(cx, cy) {
    if (generatedChunks.has(`${cx},${cy}`)) return;
    generatedChunks.add(`${cx},${cy}`);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            let x = cx * CHUNK_SIZE + lx;
            let y = cy * CHUNK_SIZE + ly;
            cells[`${x},${y}`] = {
                gridX: x,
                gridY: y,
                value: Math.floor(Math.random() * 10),
                anomaly: 0, // AnomalyType.NONE
                spawnTime: time.time
            };
        }
    }

    // Генерация кластеров (упрощённо)
    generateCluster(cx, cy, 1); // UPSIDE_DOWN
    generateCluster(cx, cy, 2); // STRANGE_ANIM
}

function generateCluster(cx, cy, anomaly) {
    // Аналог generate_cluster_in_chunk с BFS
    // Упрощённая реализация
    let coords = [];
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            coords.push([cx * CHUNK_SIZE + lx, cy * CHUNK_SIZE + ly]);
        }
    }
    Phaser.Utils.Array.Shuffle(coords);
    let clusterSize = Phaser.Math.Between(MIN_CLUSTER_SIZE, MAX_CLUSTER_SIZE);
    for (let i = 0; i < clusterSize; i++) {
        let [x, y] = coords[i];
        if (cells[`${x},${y}`]) cells[`${x},${y}`].anomaly = anomaly;
    }
}

function ensureVisibleChunks() {
    let leftWorld = Math.floor(-cameraX / CELL_SIZE);
    let topWorld = Math.floor(-cameraY / CELL_SIZE);
    let rightWorld = Math.floor((window.innerWidth - cameraX) / CELL_SIZE);
    let bottomWorld = Math.floor((window.innerHeight - cameraY) / CELL_SIZE);

    let cxMin = Math.floor(leftWorld / CHUNK_SIZE) - 1;
    let cxMax = Math.floor(rightWorld / CHUNK_SIZE) + 1;
    let cyMin = Math.floor(topWorld / CHUNK_SIZE) - 1;
    let cyMax = Math.floor(bottomWorld / CHUNK_SIZE) + 1;

    for (let cx = cxMin; cx <= cxMax; cx++) {
        for (let cy = cyMin; cy <= cyMax; cy++) {
            generateChunk(cx, cy);
        }
    }
}

function updateGame(scene, currentTime) {
    scene.cameras.main.setScroll(-cameraX, -cameraY);

    // Отрисовка клеток
    scene.children.list.forEach(child => child.destroy());
    for (let key in cells) {
        let cell = cells[key];
        let [px, py] = screenPosition(cell, currentTime);
        if (px < -CELL_SIZE || px > window.innerWidth + CELL_SIZE || py < -CELL_SIZE || py > window.innerHeight + CELL_SIZE) continue;

        let text = scene.add.text(px, py, cell.value, {
            font: '24px Arial',
            color: '#7AC0D6',
            align: 'center'
        }).setOrigin(0.5);
        if (cell.anomaly === 1) text.setAngle(180); // UPSIDE_DOWN
        if (cell.anomaly === 2) {
            // STRANGE_ANIM (анимация)
            text.setScale(1 + 0.2 * Math.sin(currentTime * 1.6));
        }
    }

    // Обработка кликов
    scene.input.on('pointerdown', (pointer) => {
        if (pointer.rightButtonDown()) {
            scene.input.on('pointermove', (movePointer) => {
                cameraX -= movePointer.x - pointer.x;
                cameraY -= movePointer.y - pointer.y;
            });
        } else {
            let clicked = getClickedDigit(pointer.x, pointer.y, currentTime);
            if (clicked) handleClick(clicked, scene, currentTime);
        }
    });

    // Отрисовка папок
    drawFolders(scene);
    drawScore(scene);
    drawTimer(scene);
}

function screenPosition(cell, currentTime) {
    let baseX = cell.gridX * CELL_SIZE + cameraX;
    let baseY = cell.gridY * CELL_SIZE + cameraY;
    let dx = 5 * Math.cos(2 * (currentTime - cell.spawnTime));
    let dy = 5 * Math.sin(2 * (currentTime - cell.spawnTime));
    return [baseX + dx, baseY + dy];
}

function getClickedDigit(mx, my, currentTime) {
    let closest = null;
    let closestDist = Infinity;
    for (let key in cells) {
        let cell = cells[key];
        let [sx, sy] = screenPosition(cell, currentTime);
        let dist = Math.hypot(mx - sx, my - sy);
        if (dist < 20 && dist < closestDist) {
            closest = cell;
            closestDist = dist;
        }
    }
    return closest;
}

function handleClick(cell, scene, currentTime) {
    // BFS и обработка групп — упрощённо
    let group = bfsCollectAnomaly(cell.gridX, cell.gridY, cell.anomaly);
    if (group.length >= MIN_CLUSTER_SIZE) {
        let folderIdx = cell.anomaly === 1 ? 0 : 1;
        group.forEach(([x, y]) => {
            let digit = cells[`${x},${y}`];
            let [sx, sy] = screenPosition(digit, currentTime);
            scene.tweens.add({
                targets: { x: sx, y: sy },
                x: window.innerWidth / 4 + folderIdx * window.innerWidth / 2,
                y: window.innerHeight - 40,
                duration: FLY_DURATION * 1000,
                onComplete: () => delete cells[`${x},${y}`]
            });
        });
        folderScores[folderIdx] += group.length;
        scoreTotal += group.length * 10;
        timeLeft += group.length;
    }
}

function bfsCollectAnomaly(sx, sy, anomaly) {
    // Упрощённый BFS
    let group = [];
    // Реализуйте BFS по аналогии с вашим кодом
    return group;
}

function drawFolders(scene) {
    let folderNames = ["Перевёрнутые", "Иная анимация"];
    for (let i = 0; i < 2; i++) {
        scene.add.rectangle(window.innerWidth / 4 + i * window.innerWidth / 2, window.innerHeight - 40, window.innerWidth / 2, 80, 0x7AC0D6);
        scene.add.text(window.innerWidth / 4 + i * window.innerWidth / 2, window.innerHeight - 40, `${folderNames[i]}: ${folderScores[i]}`, {
            font: '24px Arial',
            color: '#021013'
        }).setOrigin(0.5);
    }
}

function drawScore(scene) {
    scene.add.text(20, 20, `Счёт: ${scoreTotal}`, { font: '24px Arial', color: '#7AC0D6' });
}

function drawTimer(scene) {
    scene.add.text(window.innerWidth / 2, 20, `${Math.floor(timeLeft)} с.`, { font: '24px Arial', color: '#7AC0D6' }).setOrigin(0.5);
}

function createMenu(scene) {
    let menuItems = ["Начать игру", "Сложность", "Рекорды", "Выход"];
    let selectedIdx = 0;

    function draw() {
        scene.children.list.forEach(child => child.destroy());
        scene.add.text(window.innerWidth / 2, window.innerHeight / 4, "Главное меню", { font: '36px Arial', color: '#7AC0D6' }).setOrigin(0.5);
        menuItems.forEach((item, i) => {
            let color = i === selectedIdx ? '#FFFFFF' : '#7AC0D6';
            scene.add.text(window.innerWidth / 2, window.innerHeight / 2 + i * 50, item, { font: '36px Arial', color }).setOrigin(0.5);
        });
    }

    draw();

    scene.input.keyboard.on('keydown', (event) => {
        if (event.key === 'ArrowUp') selectedIdx = Math.max(0, selectedIdx - 1);
        if (event.key === 'ArrowDown') selectedIdx = Math.min(menuItems.length - 1, selectedIdx + 1);
        if (event.key === 'Enter') {
            if (selectedIdx === 0) switchScene('game');
            if (selectedIdx === 1) switchScene('difficulty');
            if (selectedIdx === 2) switchScene('records');
            if (selectedIdx === 3) window.close();
        }
        draw();
    });
}

function switchScene(newScene) {
    currentScene = newScene;
    if (newScene === 'game') {
        cells = {};
        generatedChunks.clear();
        folderScores = [0, 0];
        scoreTotal = 0;
        timeLeft = START_TIME;
    }
    // Добавьте логику для других сцен
}