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
    backgroundColor: '#021013'
};

const game = new Phaser.Game(config);

// Константы
const CELL_SIZE = 80;
const CHUNK_SIZE = 10;
const START_TIME = 60;
const FLY_DURATION = 1.0;
const FOLDER_HEIGHT = 80;

// Переменные
let cells = {};
let cameraX = 0;
let cameraY = 0;
let scoreTotal = 0;
let timeLeft = START_TIME;
let folderScores = [0, 0];
let currentScene = 'menu';
let dragging = false;
let lastPointerX, lastPointerY;
let flyingDigits = [];

// Preload
function preload() {
    console.log('Preloading...');
}

// Create
function create() {
    console.log('Creating scene:', currentScene);
    if (currentScene === 'menu') {
        createMenu(this);
    } else if (currentScene === 'game') {
        startGame(this);
    } else if (currentScene === 'game_over') {
        createGameOver(this);
    }
}

// Update
function update(time, delta) {
    if (currentScene === 'game') {
        timeLeft -= delta / 1000;
        if (timeLeft <= 0) {
            switchScene('game_over');
            return;
        }
        updateGame(this, time / 1000);
    }
}

// Меню
function createMenu(scene) {
    scene.children.removeAll();
    const menuItems = ["Начать игру", "Выход"];
    let selectedIdx = 0;

    const title = scene.add.text(window.innerWidth / 2, window.innerHeight / 4, "Главное меню", {
        font: '36px Arial',
        color: '#7AC0D6'
    }).setOrigin(0.5);

    const items = menuItems.map((item, i) => {
        return scene.add.text(window.innerWidth / 2, window.innerHeight / 2 + i * 50, item, {
            font: '36px Arial',
            color: i === selectedIdx ? '#FFFFFF' : '#7AC0D6'
        }).setOrigin(0.5);
    });

    scene.input.keyboard.on('keydown', (event) => {
        if (event.key === 'ArrowUp') {
            selectedIdx = Math.max(0, selectedIdx - 1);
            items.forEach((item, i) => item.setColor(i === selectedIdx ? '#FFFFFF' : '#7AC0D6'));
        } else if (event.key === 'ArrowDown') {
            selectedIdx = Math.min(menuItems.length - 1, selectedIdx + 1);
            items.forEach((item, i) => item.setColor(i === selectedIdx ? '#FFFFFF' : '#7AC0D6'));
        } else if (event.key === 'Enter') {
            if (selectedIdx === 0) switchScene('game');
            else if (selectedIdx === 1) window.close();
        }
    });
}

// Старт игры
function startGame(scene) {
    scene.children.removeAll();
    cells = {};
    scoreTotal = 0;
    timeLeft = START_TIME;
    folderScores = [0, 0];
    flyingDigits = [];
    cameraX = -(window.innerWidth / 2 - CELL_SIZE * CHUNK_SIZE / 2); // Центрируем первый чанк
    cameraY = -(window.innerHeight / 2 - CELL_SIZE * CHUNK_SIZE / 2);

    // Генерация начального чанка
    generateChunk(0, 0);
    console.log('Cells after generation:', Object.keys(cells).length, cells);

    // Обработка мыши
    scene.input.on('pointerdown', (pointer) => {
        if (pointer.rightButtonDown()) {
            dragging = true;
            lastPointerX = pointer.x;
            lastPointerY = pointer.y;
        } else if (pointer.leftButtonDown()) {
            const clicked = getClickedDigit(pointer.x, pointer.y, time / 1000);
            if (clicked) handleClick(clicked, scene, time / 1000);
        }
    });

    scene.input.on('pointermove', (pointer) => {
        if (dragging) {
            cameraX += pointer.x - lastPointerX;
            cameraY += pointer.y - lastPointerY;
            lastPointerX = pointer.x;
            lastPointerY = pointer.y;
        }
    });

    scene.input.on('pointerup', () => {
        dragging = false;
    });
}

// Обновление игры
function updateGame(scene, currentTime) {
    scene.children.removeAll();

    // Отрисовка клеток
    for (let key in cells) {
        const cell = cells[key];
        const [px, py] = screenPosition(cell, currentTime);
        const text = scene.add.text(px, py, cell.value, {
            font: '24px Arial',
            color: '#7AC0D6'
        }).setOrigin(0.5);
    }

    // Отрисовка летающих цифр
    flyingDigits = flyingDigits.filter(fd => {
        const t = (currentTime - fd.startTime) / FLY_DURATION;
        if (t >= 1) return false;
        const x = fd.startX + (fd.endX - fd.startX) * t;
        const y = fd.startY + (fd.endY - fd.startY) * t;
        scene.add.text(x, y, fd.value, {
            font: '24px Arial',
            color: '#7AC0D6'
        }).setOrigin(0.5);
        return true;
    });

    // UI: Папки
    const folderNames = ["Перевёрнутые", "Иная анимация"];
    for (let i = 0; i < 2; i++) {
        scene.add.rectangle(
            window.innerWidth / 4 + i * window.innerWidth / 2,
            window.innerHeight - FOLDER_HEIGHT / 2,
            window.innerWidth / 2,
            FOLDER_HEIGHT,
            0x7AC0D6
        );
        scene.add.text(
            window.innerWidth / 4 + i * window.innerWidth / 2,
            window.innerHeight - FOLDER_HEIGHT / 2,
            `${folderNames[i]}: ${folderScores[i]}`,
            { font: '24px Arial', color: '#021013' }
        ).setOrigin(0.5);
    }

    // UI: Счёт и таймер
    scene.add.text(20, 20, `Счёт: ${scoreTotal}`, { font: '24px Arial', color: '#7AC0D6' });
    scene.add.text(window.innerWidth / 2, 20, `${Math.floor(timeLeft)} с.`, {
        font: '24px Arial',
        color: '#7AC0D6'
    }).setOrigin(0.5);
}

// Генерация чанка
function generateChunk(cx, cy) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            const x = cx * CHUNK_SIZE + lx;
            const y = cy * CHUNK_SIZE + ly;
            const key = `${x},${y}`;
            if (!cells[key]) {
                cells[key] = {
                    gridX: x,
                    gridY: y,
                    value: Math.floor(Math.random() * 10),
                    anomaly: 0,
                    spawnTime: Date.now() / 1000
                };
            }
        }
    }
}

// Позиция на экране
function screenPosition(cell, currentTime) {
    const baseX = cell.gridX * CELL_SIZE + cameraX + window.innerWidth / 2;
    const baseY = cell.gridY * CELL_SIZE + cameraY + window.innerHeight / 2;
    return [baseX, baseY];
}

// Поиск кликнутой цифры
function getClickedDigit(mx, my, currentTime) {
    let closest = null;
    let closestDist = Infinity;
    for (let key in cells) {
        const cell = cells[key];
        const [sx, sy] = screenPosition(cell, currentTime);
        const dist = Math.hypot(mx - sx, my - sy);
        if (dist < 20 && dist < closestDist) {
            closest = cell;
            closestDist = dist;
        }
    }
    return closest;
}

// Обработка клика
function handleClick(cell, scene, currentTime) {
    const [sx, sy] = screenPosition(cell, currentTime);
    const fx = window.innerWidth / 4; // Летим в первую папку
    const fy = window.innerHeight - FOLDER_HEIGHT / 2;
    flyingDigits.push({
        value: cell.value,
        startX: sx,
        startY: sy,
        endX: fx,
        endY: fy,
        startTime: currentTime
    });
    delete cells[`${cell.gridX},${cell.gridY}`];
    scoreTotal += 10;
    folderScores[0] += 1;
    timeLeft += 1;
}

// Экран "Game Over"
function createGameOver(scene) {
    scene.children.removeAll();
    scene.add.text(window.innerWidth / 2, window.innerHeight / 4, "Время вышло!", {
        font: '36px Arial',
        color: '#7AC0D6'
    }).setOrigin(0.5);

    scene.add.text(window.innerWidth / 2, window.innerHeight / 2, `Ваш счёт: ${scoreTotal}`, {
        font: '36px Arial',
        color: '#7AC0D6'
    }).setOrigin(0.5);

    scene.add.text(window.innerWidth / 2, window.innerHeight - 50, "Enter - в меню, ESC - выход", {
        font: '24px Arial',
        color: '#7AC0D6'
    }).setOrigin(0.5);

    scene.input.keyboard.on('keydown', (event) => {
        if (event.key === 'Enter') switchScene('menu');
        else if (event.key === 'Escape') window.close();
    });
}

// Переключение сцены
function switchScene(newScene) {
    currentScene = newScene;
    create();
}

// Обработка ошибок
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error(`Ошибка: ${msg} в строке ${lineNo}:${columnNo}`, error);
    return false;
};
