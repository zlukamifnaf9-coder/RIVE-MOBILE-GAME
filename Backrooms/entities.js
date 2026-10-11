/* ═══════════════════════════════════════════════════════════
   BACKROOMS · ENTITIES.JS
   Союзная республика №5: Сущности
   - Smiler (улыбающийся)
   - Hound (быстрый, охотник)
   - ИИ: патруль, погоня, атака
   - Голосовые фразы (TTS)
   ═══════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    if (!window.BRM) {
        console.error('[BRM] entities.js: config.js НЕ загружен!');
        return;
    }

    // ═══════════════════════════════════════════════════
    //  ГЕНЕРАЦИЯ СУЩНОСТЕЙ
    // ═══════════════════════════════════════════════════
    BRM.generateEntities = function(freeCells) {
        BRM.entities = [];

        // Сколько сущностей заспавнить (2-3)
        const numEntities = 2 + Math.floor(Math.random() * 2);

        for (let i = 0; i < numEntities; i++) {
            let tries = 0;
            while (tries < 40) {
                const c = freeCells[Math.floor(Math.random() * freeCells.length)];
                if (!c) break;

                const distFromStart = Math.abs(c.x - 1) + Math.abs(c.y - 1);
                const distFromExit = Math.abs(c.x - BRM.exitPos.x) + Math.abs(c.y - BRM.exitPos.y);

                // Не слишком близко к старту, не на выходе
                if (distFromStart > 8 && distFromExit > 3) {
                    // 50/50 Smiler или Hound
                    const type = Math.random() < 0.5 ? 'smiler' : 'hound';
                    BRM.entities.push(BRM.createEntity(c.x + 0.5, c.y + 0.5, type));
                    break;
                }
                tries++;
            }
        }

        console.log('[BRM] Создано сущностей:', BRM.entities.length);
    };

    // ═══════════════════════════════════════════════════
    //  СОЗДАНИЕ СУЩНОСТИ
    // ═══════════════════════════════════════════════════
    BRM.createEntity = function(x, y, type) {
        const cfg = BRM.ENTITY_TYPES[type] || BRM.ENTITY_TYPES.smiler;
        return {
            x: x,
            y: y,
            type: type,
            speed: cfg.speed,
            hp: cfg.hp,
            detectRange: cfg.detectRange,
            state: 'idle',           // 'idle' | 'chase' | 'dead'
            lastSeen: null,          // где видел игрока
            angle: 0,
            animTime: 0,
            screamCD: 0,             // кулдаун скримера
            stun: 0,                 // оглушение (шокер/капкан)
            _lastSay: 0,             // кулдаун голоса
            walkPhase: 0,
            facing: 1,
            targetX: null,
            targetY: null
        };
    };

    // ═══════════════════════════════════════════════════
    //  ОБНОВЛЕНИЕ ВСЕХ СУЩНОСТЕЙ
    // ═══════════════════════════════════════════════════
    BRM.updateEntitiesLogic = function(dt) {
        if (!BRM.entities) return;

        BRM.entities.forEach(e => {
            if (e.state === 'dead') return;

            // Оглушение
            if (e.stun > 0) {
                e.stun -= dt;
                e.animTime += dt;
                return;
            }

            e.animTime += dt;
            if (e.screamCD > 0) e.screamCD -= dt;

            updateEntityAI(e, dt);
            checkPlayerCollision(e);
        });

        // Убираем мёртвых из массива (если очень много)
        if (BRM.entities.length > 20) {
            BRM.entities = BRM.entities.filter(e => e.state !== 'dead');
        }
    };

    // ═══════════════════════════════════════════════════
    //  ИИ СУЩНОСТИ
    // ═══════════════════════════════════════════════════
    function updateEntityAI(e, dt) {
        const p = BRM.player;
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Проверка линии видимости
        const canSee = dist < e.detectRange &&
                       BRM.hasLineOfSight(e.x, e.y, p.x, p.y);

        if (canSee) {
            // Первый раз увидел — говорит
            if (e.state !== 'chase') {
                if (BRM.entitySay) BRM.entitySay(e, 'spotted');
            }

            e.state = 'chase';
            e.lastSeen = { x: p.x, y: p.y };

            // Скример если очень близко
            if (e.screamCD <= 0 && dist < 4 && BRM.settings.scares) {
                if (BRM.Sound && BRM.Sound.scream) BRM.Sound.scream();
                BRM.scareFlash = 1;
                BRM.screenShake = 15;
                if (BRM.entitySay) BRM.entitySay(e, 'attack');
                e.screamCD = 8;   // не чаще 1 раза в 8 сек
            }
        } else if (e.state === 'chase' && e.lastSeen) {
            // Потерял игрока
            const dl = Math.hypot(e.lastSeen.x - e.x, e.lastSeen.y - e.y);
            if (dl < 0.5) {
                e.state = 'idle';
                e.lastSeen = null;
                if (Math.random() < 0.3 && BRM.entitySay) {
                    BRM.entitySay(e, 'lost');
                }
            }
        }

        // Периодически говорит во время погони
        if (e.state === 'chase' && Math.random() < 0.005) {
            if (BRM.entitySay) BRM.entitySay(e, 'chase');
        }

        // Движение
        if (e.state === 'chase' && e.lastSeen) {
            // Идём к последней известной позиции игрока
            const tdx = e.lastSeen.x - e.x;
            const tdy = e.lastSeen.y - e.y;
            const td = Math.hypot(tdx, tdy);

            if (td > 0.1 && td < 100) {
                moveEntityTowards(e, tdx / td, tdy / td, dt);
            }
        } else if (e.state === 'idle') {
            // Патруль — иногда меняет направление
            idleWander(e, dt);
        }
    }

    // ═══════════════════════════════════════════════════
    //  ДВИЖЕНИЕ К ЦЕЛИ (с проверкой стен)
    // ═══════════════════════════════════════════════════
    function moveEntityTowards(e, dirX, dirY, dt) {
        const speed = e.speed * 60 * dt;
        const nx = e.x + dirX * speed;
        const ny = e.y + dirY * speed;

        let moved = false;

        // Пробуем полное движение
        if (BRM.canMove(nx, ny)) {
            e.x = nx;
            e.y = ny;
            moved = true;
        } else {
            // Пробуем только по X
            if (BRM.canMove(nx, e.y)) {
                e.x = nx;
                moved = true;
            }
            // Пробуем только по Y
            else if (BRM.canMove(e.x, ny)) {
                e.y = ny;
                moved = true;
            }
        }

        // Если уткнулись в стену — ищем обход
        if (!moved) {
            avoidWall(e, dirX, dirY, dt);
        }

        // Анимация ходьбы
        if (moved) {
            e.walkPhase += dt * 10;
            e.facing = dirX >= 0 ? 1 : -1;
        }
    }

    // ═══════════════════════════════════════════════════
    //  ОБХОД СТЕНЫ (простой AI)
    // ═══════════════════════════════════════════════════
    function avoidWall(e, dirX, dirY, dt) {
        // Пробуем 4 направления — ищем свободное
        const dirs = [
            { x: 1, y: 0 }, { x: -1, y: 0 },
            { x: 0, y: 1 }, { x: 0, y: -1 }
        ];

        // Сортируем по близости к цели
        dirs.sort((a, b) => {
            const da = Math.abs(a.x - dirX) + Math.abs(a.y - dirY);
            const db = Math.abs(b.x - dirX) + Math.abs(b.y - dirY);
            return da - db;
        });

        for (const d of dirs) {
            const speed = e.speed * 60 * dt;
            const nx = e.x + d.x * speed;
            const ny = e.y + d.y * speed;
            if (BRM.canMove(nx, ny)) {
                e.x = nx;
                e.y = ny;
                e.walkPhase += dt * 10;
                return;
            }
        }
    }

    // ═══════════════════════════════════════════════════
    //  ПАТРУЛЬ (idle)
    // ═══════════════════════════════════════════════════
    function idleWander(e, dt) {
        // Раз в 1-3 секунды меняет направление
        if (!e._wanderT || e._wanderT <= 0) {
            e._wanderT = 1 + Math.random() * 2;
            // Случайное направление
            const dirs = [
                { x: 1, y: 0 }, { x: -1, y: 0 },
                { x: 0, y: 1 }, { x: 0, y: -1 }
            ];
            e._wanderDir = dirs[Math.floor(Math.random() * dirs.length)];
        }

        e._wanderT -= dt;

        // Медленно двигается в выбранном направлении
        if (e._wanderDir) {
            const slowSpeed = e.speed * 0.4 * 60 * dt;
            const nx = e.x + e._wanderDir.x * slowSpeed;
            const ny = e.y + e._wanderDir.y * slowSpeed;
            if (BRM.canMove(nx, ny)) {
                e.x = nx;
                e.y = ny;
                e.walkPhase += dt * 5;
                e.facing = e._wanderDir.x >= 0 ? 1 : -1;
            } else {
                // Уткнулись в стену — меняем направление
                e._wanderT = 0;
            }
        }
    }

    // ═══════════════════════════════════════════════════
    //  СТОЛКНОВЕНИЕ С ИГРОКОМ
    // ═══════════════════════════════════════════════════
    function checkPlayerCollision(e) {
        if (BRM.gameState !== 'playing') return;

        const dx = e.x - BRM.player.x;
        const dy = e.y - BRM.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.7) {
            // Смерть
            let reason = 'Тебя настигла сущность';
            if (e.type === 'smiler') reason = 'Smiler добрался до тебя';
            else if (e.type === 'hound') reason = 'Hound разорвал тебя';

            if (BRM.triggerDeath) BRM.triggerDeath(reason);
        }
    }

    // ═══════════════════════════════════════════════════
    //  ВЗАИМОДЕЙСТВИЕ: КАПКАН/ШОКЕР
    // ═══════════════════════════════════════════════════
    BRM.stunEntity = function(entity, duration) {
        entity.stun = duration || 3;
        entity.state = 'idle';
        entity.lastSeen = null;
    };

    // Проверка капканов (для items.js)
    BRM.checkTraps = function(traps) {
        if (!traps || !BRM.entities) return;
        BRM.entities.forEach(e => {
            if (e.state === 'dead') return;
            traps.forEach(t => {
                if (t.used) return;
                const d = Math.hypot(e.x - t.x, e.y - t.y);
                if (d < 0.6) {
                    t.used = true;
                    BRM.stunEntity(e, 4);
                    if (BRM.Sound && BRM.Sound.hit) BRM.Sound.hit();
                    if (BRM.addToast) BRM.addToast('⚙️ Капкан сработал!', '#999');
                }
            });
        });
    };

    BRM.MODULES_LOADED = BRM.MODULES_LOADED || [];
    BRM.MODULES_LOADED.push('entities');
    console.log('[BRM] entities.js loaded ✓');

})();
