/* ═══════════════════════════════════════════════════════════
   BACKROOMS · CONFIG.JS
   Союзная республика №1: Константы, настройки, утилиты
   ═══════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    // Создаём главный объект Союза
    window.BRM = window.BRM || {};

    // ═══════════════════════════════════════════════════
    //  КАНВАС
    // ═══════════════════════════════════════════════════
    BRM.W = 600;
    BRM.H = 820;

    // ═══════════════════════════════════════════════════
    //  КАРТА И РЕНДЕР
    // ═══════════════════════════════════════════════════
    BRM.MAP_SIZE = 25;              // размер лабиринта 25×25
    BRM.FOV = Math.PI / 3;          // угол обзора 60°
    BRM.RAY_COUNT = 100;            // число лучей (ниже = быстрее)
    BRM.MAX_DEPTH = 15;             // дальность видимости в клетках

    // ═══════════════════════════════════════════════════
    //  ФИЗИКА
    // ═══════════════════════════════════════════════════
    BRM.MOVE_SPEED = 0.045;         // скорость ходьбы
    BRM.ROT_SPEED = 0.06;           // скорость поворота мыши
    BRM.STICK_RADIUS = 65;          // радиус мобильного стика

    // ═══════════════════════════════════════════════════
    //  ИГРОК
    // ═══════════════════════════════════════════════════
    BRM.PLAYER_START = { x: 1.5, y: 1.5 };
    BRM.PLAYER_MAX_HP = 100;
    BRM.FLASH_DRAIN = 2.2;          // скорость разрядки фонарика
    BRM.FLASH_MAX = 100;

    // ═══════════════════════════════════════════════════
    //  СУЩНОСТИ
    // ═══════════════════════════════════════════════════
    BRM.ENTITY_TYPES = {
        smiler: {
            speed: 0.015,           // медленный
            hp: 30,
            detectRange: 6,         // видит на 6 клеток
            color: '#000000',
            glowColor: '#ffffff',
            emoji: ':)'
        },
        hound: {
            speed: 0.03,            // быстрый (в 2 раза)
            hp: 30,
            detectRange: 10,        // видит дальше
            color: '#1a0000',
            glowColor: '#ff0000',
            emoji: '👹'
        }
    };

    // Фразы сущностей (для TTS)
    BRM.ENTITY_PHRASES = {
        chase:   ['Беги!', 'Тебе не сбежать!', 'Я иду за тобой!', 'Ты мой!', 'Стой!'],
        spotted: ['Прячься!', 'Я вижу тебя!', 'Ты здесь!', 'Нашёл тебя!'],
        lost:    ['Где ты?', 'Выходи!', 'Я знаю что ты рядом...'],
        attack:  ['Умри!', 'Конец!', 'Ты мой!']
    };

    // ═══════════════════════════════════════════════════
    //  ПРЕДМЕТЫ
    // ═══════════════════════════════════════════════════
    BRM.ITEM_TYPES = {
        medkit: { name: 'Аптечка',    emoji: '💊', color: '#ff4757', glow: '#ff8899' },
        pistol: { name: 'Пистолет',   emoji: '🔫', color: '#555555', glow: '#888888' },
        ammo:   { name: 'Патроны',    emoji: '📦', color: '#f5a623', glow: '#ffd966' },
        taser:  { name: 'Шокер',      emoji: '⚡', color: '#00d4ff', glow: '#66e0ff' },
        energy: { name: 'Энергетик',  emoji: '🥤', color: '#ff00aa', glow: '#ff66cc' }
    };

    // ═══════════════════════════════════════════════════
    //  МЕБЕЛЬ (шкафы, тумбочки)
    // ═══════════════════════════════════════════════════
    BRM.FURNITURE_TYPES = {
        cabinet: {
            color: '#4a3520',
            glow: '#6b4a2a',
            icon: '🗄️',
            lootChance: 0.5,        // шанс что что-то есть
            loot: [
                { item: 'pistol', chance: 0.34 },
                { item: 'taser',  chance: 0.25 },
                { item: 'ammo',   chance: 0.50 }
            ]
        },
        drawer: {
            color: '#5a3a1a',
            glow: '#8b6a3a',
            icon: '🪑',
            lootChance: 0.7,
            loot: [
                { item: 'medkit', chance: 0.55 },
                { item: 'energy', chance: 0.40 }
            ]
        },
        table: {
            color: '#3a2a1a',
            glow: '#5a4a2a',
            icon: '🪵',
            decorative: true
        }
    };

    // ═══════════════════════════════════════════════════
    //  НАСТРОЙКИ (сохраняются в localStorage)
    // ═══════════════════════════════════════════════════
    BRM.settings = {
        masterVolume: 70,
        musicVolume: 50,
        soundVolume: 80,
        scares: true,
        scareVolume: 100,
        tts: true,
        language: 'ru',
        controlMode: 'auto'         // 'auto' | 'pc' | 'mobile'
    };

    // Загружаем из localStorage если есть
    try {
        const saved = localStorage.getItem('rive_settings');
        if (saved) BRM.settings = Object.assign(BRM.settings, JSON.parse(saved));
    } catch(e) {}

    // Функция сохранения
    BRM.saveSettings = function() {
        try {
            localStorage.setItem('rive_settings', JSON.stringify(BRM.settings));
        } catch(e) {}
    };

    // ═══════════════════════════════════════════════════
    //  ЗВУК — Настройки (сам звук в audio.js)
    // ═══════════════════════════════════════════════════
    BRM.MUSIC_URL = 'https://files.catbox.moe/ocldkx.mp3';   // фоновая музыка
    BRM.LOGO_URL  = 'https://i.postimg.cc/C5hZhftg/95fb2d2dc4e611f1aec1eaa78eba1e38-1.jpg';

    // ═══════════════════════════════════════════════════
    //  ЦВЕТА (для рендера)
    // ═══════════════════════════════════════════════════
    BRM.COLORS = {
        wallMain:    [200, 180, 90],    // основной цвет обоев
        wallStripe:  [170, 150, 70],    // полоски
        wallFog:     [20, 15, 5],       // туман вдали
        exitColor:   [52, 199, 89],     // выход (зелёный)
        floorTop:    '#6a6a2a',
        floorBot:    '#2a2a0a',
        ceilTop:     '#3a3a1a',
        ceilBot:     '#8a8a4a'
    };

    // ═══════════════════════════════════════════════════
    //  УТИЛИТЫ (общие функции)
    // ═══════════════════════════════════════════════════
    BRM.clamp = function(v, min, max) {
        return Math.max(min, Math.min(max, v));
    };

    BRM.rand = function(min, max) {
        return Math.random() * (max - min) + min;
    };

    BRM.randInt = function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    BRM.shadeColor = function(hex, percent) {
        const n = parseInt(hex.replace('#',''), 16);
        let r = (n >> 16) & 0xff;
        let g = (n >> 8) & 0xff;
        let b = n & 0xff;
        r = BRM.clamp(r + percent, 0, 255);
        g = BRM.clamp(g + percent, 0, 255);
        b = BRM.clamp(b + percent, 0, 255);
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    };

    // ═══════════════════════════════════════════════════
    //  ФЛАГИ СОСТОЯНИЯ (общие)
    // ═══════════════════════════════════════════════════
    BRM.isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

    let controlMode = BRM.settings.controlMode;
    if (controlMode === 'pc') BRM.controlMode = 'pc';
    else if (controlMode === 'mobile') BRM.controlMode = 'mobile';
    else BRM.controlMode = BRM.isMobile ? 'mobile' : 'pc';

    // ═══════════════════════════════════════════════════
    //  ВЕРСИЯ
    // ═══════════════════════════════════════════════════
    BRM.VERSION = '2.0.0-modular';
    BRM.MODULES_LOADED = ['config'];

    console.log('[BRM] config.js loaded ✓ | Version:', BRM.VERSION);
})();
