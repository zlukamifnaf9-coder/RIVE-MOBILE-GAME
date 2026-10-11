/* ═══════════════════════════════════════════════════════════
   BACKROOMS · CORE.JS
   Союзная республика №2: Ядро игры
   - Игровой цикл
   - Состояние (gameState)
   - Генерация лабиринта
   - Коллизии
   - Управление
   ═══════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    // Ждём пока загрузится config.js
    if (!window.BRM) {
        console.error('[BRM] core.js: config.js НЕ загружен!');
        return;
    }

    // ═══════════════════════════════════════════════════
    //  ПОЛУЧАЕМ ЭЛЕМЕНТЫ
    // ═══════════════════════════════════════════════════
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('[BRM] core.js: canvas #gameCanvas не найден!');
        return;
    }
    const ctx = canvas.getContext('2d');

    // Сохраняем в BRM для других модулей
    BRM.canvas = canvas;
    BRM.ctx = ctx;

    // Размеры canvas
    canvas.width = BRM.W;
    canvas.height = BRM.H;

    // ═══════════════════════════════════════════════════
    //  СОСТОЯНИЕ ИГРЫ
    // ═══════════════════════════════════════════════════
    BRM.gameState = 'playing';   // 'playing' | 'dead' | 'won'

    // ═══════════════════════════════════════════════════
    //  ДАННЫЕ ИГРЫ
    // ═══════════════════════════════════════════════════
    BRM.map = [];
    BRM.exitPos = { x: 0, y: 0 };
    BRM.items = [];              // предметы на полу
    BRM.furniture = [];          // мебель (шкафы, тумбочки)
    BRM.entities = [];           // сущности (заполнит entities.js)
    BRM.bullets = [];
    BRM.toasts = [];
    BRM.particles = [];

    BRM.inventory = {
        medkit: 0,
        pistol: 0,
        ammo: 0,
        taser: 0,
        energy: 0
    };

    // Эффекты
    BRM.screenShake = 0;
    BRM.damageFlash = 0;
    BRM.scareFlash = 0;
    BRM.screenBlood = 0;
    BRM.deathScreen = null;
    BRM.inventoryOpen = false;

    // ═══════════════════════════════════════════════════
    //  ИГРОК
    // ═══════════════════════════════════════════════════
    BRM.player = {
        x: BRM.PLAYER_START.x,
        y: BRM.PLAYER_START.y,
        angle: 0,
        flash: BRM.FLASH_MAX,
        flashlightOn: true,
        bobPhase: 0,
        health: BRM.PLAYER_MAX_HP,
        maxHealth: BRM.PLAYER_MAX_HP,
        walkPhase: 0
    };

    // ═══════════════════════════════════════════════════
    //  УПРАВЛЕНИЕ (мобильный стик + кнопки)
    // ═══════════════════════════════════════════════════
    BRM.leftStick = {
        active: false, id: null,
        baseX: 130, baseY: BRM.H - 150,
        knobX: 130, knobY: BRM.H - 150,
        dx: 0, dy: 0
    };

    BRM.rightZone = {
        active: false, id: null,
        lastX: 0, rotateDelta: 0
    };

    // Кнопки мобильные
    BRM.buttons = {
        interact: { x: BRM.W - 90, y: 80,  w: 70, h: 70, pressed: false },
        inv:      { x: BRM.W - 90, y: 170, w: 70, h: 70, pressed: false },
        use:      { x: BRM.W - 90, y: 260, w: 70, h: 70, pressed: false },
        ebtn:     { x: BRM.W - 90, y: 350, w: 70, h: 70, pressed: false }
    };

    // Клавиатура
    BRM.keys = {};

    // ═══════════════════════════════════════════════════
    //  ГЕНЕРАЦИЯ ЛАБИРИНТА
    // ═══════════════════════════════════════════════════
    BRM.generateMaze = function() {
        const N = BRM.MAP_SIZE;
        BRM.map = [];
        for (let y = 0; y < N; y++) {
            BRM.map[y] = [];
            for (let x = 0; x < N; x++) BRM.map[y][x] = 1;
        }
        BRM.map[1][1] = 0;

        // Алгоритм "растущее дерево" (recursive backtracker)
        const frontiers = [];
        function addFrontiers(x, y) {
            [[0, -2], [0, 2], [-2, 0], [2, 0]].forEach(([dx, dy]) => {
                const nx = x + dx, ny = y + dy;
                if (nx > 0 && nx < N - 1 && ny > 0 && ny < N - 1 && BRM.map[ny][nx] === 1) {
                    frontiers.push({ x: nx, y: ny, fromX: x, fromY: y });
                }
            });
        }
        addFrontiers(1, 1);

        let safety = 0;
        while (frontiers.length > 0 && safety < 5000) {
            safety++;
            const idx = Math.floor(Math.random() * frontiers.length);
            const f = frontiers.splice(idx, 1)[0];
            if (BRM.map[f.y][f.x] === 0) continue;
            BRM.map[(f.y + f.fromY) / 2][(f.x + f.fromX) / 2] = 0;
            BRM.map[f.y][f.x] = 0;
            addFrontiers(f.x, f.y);
        }

        // Открываем часть стен — чтобы было интереснее
        for (let i = 0; i < N * 3; i++) {
            const x = 1 + Math.floor(Math.random() * (N - 2));
            const y = 1 + Math.floor(Math.random() * (N - 2));
            if (BRM.map[y][x] === 1) {
                const n = (BRM.map[y-1]?.[x] || 1) + (BRM.map[y+1]?.[x] || 1) +
                          (BRM.map[y]?.[x-1] || 1) + (BRM.map[y]?.[x+1] || 1);
                if (n <= 2) BRM.map[y][x] = 0;
            }
        }

        // Свободные клетки
        const freeCells = [];
        for (let y = 1; y < N - 1; y++) {
            for (let x = 1; x < N - 1; x++) {
                if (BRM.map[y][x] === 0 && (x !== 1 || y !== 1)) {
                    freeCells.push({ x, y });
                }
            }
        }

        // Выход — самая дальняя точка
        let maxDist = 0, ex = N - 3, ey = N - 3;
        freeCells.forEach(({ x, y }) => {
            const d = Math.abs(x - 1) + Math.abs(y - 1);
            if (d > maxDist) { maxDist = d; ex = x; ey = y; }
        });
        BRM.map[ey][ex] = 2;   // 2 = выход
        BRM.exitPos = { x: ex + 0.5, y: ey + 0.5 };

        // Генерируем мебель (если модуль items.js загружен)
        if (BRM.generateFurniture) {
            BRM.generateFurniture(freeCells, ex, ey);
        }

        // Генерируем предметы на полу (если items.js загружен)
        if (BRM.generateFloorItems) {
            BRM.generateFloorItems(freeCells, ex, ey);
        }

        // Генерируем сущности (если entities.js загружен)
        if (BRM.generateEntities) {
            BRM.generateEntities(freeCells);
        }

        // Ставим игрока
        BRM.player.x = 1.5;
        BRM.player.y = 1.5;
        BRM.player.angle = 0;
        BRM.player.health = BRM.PLAYER_MAX_HP;
        BRM.player.flash = BRM.FLASH_MAX;

        // Начальное направление — в свободную сторону
        if (BRM.map[1][2] === 0) BRM.player.angle = 0;
        else if (BRM.map[2][1] === 0) BRM.player.angle = Math.PI / 2;
        else BRM.player.angle = Math.PI;
    };

    // ═══════════════════════════════════════════════════
    //  КОЛЛИЗИИ
    // ═══════════════════════════════════════════════════
    BRM.canMove = function(x, y) {
        const xi = Math.floor(x), yi = Math.floor(y);
        if (xi < 0 || xi >= BRM.MAP_SIZE || yi < 0 || yi >= BRM.MAP_SIZE) return false;
        if (!BRM.map[yi]) return false;
        return BRM.map[yi][xi] !== 1;   // не стена
    };

    // Проверка линии видимости (для сущностей)
    BRM.hasLineOfSight = function(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.5) return true;
        const steps = Math.ceil(dist * 3);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const cx = x1 + dx * t;
            const cy = y1 + dy * t;
            const xi = Math.floor(cx), yi = Math.floor(cy);
            if (xi < 0 || xi >= BRM.MAP_SIZE || yi < 0 || yi >= BRM.MAP_SIZE) return false;
            if (BRM.map[yi][xi] === 1) return false;
        }
        return true;
    };

    // ═══════════════════════════════════════════════════
    //  ДВИЖЕНИЕ ИГРОКА
    // ═══════════════════════════════════════════════════
    BRM.updatePlayerMovement = function(dt) {
        const p = BRM.player;
        let mvx = 0, mvy = 0;

        if (BRM.controlMode === 'mobile') {
            if (BRM.leftStick.active) {
                mvx = BRM.leftStick.dx;
                mvy = BRM.leftStick.dy;
            }
        } else {
            if (BRM.keys['w'] || BRM.keys['ц'] || BRM.keys['arrowup']) {
                mvx += Math.cos(p.angle);
                mvy += Math.sin(p.angle);
            }
            if (BRM.keys['s'] || BRM.keys['ы'] || BRM.keys['arrowdown']) {
                mvx -= Math.cos(p.angle);
                mvy -= Math.sin(p.angle);
            }
            if (BRM.keys['a'] || BRM.keys['ф'] || BRM.keys['arrowleft']) {
                p.angle -= BRM.ROT_SPEED * 60 * dt;
            }
            if (BRM.keys['d'] || BRM.keys['в'] || BRM.keys['arrowright']) {
                p.angle += BRM.ROT_SPEED * 60 * dt;
            }
        }

        const mag = Math.sqrt(mvx * mvx + mvy * mvy);
        if (mag > 0.1) {
            const speed = BRM.MOVE_SPEED * Math.min(1, mag) * 60 * dt;
            const nx = p.x + (mvx / mag) * speed;
            const ny = p.y + (mvy / mag) * speed;
            if (BRM.canMove(nx, p.y)) p.x = nx;
            if (BRM.canMove(p.x, ny)) p.y = ny;
            p.bobPhase += dt * 10;
            p.walkPhase += dt * 10;

            // Звук шагов
            if (!p._stepT) p._stepT = 0;
            p._stepT -= dt;
            if (p._stepT <= 0) {
                if (BRM.Sound && BRM.Sound.step) BRM.Sound.step();
                p._stepT = 0.4;
            }
        }

        // Вращение с правой зоны (свайп)
        if (BRM.rightZone.rotateDelta) {
            p.angle += BRM.rightZone.rotateDelta;
            BRM.rightZone.rotateDelta = 0;
        }

        if (!isFinite(p.angle)) p.angle = 0;

        // Расход фонарика
        if (p.flashlightOn && p.flash > 0) {
            p.flash = Math.max(0, p.flash - dt * BRM.FLASH_DRAIN);
        }

        // Проверка выхода
        const dExit = Math.hypot(p.x - BRM.exitPos.x, p.y - BRM.exitPos.y);
        if (dExit < 0.6) {
            BRM.winLevel();
        }
    };

    // ═══════════════════════════════════════════════════
    //  ОБНОВЛЕНИЕ ПРЕДМЕТОВ (если items.js загружен)
    // ═══════════════════════════════════════════════════
    BRM.updateItems = function(dt) {
        if (!BRM.items) return;
        BRM.items.forEach(it => {
            if (it.taken) return;
            const d = Math.hypot(it.x - BRM.player.x, it.y - BRM.player.y);
            if (d < 0.5) {
                it.taken = true;
                if (BRM.pickupItem) BRM.pickupItem(it.type);
            }
            it.bob += dt * 2;
        });
    };

    // ═══════════════════════════════════════════════════
    //  ОБНОВЛЕНИЕ СУЩНОСТЕЙ (если entities.js загружен)
    // ═══════════════════════════════════════════════════
    BRM.updateEntities = function(dt) {
        if (!BRM.entities || !BRM.updateEntitiesLogic) return;
        BRM.updateEntitiesLogic(dt);
    };

    // ═══════════════════════════════════════════════════
    //  ОБНОВЛЕНИЕ ПУЛЬ
    // ═══════════════════════════════════════════════════
    BRM.updateBullets = function(dt) {
        BRM.bullets.forEach(b => {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;

            // Проверка попадания
            BRM.entities.forEach(e => {
                if (e.state === 'dead') return;
                const dx = e.x - b.x, dy = e.y - b.y;
                if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                    e.hp -= b.damage;
                    b.life = 0;
                    if (BRM.spawnParticles) BRM.spawnParticles(b.x, b.y, '#ff4757', 8);
                    if (BRM.Sound && BRM.Sound.hit) BRM.Sound.hit();
                    if (e.hp <= 0) {
                        e.state = 'dead';
                        if (BRM.addToast) BRM.addToast('☠️ Сущность убита', '#ff4757');
                    }
                }
            });
        });
        BRM.bullets = BRM.bullets.filter(b => b.life > 0 && b.x > -2 && b.x < BRM.MAP_SIZE + 2 && b.y > -2 && b.y < BRM.MAP_SIZE + 2);
    };

    // ═══════════════════════════════════════════════════
    //  ПРОИГРЫШ / ПОБЕДА
    // ═══════════════════════════════════════════════════
    BRM.triggerDeath = function(reason) {
        if (BRM.deathScreen) return;
        BRM.gameState = 'dead';

        if (BRM.Sound && BRM.Sound.scream) BRM.Sound.scream();
        BRM.scareFlash = 1.5;

        BRM.deathScreen = {
            timer: 3,
            reason: reason || 'Тебя настигла сущность',
            tip: 'Не подходи близко к сущностям'
        };
    };

    BRM.winLevel = function() {
        if (BRM.gameState === 'won') return;
        BRM.gameState = 'won';

        if (BRM.Sound && BRM.Sound.win) BRM.Sound.win();

        // Показываем экран победы
        setTimeout(() => {
            if (confirm('🚪 ВЫХОД НАЙДЕН!\n\nНачать заново?')) {
                location.reload();
            }
        }, 500);
    };

    // ═══════════════════════════════════════════════════
    //  ДОБАВЛЕНИЕ ЭФФЕКТОВ
    // ═══════════════════════════════════════════════════
    BRM.addToast = function(text, color) {
        BRM.toasts.push({
            text: text,
            color: color || '#fff',
            life: 2.5
        });
    };

    BRM.spawnParticles = function(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            BRM.particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 1,
                color: color,
                size: 2 + Math.random() * 3
            });
        }
    };

    BRM.screenShakeEffect = function(amount) {
        BRM.screenShake = Math.max(BRM.screenShake, amount);
    };

    // ═══════════════════════════════════════════════════
    //  ОБРАБОТКА КЛАВИАТУРЫ (ПК)
    // ═══════════════════════════════════════════════════
    document.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        BRM.keys[k] = true;

        // Экран смерти — заново
        if (BRM.deathScreen && (k === ' ' || k === 'enter')) {
            location.reload();
            return;
        }

        // Фонарик
        if (k === ' ') {
            BRM.player.flashlightOn = !BRM.player.flashlightOn;
            e.preventDefault();
        }

        // Инвентарь
        if (k === 'i' || k === 'ш') {
            BRM.inventoryOpen = !BRM.inventoryOpen;
            e.preventDefault();
        }

        // Открыть шкаф/тумбочку
        if (k === 'e' || k === 'у') {
            if (BRM.tryOpenFurniture) BRM.tryOpenFurniture();
            e.preventDefault();
        }

        // Выстрел
        if (k === 'f' || k === 'а') {
            if (BRM.shootPistol) BRM.shootPistol();
            e.preventDefault();
        }

        // Аптечка
        if (k === 'q' || k === 'й') {
            if (BRM.useMedkit) BRM.useMedkit();
            e.preventDefault();
        }

        if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    });

    document.addEventListener('keyup', e => {
        BRM.keys[e.key.toLowerCase()] = false;
    });

    // ═══════════════════════════════════════════════════
    //  МОБИЛЬНОЕ УПРАВЛЕНИЕ
    // ═══════════════════════════════════════════════════
    function getTouchPos(t) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (t.clientX - rect.left) * (BRM.W / rect.width),
            y: (t.clientY - rect.top) * (BRM.H / rect.height)
        };
    }

    function handleButtonPress(btn, action) {
        btn.pressed = true;
        action();
        setTimeout(() => { btn.pressed = false; }, 150);
    }

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (BRM.Sound && BRM.Sound.init) BRM.Sound.init();

        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            const id = t.identifier;
            const pos = getTouchPos(t);

            // Экран смерти
            if (BRM.deathScreen) {
                location.reload();
                return;
            }

            // Инвентарь открыт — игнорируем
            if (BRM.inventoryOpen) continue;

            // Правая зона — кнопки + обзор
            if (pos.x >= BRM.W / 2) {
                // Кнопка фонарика
                if (Math.hypot(pos.x - (BRM.buttons.interact.x + 35), pos.y - (BRM.buttons.interact.y + 35)) < 40) {
                    handleButtonPress(BRM.buttons.interact, () => {
                        BRM.player.flashlightOn = !BRM.player.flashlightOn;
                    });
                    continue;
                }
                // Кнопка инвентаря
                if (Math.hypot(pos.x - (BRM.buttons.inv.x + 35), pos.y - (BRM.buttons.inv.y + 35)) < 40) {
                    handleButtonPress(BRM.buttons.inv, () => {
                        BRM.inventoryOpen = !BRM.inventoryOpen;
                    });
                    continue;
                }
                // Кнопка выстрела
                if (Math.hypot(pos.x - (BRM.buttons.use.x + 35), pos.y - (BRM.buttons.use.y + 35)) < 40) {
                    handleButtonPress(BRM.buttons.use, () => {
                        if (BRM.shootPistol) BRM.shootPistol();
                    });
                    continue;
                }
                // Кнопка E (открыть шкаф)
                if (Math.hypot(pos.x - (BRM.buttons.ebtn.x + 35), pos.y - (BRM.buttons.ebtn.y + 35)) < 40) {
                    handleButtonPress(BRM.buttons.ebtn, () => {
                        if (BRM.tryOpenFurniture) BRM.tryOpenFurniture();
                    });
                    continue;
                }
                // Иначе — свайп-обзор
                if (BRM.rightZone.id === null) {
                    BRM.rightZone.active = true;
                    BRM.rightZone.id = id;
                    BRM.rightZone.lastX = pos.x;
                }
            } else {
                // Левая зона — стик
                if (BRM.leftStick.id === null) {
                    BRM.leftStick.active = true;
                    BRM.leftStick.id = id;
                    BRM.leftStick.baseX = pos.x;
                    BRM.leftStick.baseY = pos.y;
                    BRM.leftStick.knobX = pos.x;
                    BRM.leftStick.knobY = pos.y;
                }
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            const id = t.identifier;
            const pos = getTouchPos(t);

            // Левая рука — стик
            if (BRM.leftStick.active && BRM.leftStick.id === id) {
                let dx = pos.x - BRM.leftStick.baseX;
                let dy = pos.y - BRM.leftStick.baseY;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > BRM.STICK_RADIUS) {
                    dx = dx / d * BRM.STICK_RADIUS;
                    dy = dy / d * BRM.STICK_RADIUS;
                }
                BRM.leftStick.knobX = BRM.leftStick.baseX + dx;
                BRM.leftStick.knobY = BRM.leftStick.baseY + dy;
                BRM.leftStick.dx = dx / BRM.STICK_RADIUS;
                BRM.leftStick.dy = dy / BRM.STICK_RADIUS;
            }

            // Правая рука — обзор
            if (BRM.rightZone.active && BRM.rightZone.id === id) {
                const dx = pos.x - BRM.rightZone.lastX;
                BRM.rightZone.rotateDelta = (BRM.rightZone.rotateDelta || 0) + dx * 0.006;
                BRM.rightZone.lastX = pos.x;
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        e.preventDefault();
        const ids = new Set();
        for (let i = 0; i < e.touches.length; i++) ids.add(e.touches[i].identifier);

        if (BRM.leftStick.id !== null && !ids.has(BRM.leftStick.id)) {
            BRM.leftStick.active = false;
            BRM.leftStick.id = null;
            BRM.leftStick.dx = 0;
            BRM.leftStick.dy = 0;
        }
        if (BRM.rightZone.id !== null && !ids.has(BRM.rightZone.id)) {
            BRM.rightZone.active = false;
            BRM.rightZone.id = null;
        }
    }, { passive: false });

    canvas.addEventListener('touchcancel', e => {
        BRM.leftStick.active = false;
        BRM.leftStick.id = null;
        BRM.leftStick.dx = 0;
        BRM.leftStick.dy = 0;
        BRM.rightZone.active = false;
        BRM.rightZone.id = null;
    });

    // Клик (для ПК — фокус canvas)
    canvas.addEventListener('click', e => {
        if (BRM.Sound && BRM.Sound.init) BRM.Sound.init();
    });

    // ═══════════════════════════════════════════════════
    //  ИГРОВОЙ ЦИКЛ
    // ═══════════════════════════════════════════════════
    let lastTime = 0;

    BRM.update = function(dt) {
        // Экран смерти — блокируем всё
        if (BRM.deathScreen) {
            BRM.deathScreen.timer -= dt;
            return;
        }
        // Победа
        if (BRM.gameState === 'won') return;
        // Инвентарь открыт — игра на паузе
        if (BRM.inventoryOpen) return;

        // Эффекты
        if (BRM.screenShake > 0.1) BRM.screenShake *= 0.9;
        if (BRM.damageFlash > 0) BRM.damageFlash -= dt * 2;
        if (BRM.scareFlash > 0) BRM.scareFlash -= dt * 3;
        if (BRM.screenBlood > 0) BRM.screenBlood -= dt * 1.5;

        // Тосты
        BRM.toasts.forEach(t => t.life -= dt);
        BRM.toasts = BRM.toasts.filter(t => t.life > 0);

        // Частицы
        BRM.particles.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt * 1.5;
        });
        BRM.particles = BRM.particles.filter(p => p.life > 0);

        // Игрок
        BRM.updatePlayerMovement(dt);

        // Предметы
        BRM.updateItems(dt);

        // Сущности
        BRM.updateEntities(dt);

        // Пули
        BRM.updateBullets(dt);
    };

    BRM.loop = function(time) {
        const dt = Math.min((time - lastTime) / 1000, 0.05);
        lastTime = time;

        try {
            BRM.update(dt);
            if (BRM.draw) BRM.draw();
        } catch(err) {
            console.error('[BRM] Loop error:', err);
        }

        requestAnimationFrame(BRM.loop);
    };

    // ═══════════════════════════════════════════════════
    //  ЗАПУСК
    // ═══════════════════════════════════════════════════
    BRM.start = function() {
        console.log('[BRM] Запуск Союза...');

        // Генерируем уровень
        BRM.generateMaze();

        // Инициализируем звук
        if (BRM.Sound && BRM.Sound.init) BRM.Sound.init();

        // Скрываем интро (если есть)
        if (BRM.hideIntro) BRM.hideIntro();

        // Стартуем цикл
        lastTime = performance.now();
        requestAnimationFrame(BRM.loop);

        console.log('[BRM] Игра запущена ✓');
    };

    BRM.MODULES_LOADED = BRM.MODULES_LOADED || [];
    BRM.MODULES_LOADED.push('core');
    console.log('[BRM] core.js loaded ✓');

})();
