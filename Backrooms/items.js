/* ═══════════════════════════════════════════════════════════
   BACKROOMS · ITEMS.JS
   Союзная республика №6: Предметы и мебель
   - Мебель (шкафы, тумбочки, столы)
   - Лут из мебели (открытие по E)
   - Предметы на полу
   - Инвентарь: аптечка, пистолет, патроны, энергетик
   - Действия: useMedkit, shootPistol, tryOpenFurniture
   ═══════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    if (!window.BRM) {
        console.error('[BRM] items.js: config.js НЕ загружен!');
        return;
    }

    // ═══════════════════════════════════════════════════
    //  ГЕНЕРАЦИЯ МЕБЕЛИ
    // ═══════════════════════════════════════════════════
    BRM.generateFurniture = function(freeCells, exitX, exitY) {
        BRM.furniture = [];

        const usedCells = new Set();
        usedCells.add('1,1');
        usedCells.add(exitX + ',' + exitY);

        // 20-30 предметов мебели
        const count = 20 + Math.floor(Math.random() * 10);

        for (let i = 0; i < count; i++) {
            let tries = 0;
            while (tries < 20) {
                const c = freeCells[Math.floor(Math.random() * freeCells.length)];
                if (!c) break;

                const key = c.x + ',' + c.y;
                if (usedCells.has(key)) { tries++; continue; }

                // Не близко к старту
                const distFromStart = Math.abs(c.x - 1) + Math.abs(c.y - 1);
                if (distFromStart < 2) { tries++; continue; }

                usedCells.add(key);

                // Тип мебели
                const r = Math.random();
                let type;
                if (r < 0.4) type = 'cabinet';       // шкаф
                else if (r < 0.7) type = 'drawer';   // тумбочка
                else type = 'table';                  // стол

                const cfg = BRM.FURNITURE_TYPES[type];
                BRM.furniture.push({
                    type: type,
                    x: c.x + 0.5,
                    y: c.y + 0.5,
                    mapX: c.x,
                    mapY: c.y,
                    color: cfg.color,
                    glow: cfg.glow,
                    opened: false,
                    empty: false,
                    lootItem: null,
                    decorative: !!cfg.decorative
                });
                break;
            }
        }

        console.log('[BRM] Создано мебели:', BRM.furniture.length);
    };

    // ═══════════════════════════════════════════════════
    //  ГЕНЕРАЦИЯ ПРЕДМЕТОВ НА ПОЛУ
    // ═══════════════════════════════════════════════════
    BRM.generateFloorItems = function(freeCells, exitX, exitY) {
        BRM.items = [];

        const lootTypes = ['medkit', 'ammo', 'energy'];
        const count = 3 + Math.floor(Math.random() * 3);

        for (let i = 0; i < count; i++) {
            let tries = 0;
            while (tries < 30) {
                const c = freeCells[Math.floor(Math.random() * freeCells.length)];
                if (!c) break;

                const distFromStart = Math.abs(c.x - 1) + Math.abs(c.y - 1);
                const distFromExit = Math.abs(c.x - exitX) + Math.abs(c.y - exitY);

                if (distFromStart > 3 && distFromExit > 2 && !BRM.items.some(it => it.x === c.x && it.y === c.y)) {
                    const type = lootTypes[Math.floor(Math.random() * lootTypes.length)];
                    BRM.items.push({
                        x: c.x + 0.5,
                        y: c.y + 0.5,
                        type: type,
                        taken: false,
                        bob: Math.random() * Math.PI * 2
                    });
                    break;
                }
                tries++;
            }
        }

        console.log('[BRM] Создано предметов:', BRM.items.length);
    };

    // ═══════════════════════════════════════════════════
    //  ПОДБОР ПРЕДМЕТА
    // ═══════════════════════════════════════════════════
    BRM.pickupItem = function(type) {
        if (BRM.inventory[type] === undefined) {
            BRM.inventory[type] = 0;
        }
        BRM.inventory[type]++;

        // Если подобрали пистолет — даём патроны
        if (type === 'pistol') {
            BRM.inventory.ammo += 6;
        }

        if (BRM.Sound && BRM.Sound.pickup) BRM.Sound.pickup();

        const cfg = BRM.ITEM_TYPES[type];
        if (BRM.addToast && cfg) {
            BRM.addToast('📦 ' + cfg.name, cfg.color);
        }
    };

    // ═══════════════════════════════════════════════════
    //  ПРОВЕРКА БЛИЖАЙШЕЙ МЕБЕЛИ (для кнопки E)
    // ═══════════════════════════════════════════════════
    BRM.checkFurnitureNear = function() {
        if (!BRM.furniture) return null;

        for (const f of BRM.furniture) {
            if (f.opened || f.empty || f.decorative) continue;
            const d = Math.hypot(f.x - BRM.player.x, f.y - BRM.player.y);
            if (d < 1.2) return f;
        }
        return null;
    };

    // ═══════════════════════════════════════════════════
    //  ОТКРЫТИЕ МЕБЕЛИ (по E)
    // ═══════════════════════════════════════════════════
    BRM.tryOpenFurniture = function() {
        const f = BRM.checkFurnitureNear();
        if (!f) return;

        f.opened = true;

        // Ролл лута
        let looted = null;
        const cfg = BRM.FURNITURE_TYPES[f.type];

        if (cfg && cfg.loot && Math.random() < cfg.lootChance) {
            // Выбираем случайный предмет из списка лута
            const roll = Math.random();
            let cumulative = 0;
            for (const l of cfg.loot) {
                cumulative += l.chance;
                if (roll < cumulative) {
                    looted = l.item;
                    break;
                }
            }
        }

        if (looted) {
            f.lootItem = looted;
            BRM.pickupItem(looted);
            if (BRM.addToast && BRM.ITEM_TYPES[looted]) {
                BRM.addToast('📦 Найдено: ' + BRM.ITEM_TYPES[looted].name, BRM.ITEM_TYPES[looted].color);
            }
        } else {
            f.empty = true;
            if (BRM.Sound && BRM.Sound.deny) BRM.Sound.deny();
            if (BRM.addToast) BRM.addToast('📦 Пусто...', '#666');
        }
    };

    // ═══════════════════════════════════════════════════
    //  ИСПОЛЬЗОВАНИЕ АПТЕЧКИ (Q)
    // ═══════════════════════════════════════════════════
    BRM.useMedkit = function() {
        if (BRM.inventory.medkit <= 0) {
            if (BRM.addToast) BRM.addToast('❌ Нет аптечки', '#ff4757');
            if (BRM.Sound && BRM.Sound.deny) BRM.Sound.deny();
            return;
        }
        if (BRM.player.health >= BRM.player.maxHealth) {
            if (BRM.addToast) BRM.addToast('💊 Здоровье полное', '#666');
            return;
        }

        BRM.inventory.medkit--;
        BRM.player.health = Math.min(BRM.player.maxHealth, BRM.player.health + 50);

        if (BRM.Sound && BRM.Sound.pickup) BRM.Sound.pickup();
        if (BRM.addToast) BRM.addToast('💊 +50 HP', '#34c759');
        if (BRM.spawnParticles) BRM.spawnParticles(BRM.player.x, BRM.player.y, '#34c759', 8);
    };

    // ═══════════════════════════════════════════════════
    //  ИСПОЛЬЗОВАНИЕ ЭНЕРГЕТИКА
    // ═══════════════════════════════════════════════════
    BRM.useEnergy = function() {
        if (BRM.inventory.energy <= 0) return;
        BRM.inventory.energy--;
        BRM.player.flash = BRM.FLASH_MAX;
        if (BRM.Sound && BRM.Sound.pickup) BRM.Sound.pickup();
        if (BRM.addToast) BRM.addToast('🥤 Фонарик полный', '#ff00aa');
    };

    // ═══════════════════════════════════════════════════
    //  ВЫСТРЕЛ ИЗ ПИСТОЛЕТА (F)
    // ═══════════════════════════════════════════════════
    BRM.shootPistol = function() {
        if (BRM.inventory.pistol <= 0) {
            if (BRM.addToast) BRM.addToast('❌ Нет пистолета', '#ff4757');
            if (BRM.Sound && BRM.Sound.deny) BRM.Sound.deny();
            return;
        }
        if (BRM.inventory.ammo <= 0) {
            if (BRM.addToast) BRM.addToast('❌ Нет патронов', '#ff4757');
            if (BRM.Sound && BRM.Sound.deny) BRM.Sound.deny();
            return;
        }

        BRM.inventory.ammo--;
        if (BRM.Sound && BRM.Sound.shot) BRM.Sound.shot();
        BRM.screenShake = 6;

        const p = BRM.player;
        const speed = 1.5;   // клеток в секунду

        // Создаём пулю
        BRM.bullets.push({
            x: p.x,
            y: p.y,
            vx: Math.cos(p.angle) * speed * 4,
            vy: Math.sin(p.angle) * speed * 4,
            damage: 15,
            life: 2
        });

        // Также — raycast-проверка мгновенного попадания
        // (пули могут не успеть — а мы проверяем сразу)
        checkInstantHit(p.angle);
    };

    function checkInstantHit(angle) {
        if (!BRM.entities) return;
        const p = BRM.player;

        BRM.entities.forEach(e => {
            if (e.state === 'dead') return;

            const dx = e.x - p.x;
            const dy = e.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) return;

            const angleTo = Math.atan2(dy, dx) - angle;
            let a = angleTo;
            while (a > Math.PI) a -= Math.PI * 2;
            while (a < -Math.PI) a += Math.PI * 2;

            if (Math.abs(a) < 0.3) {
                // Проверка стен
                if (!BRM.hasLineOfSight(p.x, p.y, e.x, e.y)) return;

                e.hp -= 15;
                if (BRM.spawnParticles) BRM.spawnParticles(e.x, e.y, '#ff4757', 8);

                if (e.hp <= 0) {
                    e.state = 'dead';
                    if (BRM.addToast) BRM.addToast('☠️ Сущность убита', '#ff4757');
                } else {
                    if (BRM.addToast) BRM.addToast('💥 Попадание!', '#ffd700');
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════
    //  ИСПОЛЬЗОВАНИЕ ШОКЕРА
    // ═══════════════════════════════════════════════════
    BRM.useTaser = function() {
        if (BRM.inventory.taser <= 0) return;

        // Ищем ближайшего врага в радиусе 3
        let closest = null;
        let closestDist = Infinity;

        if (BRM.entities) {
            BRM.entities.forEach(e => {
                if (e.state === 'dead') return;
                const d = Math.hypot(e.x - BRM.player.x, e.y - BRM.player.y);
                if (d < 3 && d < closestDist) {
                    closestDist = d;
                    closest = e;
                }
            });
        }

        if (closest) {
            BRM.inventory.taser--;
            BRM.stunEntity(closest, 4);
            if (BRM.Sound && BRM.Sound.hit) BRM.Sound.hit();
            if (BRM.addToast) BRM.addToast('⚡ Враг оглушён!', '#00d4ff');
            if (BRM.spawnParticles) BRM.spawnParticles(closest.x, closest.y, '#00d4ff', 10);
        } else {
            if (BRM.addToast) BRM.addToast('⚡ Слишком далеко', '#666');
        }
    };

    // ═══════════════════════════════════════════════════
    //  ОБНОВЛЕНИЕ ЧАСТИЦ
    // ═══════════════════════════════════════════════════
    BRM.updateParticles = function(dt) {
        BRM.particles.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt * 1.5;
        });
        BRM.particles = BRM.particles.filter(p => p.life > 0);
    };

    BRM.MODULES_LOADED = BRM.MODULES_LOADED || [];
    BRM.MODULES_LOADED.push('items');
    console.log('[BRM] items.js loaded ✓');

})();
