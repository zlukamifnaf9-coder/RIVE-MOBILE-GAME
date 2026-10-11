/* ═══════════════════════════════════════════════════════════
   BACKROOMS · RENDER.JS
   Союзная республика №4: Графика
   - Raycasting (3D из 2D)
   - Отрисовка стен, пола, потолка
   - Отрисовка мебели, предметов, сущностей
   - HUD, инвентарь, скример, экран смерти
   ═══════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    if (!window.BRM) {
        console.error('[BRM] render.js: config.js НЕ загружен!');
        return;
    }

    const ctx = BRM.ctx;
    const W = BRM.W;
    const H = BRM.H;

    if (!ctx) {
        console.error('[BRM] render.js: ctx не найден!');
        return;
    }

    // ═══════════════════════════════════════════════════
    //  RAYCASTING
    // ═══════════════════════════════════════════════════
    BRM.castRays = function() {
        const rays = [];
        const p = BRM.player;
        const MAX_ITER = 80;

        for (let i = 0; i < BRM.RAY_COUNT; i++) {
            let dirX = Math.cos(p.angle + (2 * i / BRM.RAY_COUNT - 1) * BRM.FOV / 2);
            let dirY = Math.sin(p.angle + (2 * i / BRM.RAY_COUNT - 1) * BRM.FOV / 2);
            if (Math.abs(dirX) < 0.0001) dirX = 0.0001;
            if (Math.abs(dirY) < 0.0001) dirY = 0.0001;

            let mapX = Math.floor(p.x), mapY = Math.floor(p.y);
            const dX = Math.abs(1 / dirX), dY = Math.abs(1 / dirY);
            let stepX, stepY, sdX, sdY;

            if (dirX < 0) { stepX = -1; sdX = (p.x - mapX) * dX; }
            else { stepX = 1; sdX = (mapX + 1 - p.x) * dX; }
            if (dirY < 0) { stepY = -1; sdY = (p.y - mapY) * dY; }
            else { stepY = 1; sdY = (mapY + 1 - p.y) * dY; }

            let hit = 0, side = 0, cellType = 1, depth = 0, iter = 0;
            while (hit === 0 && depth < BRM.MAX_DEPTH && iter < MAX_ITER) {
                iter++;
                if (sdX < sdY) { sdX += dX; mapX += stepX; side = 0; }
                else { sdY += dY; mapY += stepY; side = 1; }

                if (mapX < 0 || mapX >= BRM.MAP_SIZE || mapY < 0 || mapY >= BRM.MAP_SIZE) {
                    hit = 1; break;
                }
                if (!BRM.map[mapY]) { hit = 1; break; }
                const cell = BRM.map[mapY][mapX];
                if (cell === 1 || cell === 2) {
                    hit = 1;
                    cellType = cell;
                }
                depth++;
            }

            let dist;
            if (side === 0) dist = (mapX - p.x + (1 - stepX) / 2) / dirX;
            else dist = (mapY - p.y + (1 - stepY) / 2) / dirY;
            if (!isFinite(dist) || dist < 0.01) dist = BRM.MAX_DEPTH;
            if (dist > BRM.MAX_DEPTH) dist = BRM.MAX_DEPTH;

            let wallX;
            if (side === 0) wallX = p.y + dist * dirY;
            else wallX = p.x + dist * dirX;
            wallX -= Math.floor(wallX);
            if (!isFinite(wallX)) wallX = 0;

            rays.push({
                cameraX: 2 * i / BRM.RAY_COUNT - 1,
                dist: dist,
                side: side,
                cellType: cellType,
                wallX: wallX
            });
        }
        return rays;
    };

    // ═══════════════════════════════════════════════════
    //  МИР → ЭКРАН (для предметов)
    // ═══════════════════════════════════════════════════
    BRM.worldToScreen = function(wx, wy) {
        const p = BRM.player;
        const dx = wx - p.x, dy = wy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (!isFinite(dist)) return null;

        const angle = Math.atan2(dy, dx) - p.angle;
        let a = angle;
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;

        if (Math.abs(a) > BRM.FOV / 2 + 0.3 || dist > BRM.MAX_DEPTH) return null;

        return {
            x: W / 2 + (a / (BRM.FOV / 2)) * (W / 2),
            dist: dist
        };
    };

    // ═══════════════════════════════════════════════════
    //  ОСНОВНАЯ ОТРИСОВКА
    // ═══════════════════════════════════════════════════
    BRM.draw = function() {
        // Экран смерти — рисуем только его
        if (BRM.deathScreen) {
            BRM.drawDeathScreen();
            return;
        }

        // Задний фон
        ctx.fillStyle = '#0a0a10';
        ctx.fillRect(0, 0, W, H);

        ctx.save();

        // Тряска экрана
        if (BRM.screenShake > 0.1) {
            ctx.translate(
                (Math.random() - 0.5) * BRM.screenShake,
                (Math.random() - 0.5) * BRM.screenShake
            );
        }

        // Тряска от ходьбы (bob)
        const bob = Math.sin(BRM.player.bobPhase) * 4;
        ctx.translate(0, bob);

        // ═══ ОТРИСОВКА 3D ═══
        draw3D();

        // ═══ ОБЪЕКТЫ В МИРЕ ═══
        drawWorldObjects();

        ctx.restore();

        // ═══ ЭФФЕКТЫ ПОВЕРХ ═══
        drawVHS();

        // Виньетка
        const v = ctx.createRadialGradient(W / 2, H / 2 + 40, W * 0.15,
                                            W / 2, H / 2 + 40, W * 0.7);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, W, H);

        // Кровь на экране
        if (BRM.screenBlood > 0) {
            ctx.fillStyle = `rgba(255,0,0,${BRM.screenBlood * 0.3})`;
            ctx.fillRect(0, 0, W, H);
        }

        // Скример
        if (BRM.scareFlash > 0) drawScare();

        // UI
        drawUI();

        // Инвентарь
        if (BRM.inventoryOpen) drawInventory();

        // Тосты
        drawToasts();

        // Мобильные кнопки
        if (BRM.controlMode === 'mobile') drawMobileControls();
    };

    // ═══════════════════════════════════════════════════
    //  РИСУЕМ 3D СЦЕНУ
    // ═══════════════════════════════════════════════════
    function draw3D() {
        const rays = BRM.castRays();
        const columnW = W / BRM.RAY_COUNT;
        const horizonY = H / 2 + 40;

        // Потолок
        const cG = ctx.createLinearGradient(0, 0, 0, horizonY);
        cG.addColorStop(0, BRM.COLORS.ceilTop);
        cG.addColorStop(1, BRM.COLORS.ceilBot);
        ctx.fillStyle = cG;
        ctx.fillRect(0, 0, W, horizonY);

        // Пол
        const fG = ctx.createLinearGradient(0, horizonY, 0, H);
        fG.addColorStop(0, BRM.COLORS.floorTop);
        fG.addColorStop(1, BRM.COLORS.floorBot);
        ctx.fillStyle = fG;
        ctx.fillRect(0, horizonY, W, H - horizonY);

        // Стены
        const p = BRM.player;
        for (let i = 0; i < rays.length; i++) {
            const r = rays[i];
            const wallH = Math.min(H / r.dist * 0.9, H * 1.5);
            const wT = horizonY - wallH / 2;
            const wB = horizonY + wallH / 2;
            const x = i * columnW;

            let baseR = BRM.COLORS.wallMain[0];
            let baseG = BRM.COLORS.wallMain[1];
            let baseB = BRM.COLORS.wallMain[2];

            // Полоски обоев
            if (Math.floor(r.wallX * 4) % 2 === 0) {
                baseR = BRM.COLORS.wallStripe[0];
                baseG = BRM.COLORS.wallStripe[1];
                baseB = BRM.COLORS.wallStripe[2];
            }

            // Туман
            const fog = Math.max(0, 1 - r.dist / BRM.MAX_DEPTH);
            baseR = Math.floor(baseR * fog + BRM.COLORS.wallFog[0] * (1 - fog));
            baseG = Math.floor(baseG * fog + BRM.COLORS.wallFog[1] * (1 - fog));
            baseB = Math.floor(baseB * fog + BRM.COLORS.wallFog[2] * (1 - fog));

            // Тень на одной стороне
            if (r.side === 1) {
                baseR *= 0.75;
                baseG *= 0.75;
                baseB *= 0.75;
            }

            // Выход — зелёный
            if (r.cellType === 2) {
                const pulse = 0.8 + Math.sin(performance.now() / 300) * 0.2;
                baseR = Math.floor(20 * fog);
                baseG = Math.floor(180 * fog * pulse);
                baseB = Math.floor(40 * fog);
            }

            // Фонарик
            if (p.flashlightOn && p.flash > 0) {
                const fb = Math.max(0, 1 - Math.pow(Math.abs(r.cameraX) * 1.4, 2));
                const inten = Math.min(1, p.flash / 50);
                const b = fb * inten;
                baseR = Math.min(255, Math.floor(baseR + b * 130));
                baseG = Math.min(255, Math.floor(baseG + b * 120));
                baseB = Math.min(255, Math.floor(baseB + b * 70));
            }

            // Ambient — затемнение вдали
            const amb = 1 - Math.min(0.7, r.dist / BRM.MAX_DEPTH * 0.5);
            baseR = Math.floor(baseR * amb);
            baseG = Math.floor(baseG * amb);
            baseB = Math.floor(baseB * amb);

            ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
            ctx.fillRect(x, wT, columnW + 1, wB - wT);
        }

        // Лампа на потолке
        drawCeilingLamp(horizonY);
    }

    // Лампа
    function drawCeilingLamp(horizonY) {
        const lampY = horizonY - 150;
        const lampX = W / 2;
        const flicker = 0.7 + Math.random() * 0.3;
        const size = 40 * flicker;

        const lg = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, size * 3);
        lg.addColorStop(0, `rgba(255, 250, 200, ${0.4 * flicker})`);
        lg.addColorStop(0.3, `rgba(255, 250, 200, ${0.15 * flicker})`);
        lg.addColorStop(1, 'rgba(255, 250, 200, 0)');
        ctx.fillStyle = lg;
        ctx.fillRect(lampX - size * 3, lampY - size * 3, size * 6, size * 6);

        ctx.fillStyle = `rgba(255, 255, 220, ${0.8 * flicker})`;
        ctx.fillRect(lampX - 30, lampY - 8, 60, 16);
    }

    // ═══════════════════════════════════════════════════
    //  ОБЪЕКТЫ В МИРЕ (мебель, предметы, сущности, выход)
    // ═══════════════════════════════════════════════════
    function drawWorldObjects() {
        const horizonY = H / 2 + 40;
        const queue = [];

        // Мебель
        if (BRM.furniture) {
            BRM.furniture.forEach(f => {
                if (!BRM.hasLineOfSight(BRM.player.x, BRM.player.y, f.x, f.y)) return;
                const s = BRM.worldToScreen(f.x, f.y);
                if (s) queue.push({ dist: s.dist, type: 'furniture', obj: f, sx: s.x });
            });
        }

        // Предметы
        if (BRM.items) {
            BRM.items.forEach(it => {
                if (it.taken) return;
                if (!BRM.hasLineOfSight(BRM.player.x, BRM.player.y, it.x, it.y)) return;
                const s = BRM.worldToScreen(it.x, it.y);
                if (s) queue.push({ dist: s.dist, type: 'item', obj: it, sx: s.x });
            });
        }

        // Сущности
        if (BRM.entities) {
            BRM.entities.forEach(e => {
                if (e.state === 'dead') return;
                if (!BRM.hasLineOfSight(BRM.player.x, BRM.player.y, e.x, e.y)) return;
                const s = BRM.worldToScreen(e.x, e.y);
                if (s) queue.push({ dist: s.dist, type: 'entity', obj: e, sx: s.x });
            });
        }

        // Выход
        if (BRM.hasLineOfSight(BRM.player.x, BRM.player.y, BRM.exitPos.x, BRM.exitPos.y)) {
            const s = BRM.worldToScreen(BRM.exitPos.x, BRM.exitPos.y);
            if (s) queue.push({ dist: s.dist, type: 'exit', sx: s.x });
        }

        // Пули
        if (BRM.bullets) {
            BRM.bullets.forEach(b => {
                const s = BRM.worldToScreen(b.x, b.y);
                if (s) queue.push({ dist: s.dist, type: 'bullet', obj: b, sx: s.x });
            });
        }

        // Сортируем — дальние первыми
        queue.sort((a, b) => b.dist - a.dist);
        queue.forEach(item => {
            if (item.type === 'furniture') drawFurnitureWorld(item.obj, item.sx, item.dist, horizonY);
            else if (item.type === 'item') drawItemWorld(item.obj, item.sx, item.dist, horizonY);
            else if (item.type === 'entity') drawEntityWorld(item.obj, item.sx, item.dist, horizonY);
            else if (item.type === 'exit') drawExit(item.sx, item.dist, horizonY);
            else if (item.type === 'bullet') drawBullet(item.obj, item.sx, item.dist, horizonY);
        });
    }

    // Мебель
    function drawFurnitureWorld(f, sx, dist, horizonY) {
        const size = Math.min(1, 3 / dist);
        const baseY = horizonY + 40;
        const h = 60 * size;
        const w = 40 * size;

        // Тень
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.ellipse(sx, baseY + 5, w * 0.6, 6 * size, 0, 0, Math.PI * 2);
        ctx.fill();

        // Тело
        ctx.fillStyle = f.color || '#4a3520';
        ctx.fillRect(sx - w / 2, baseY - h, w, h);

        // Обводка
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - w / 2, baseY - h, w, h);

        // Дверца
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, baseY - h + 3);
        ctx.lineTo(sx, baseY - 3);
        ctx.stroke();

        // Ручки
        ctx.fillStyle = '#f5d76e';
        ctx.beginPath();
        ctx.arc(sx - w * 0.15, baseY - h / 2, 2 * size, 0, Math.PI * 2);
        ctx.arc(sx + w * 0.15, baseY - h / 2, 2 * size, 0, Math.PI * 2);
        ctx.fill();

        // Подсветка если можно открыть
        if (!f.opened && !f.empty && f.type !== 'table') {
            const pulse = 0.5 + Math.sin(performance.now() / 300) * 0.5;
            ctx.strokeStyle = `rgba(245, 215, 110, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(sx - w / 2 - 2, baseY - h - 2, w + 4, h + 4);
        }

        // Открыт — показываем лут
        if (f.opened && f.lootItem && BRM.ITEM_TYPES[f.lootItem]) {
            ctx.font = `${Math.floor(20 * size)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(BRM.ITEM_TYPES[f.lootItem].emoji, sx, baseY - h / 2);
        }
    }

    // Предмет
    function drawItemWorld(it, sx, dist, horizonY) {
        const size = Math.min(1, 3 / dist);
        const bob = Math.sin(it.bob + performance.now() / 500) * 3;
        const baseY = horizonY + 40 + bob;
        const cfg = BRM.ITEM_TYPES[it.type];
        if (!cfg) return;

        // Свечение
        const gl = ctx.createRadialGradient(sx, baseY - 10, 0, sx, baseY - 10, 40 * size);
        gl.addColorStop(0, cfg.glow + 'cc');
        gl.addColorStop(0.5, cfg.glow + '44');
        gl.addColorStop(1, cfg.glow + '00');
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.arc(sx, baseY - 10, 40 * size, 0, Math.PI * 2);
        ctx.fill();

        // Эмодзи
        ctx.font = `${Math.floor(35 * size)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cfg.emoji, sx, baseY - 10);
    }

    // Сущность (стикмен с телом, руками, ногами)
    function drawEntityWorld(e, sx, dist, horizonY) {
        const size = Math.min(1, 4 / dist);
        const baseY = horizonY + 40;
        const h = 80 * size;
        const headR = 12 * size;
        const feetY = baseY;
        const headY = feetY - h;
        const bodyY = feetY - h * 0.55;

        // Аура при погоне
        if (e.state === 'chase') {
            const pulse = 0.5 + Math.sin(performance.now() / 200) * 0.5;
            ctx.fillStyle = `rgba(255, 0, 0, ${0.15 * pulse})`;
            ctx.beginPath();
            ctx.arc(sx, bodyY, 60 * size, 0, Math.PI * 2);
            ctx.fill();
        }

        const ec = e.type === 'smiler' ? '#000' : '#1a0000';
        ctx.strokeStyle = ec;
        ctx.fillStyle = ec;
        ctx.lineWidth = 4 * size;
        ctx.lineCap = 'round';

        // Тень
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.ellipse(sx, feetY + 3, 20 * size, 4 * size, 0, 0, Math.PI * 2);
        ctx.fill();

        // Голова
        ctx.fillStyle = ec;
        ctx.beginPath();
        ctx.arc(sx, headY + headR, headR, 0, Math.PI * 2);
        ctx.fill();

        // Лицо
        if (e.type === 'smiler') {
            const pulse = 0.8 + Math.sin(e.animTime * 3) * 0.2;
            ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
            ctx.font = `bold ${Math.floor(18 * size)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(':)', sx, headY + headR);
        } else {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(sx - 4 * size, headY + headR - 2 * size, 2 * size, 0, Math.PI * 2);
            ctx.arc(sx + 4 * size, headY + headR - 2 * size, 2 * size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Тело
        ctx.strokeStyle = ec;
        ctx.beginPath();
        ctx.moveTo(sx, headY + headR * 2);
        ctx.lineTo(sx, bodyY + 10 * size);
        ctx.stroke();

        // Руки (тянутся вперёд)
        const armSwing = Math.sin(e.animTime * 6 + e.walkPhase) * 8 * size;
        const armReach = 20 * size;
        ctx.beginPath();
        ctx.moveTo(sx, headY + headR * 2 + 5 * size);
        ctx.lineTo(sx + e.facing * armReach, headY + headR * 2 + 15 * size + armSwing);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, headY + headR * 2 + 5 * size);
        ctx.lineTo(sx + e.facing * armReach * 0.8, headY + headR * 2 + 20 * size - armSwing);
        ctx.stroke();

        // Ноги
        const legSwing = Math.sin(e.animTime * 10 + e.walkPhase) * 10 * size;
        const hipY = bodyY + 10 * size;
        ctx.beginPath();
        ctx.moveTo(sx, hipY);
        ctx.lineTo(sx - 8 * size + legSwing, feetY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, hipY);
        ctx.lineTo(sx + 8 * size - legSwing, feetY);
        ctx.stroke();
    }

    // Выход
    function drawExit(sx, dist, horizonY) {
        const size = Math.min(1, 3 / dist);
        const w = 100 * size, h = 160 * size;
        ctx.fillStyle = 'rgba(52, 199, 89, 0.85)';
        ctx.fillRect(sx - w / 2, horizonY - h + h * 0.15, w, h);
        ctx.strokeStyle = '#34c759';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - w / 2, horizonY - h + h * 0.15, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(10, size * 14)}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ВЫХОД', sx, horizonY - h + h * 0.15 + h / 2);
    }

    // Пуля
    function drawBullet(b, sx, dist, horizonY) {
        const size = Math.min(1, 3 / dist);
        const baseY = horizonY + 20;
        ctx.fillStyle = '#f5d76a';
        ctx.shadowColor = '#f5d76a';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(sx, baseY, 4 * size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // ═══════════════════════════════════════════════════
    //  VHS-ЭФФЕКТ
    // ═══════════════════════════════════════════════════
    function drawVHS() {
        for (let i = 0; i < 100; i++) {
            ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
            ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
        }
    }

    // ═══════════════════════════════════════════════════
    //  СКРИМЕР
    // ═══════════════════════════════════════════════════
    function drawScare() {
        const i = BRM.scareFlash;
        ctx.fillStyle = `rgba(255, 0, 0, ${i * 0.4})`;
        ctx.fillRect(0, 0, W, H);

        if (i > 0.3) {
            ctx.fillStyle = `rgba(0, 0, 0, ${i * 0.9})`;
            ctx.fillRect(0, 0, W, H);

            const faceR = 200 * (1.3 - i * 0.3);
            const cx = W / 2, cy = H / 2;

            // Голова
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(cx, cy, faceR, 0, Math.PI * 2);
            ctx.fill();

            // Глаза
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx - faceR * 0.4, cy - faceR * 0.2, faceR * 0.2, 0, Math.PI * 2);
            ctx.arc(cx + faceR * 0.4, cy - faceR * 0.2, faceR * 0.2, 0, Math.PI * 2);
            ctx.fill();

            // Зрачки
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(cx - faceR * 0.4, cy - faceR * 0.2, faceR * 0.1, 0, Math.PI * 2);
            ctx.arc(cx + faceR * 0.4, cy - faceR * 0.2, faceR * 0.1, 0, Math.PI * 2);
            ctx.fill();

            // Кровь из глаз
            ctx.fillStyle = '#8b0000';
            ctx.fillRect(cx - faceR * 0.45, cy - faceR * 0.05, faceR * 0.1, faceR * 1.2);
            ctx.fillRect(cx + faceR * 0.35, cy - faceR * 0.05, faceR * 0.1, faceR * 1.2);

            // Улыбка
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = faceR * 0.08;
            ctx.beginPath();
            ctx.arc(cx, cy + faceR * 0.4, faceR * 0.6, 0.3, Math.PI - 0.3);
            ctx.stroke();

            // Зубы
            ctx.fillStyle = '#fff';
            const ty = cy + faceR * 0.7;
            for (let j = -2; j <= 2; j++) {
                ctx.beginPath();
                ctx.moveTo(cx + j * faceR * 0.15 - faceR * 0.06, ty);
                ctx.lineTo(cx + j * faceR * 0.15, ty - faceR * 0.15);
                ctx.lineTo(cx + j * faceR * 0.15 + faceR * 0.06, ty);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    // ═══════════════════════════════════════════════════
    //  ЭКРАН СМЕРТИ
    // ═══════════════════════════════════════════════════
    BRM.drawDeathScreen = function() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, W, H);

        const grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W);
        grad.addColorStop(0, 'rgba(139, 0, 0, 0.7)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // ТЫ УМЕР
        ctx.font = 'bold 72px "Courier New", monospace';
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 40;
        ctx.fillText('ТЫ УМЕР', W / 2, H / 2 - 80);
        ctx.shadowBlur = 0;

        // Причина
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(BRM.deathScreen.reason, W / 2, H / 2);

        // Совет
        ctx.font = '14px "Courier New", monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Совет: ' + BRM.deathScreen.tip, W / 2, H / 2 + 50);

        // Подсказка
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.fillStyle = '#ffd700';
        const pulse = 0.5 + Math.sin(performance.now() / 300) * 0.5;
        ctx.globalAlpha = pulse;
        ctx.fillText('ПРОБЕЛ / ТАП — ЗАНОВО', W / 2, H / 2 + 140);
        ctx.globalAlpha = 1;
    };

    // ═══════════════════════════════════════════════════
    //  UI
    // ═══════════════════════════════════════════════════
    function drawUI() {
        const p = BRM.player;

        // Верхняя панель
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, W, 50);

        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f5d76e';
        ctx.fillText('LEVEL 0', 15, 25);

        // HP
        const hpX = 15, hpY = 60, hpW = 200, hpH = 16;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(hpX - 2, hpY - 2, hpW + 4, hpH + 4);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(hpX, hpY, hpW, hpH);
        const hpPct = Math.max(0, p.health / p.maxHealth);
        ctx.fillStyle = hpPct > 0.5 ? '#34c759' : hpPct > 0.25 ? '#f5a623' : '#e74c3c';
        ctx.fillRect(hpX, hpY, hpW * hpPct, hpH);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(hpX, hpY, hpW, hpH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.fillText('HP ' + Math.floor(p.health), hpX + 6, hpY + hpH / 2);

        // Фонарик
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.font = '13px "Courier New", monospace';
        ctx.fillText('🔦', W - 200, 25);
        const fX = W - 180, fY = 18, fW = 165, fH = 14;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(fX, fY, fW, fH);
        ctx.fillStyle = p.flash > 30 ? '#f5d76e' : '#e74c3c';
        ctx.fillRect(fX, fY, fW * (p.flash / 100), fH);
        ctx.strokeStyle = '#f5d76e';
        ctx.lineWidth = 1;
        ctx.strokeRect(fX + 0.5, fY + 0.5, fW - 1, fH - 1);
    }

    // ═══════════════════════════════════════════════════
    //  ИНВЕНТАРЬ
    // ═══════════════════════════════════════════════════
    function drawInventory() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px "Courier New", monospace';
        ctx.fillStyle = '#f5d76e';
        ctx.fillText('🎒 ИНВЕНТАРЬ', W / 2, 60);

        const slots = [
            { key: 'medkit', label: 'Аптечка',   action: '+50 HP (Q)' },
            { key: 'pistol', label: 'Пистолет',  action: 'Стрелять (F)' },
            { key: 'ammo',   label: 'Патроны',   action: 'Боеприпасы' },
            { key: 'energy', label: 'Энергетик', action: 'Фонарик' },
            { key: 'taser',  label: 'Шокер',     action: 'Оглушить' }
        ];

        const itemH = 70;
        const startY = 130;

        slots.forEach((s, i) => {
            const y = startY + i * (itemH + 6);
            const count = BRM.inventory[s.key] || 0;
            const has = count > 0;
            const cfg = BRM.ITEM_TYPES[s.key];

            ctx.fillStyle = has ? 'rgba(245,215,110,0.15)' : 'rgba(255,255,255,0.05)';
            ctx.fillRect(40, y, W - 80, itemH);
            ctx.strokeStyle = has ? '#f5d76e' : 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 2;
            ctx.strokeRect(40, y, W - 80, itemH);

            ctx.font = '36px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = has ? '#fff' : '#555';
            ctx.fillText(cfg.emoji, 60, y + itemH / 2);

            ctx.font = 'bold 15px "Courier New", monospace';
            ctx.fillStyle = has ? '#fff' : '#666';
            ctx.fillText(s.label, 120, y + 25);

            ctx.font = '11px "Courier New", monospace';
            ctx.fillStyle = '#999';
            ctx.fillText(s.action, 120, y + 48);

            ctx.font = 'bold 22px "Courier New", monospace';
            ctx.fillStyle = has ? '#ffd700' : '#444';
            ctx.textAlign = 'right';
            ctx.fillText('×' + count, W - 60, y + itemH / 2);
        });

        ctx.textAlign = 'center';
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText('I — закрыть', W / 2, H - 60);
    }

    // ═══════════════════════════════════════════════════
    //  ТОСТЫ
    // ═══════════════════════════════════════════════════
    function drawToasts() {
        BRM.toasts.forEach((t, i) => {
            const a = Math.min(1, t.life);
            ctx.globalAlpha = a;
            const bW = Math.max(240, ctx.measureText(t.text).width + 40);
            const bH = 38;
            const bX = W / 2 - bW / 2;
            const bY = 100 + i * 46;

            ctx.fillStyle = 'rgba(0,0,0,0.9)';
            ctx.fillRect(bX, bY, bW, bH);
            ctx.strokeStyle = t.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(bX, bY, bW, bH);
            ctx.fillStyle = t.color;
            ctx.font = 'bold 13px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t.text, W / 2, bY + bH / 2);
        });
        ctx.globalAlpha = 1;
    }

    // ═══════════════════════════════════════════════════
    //  МОБИЛЬНОЕ УПРАВЛЕНИЕ
    // ═══════════════════════════════════════════════════
    function drawMobileControls() {
        // Стик
        const bx = BRM.leftStick.baseX;
        const by = BRM.leftStick.baseY;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(bx, by, BRM.STICK_RADIUS + 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(bx, by, BRM.STICK_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(245, 215, 110, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, BRM.STICK_RADIUS, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = BRM.leftStick.active ? 'rgba(245, 215, 110, 0.75)' : 'rgba(245, 215, 110, 0.35)';
        ctx.beginPath();
        ctx.arc(BRM.leftStick.knobX, BRM.leftStick.knobY, 28, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#f5d76e';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Кнопки справа
        const btns = [
            { ...BRM.buttons.interact, label: '🔦', active: BRM.player.flashlightOn },
            { ...BRM.buttons.inv,      label: '🎒', active: false },
            { ...BRM.buttons.use,      label: '▶',  active: BRM.inventory.pistol > 0 && BRM.inventory.ammo > 0 },
            { ...BRM.buttons.ebtn,     label: 'E',  active: !!BRM.checkFurnitureNear && !!BRM.checkFurnitureNear() }
        ];

        btns.forEach(b => {
            ctx.fillStyle = b.active ? 'rgba(52,199,89,0.4)' : 'rgba(245,215,110,0.15)';
            ctx.beginPath();
            ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = b.active ? '#34c759' : '#f5d76e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.font = '28px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
        });
    }

    BRM.MODULES_LOADED = BRM.MODULES_LOADED || [];
    BRM.MODULES_LOADED.push('render');
    console.log('[BRM] render.js loaded ✓');

})();
