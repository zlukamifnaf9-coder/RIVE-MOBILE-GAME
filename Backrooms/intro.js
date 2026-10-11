/* ═══════════════════════════════════════════════════════════
   BACKROOMS · INTRO.JS
   Союзная республика №7: Интро и меню
   - Заставка с логотипом RIVE
   - Кнопка «Начать»
   - Плавный переход к игре
   ═══════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    if (!window.BRM) {
        console.error('[BRM] intro.js: config.js НЕ загружен!');
        return;
    }

    // ═══════════════════════════════════════════════════
    //  ИНТРО
    // ═══════════════════════════════════════════════════
    const intro = document.getElementById('intro');

    if (!intro) {
        // Интро нет — сразу запускаем игру
        console.log('[BRM] intro не найден, запуск сразу');
        setTimeout(() => {
            if (BRM.start) BRM.start();
        }, 100);
        return;
    }

    const introStart = document.getElementById('introStart');

    if (introStart) {
        introStart.addEventListener('click', () => {
            // Инициализируем звук
            if (BRM.Sound && BRM.Sound.init) BRM.Sound.init();

            // Пытаемся запустить фоновую музыку
            if (BRM.Music) {
                BRM.Music.play();
            }

            // Плавно убираем интро
            intro.classList.add('hidden');

            setTimeout(() => {
                intro.style.display = 'none';
                // Запускаем игру
                if (BRM.start) BRM.start();
            }, 800);
        });
    } else {
        // Нет кнопки — запускаем по клику на интро
        intro.addEventListener('click', () => {
            if (BRM.Sound && BRM.Sound.init) BRM.Sound.init();
            if (BRM.Music) BRM.Music.play();
            intro.classList.add('hidden');
            setTimeout(() => {
                intro.style.display = 'none';
                if (BRM.start) BRM.start();
            }, 800);
        });
    }

    // ═══════════════════════════════════════════════════
    //  КНОПКА МУЗЫКИ (в углу)
    // ═══════════════════════════════════════════════════
    BRM.toggleMusic = function() {
        if (BRM.Music) BRM.Music.toggle();
    };

    // ═══════════════════════════════════════════════════
    //  СКРЫТЬ ИНТРО (для вызова извне)
    // ═══════════════════════════════════════════════════
    BRM.hideIntro = function() {
        if (intro) {
            intro.classList.add('hidden');
            setTimeout(() => {
                intro.style.display = 'none';
            }, 800);
        }
    };

    BRM.MODULES_LOADED = BRM.MODULES_LOADED || [];
    BRM.MODULES_LOADED.push('intro');
    console.log('[BRM] intro.js loaded ✓');

})();
