/* ═══════════════════════════════════════════════════════════
   BACKROOMS · AUDIO.JS
   Союзная республика №3: Звук
   - Web Audio API (звуки)
   - Фоновая музыка
   - TTS (голоса сущностей)
   ═══════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    if (!window.BRM) {
        console.error('[BRM] audio.js: config.js НЕ загружен!');
        return;
    }

    // ═══════════════════════════════════════════════════
    //  SOUND — звуки через Web Audio API
    // ═══════════════════════════════════════════════════
    BRM.Sound = {
        ctx: null,
        muted: false,
        humOsc: null,
        humGain: null,
        ambientStarted: false,

        init: function() {
            if (!this.ctx) {
                try {
                    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                } catch(e) {
                    this.muted = true;
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        },

        // Базовый тон
        tone: function(freq, dur, type, vol, freqEnd) {
            if (this.muted || !this.ctx) return;
            const v = (vol || 0.05) *
                      (BRM.settings.masterVolume / 100) *
                      (BRM.settings.soundVolume / 100);
            if (v <= 0.001) return;
            try {
                const t = this.ctx.currentTime;
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.type = type || 'sine';
                o.frequency.setValueAtTime(freq, t);
                if (freqEnd) {
                    o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
                }
                g.gain.setValueAtTime(v, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                o.connect(g).connect(this.ctx.destination);
                o.start(t);
                o.stop(t + dur);
            } catch(e) {}
        },

        // Шаги
        step: function() {
            this.tone(60 + Math.random() * 30, 0.05, 'triangle', 0.03, 30);
        },

        // Подбор предмета
        pickup: function() {
            [880, 1100, 1320].forEach((f, i) => {
                setTimeout(() => this.tone(f, 0.08, 'sine', 0.08), i * 60);
            });
        },

        // Выстрел
        shot: function() {
            this.tone(400, 0.15, 'sawtooth', 0.15, 80);
        },

        // Попадание
        hit: function() {
            this.tone(150, 0.25, 'sawtooth', 0.15, 60);
        },

        // Отказ / пусто
        deny: function() {
            this.tone(200, 0.2, 'square', 0.08, 100);
        },

        // Открытие шкафа
        open: function() {
            this.tone(500, 0.15, 'triangle', 0.08, 250);
        },

        // Победа
        win: function() {
            [523, 659, 784, 1047, 1319].forEach((f, i) => {
                setTimeout(() => this.tone(f, 0.2, 'triangle', 0.15), i * 120);
            });
        },

        // ═══════════════════════════════════════════════
        //  СКРИМЕР — мощный, страшный
        // ═══════════════════════════════════════════════
        scream: function() {
            if (!BRM.settings.scares) return;
            const v = BRM.settings.scareVolume / 100;
            this.tone(800, 0.6, 'sawtooth', 0.25 * v, 200);
            setTimeout(() => this.tone(600, 0.4, 'square', 0.22 * v, 150), 100);
            setTimeout(() => this.tone(1000, 0.5, 'sawtooth', 0.25 * v, 300), 200);
            setTimeout(() => this.tone(300, 0.7, 'sawtooth', 0.20 * v, 80), 400);
        },

        // ═══════════════════════════════════════════════
        //  ФОНОВЫЙ ГУЛ (лампа, воздух)
        // ═══════════════════════════════════════════════
        startAmbient: function() {
            if (this.ambientStarted || !this.ctx) return;
            try {
                this.humOsc = this.ctx.createOscillator();
                this.humGain = this.ctx.createGain();
                this.humOsc.type = 'sine';
                this.humOsc.frequency.value = 55;
                this.humGain.gain.value = 0.015 *
                    (BRM.settings.masterVolume / 100) *
                    (BRM.settings.musicVolume / 100);
                this.humOsc.connect(this.humGain).connect(this.ctx.destination);
                this.humOsc.start();
                this.ambientStarted = true;
            } catch(e) {}
        },

        stopAmbient: function() {
            try {
                if (this.humOsc) { this.humOsc.stop(); this.humOsc = null; }
            } catch(e) {}
            this.ambientStarted = false;
        }
    };

    // ═══════════════════════════════════════════════════
    //  TTS — Web Speech API (голоса сущностей)
    // ═══════════════════════════════════════════════════
    BRM.TTS = {
        enabled: true,
        lastSay: 0,
        supported: 'speechSynthesis' in window,

        say: function(text, options) {
            if (!this.supported || !BRM.settings.tts) return;
            const now = Date.now();
            if (now - this.lastSay < 2000) return;   // не чаще 1 раза в 2 сек
            this.lastSay = now;

            try {
                const u = new SpeechSynthesisUtterance(text);
                u.lang = 'ru-RU';
                u.rate = (options && options.rate) || 0.8;
                u.pitch = (options && options.pitch) || 0.3;
                u.volume = (BRM.settings.scareVolume / 100) *
                           (BRM.settings.masterVolume / 100);

                // Ищем русский голос
                const voices = speechSynthesis.getVoices();
                const ru = voices.find(v => v.lang.startsWith('ru'));
                if (ru) u.voice = ru;

                speechSynthesis.speak(u);
            } catch(e) {}
        }
    };

    // Загружаем голоса (некоторые браузеры ленивые)
    if (BRM.TTS.supported) {
        speechSynthesis.onvoiceschanged = () => {};
        speechSynthesis.getVoices();
    }

    // ═══════════════════════════════════════════════════
    //  ФОНОВАЯ МУЗЫКА (отдельный <audio> элемент)
    // ═══════════════════════════════════════════════════
    BRM.Music = {
        audio: null,
        playing: false,

        init: function() {
            if (!this.audio) {
                this.audio = new Audio(BRM.MUSIC_URL);
                this.audio.loop = true;
                this.audio.volume = BRM.settings.musicVolume / 100 * 0.5;
            }
        },

        play: function() {
            if (!this.audio) this.init();
            const p = this.audio.play();
            if (p) {
                p.then(() => { this.playing = true; }).catch(() => {});
            }
        },

        pause: function() {
            if (this.audio) {
                this.audio.pause();
                this.playing = false;
            }
        },

        toggle: function() {
            if (this.playing) this.pause();
            else this.play();
        }
    };

    // ═══════════════════════════════════════════════════
    //  ФРАЗЫ СУЩНОСТЕЙ (голосовые)
    // ═══════════════════════════════════════════════════
    BRM.entitySay = function(entity, type) {
        if (!BRM.settings.tts) return;
        if (entity._lastSay && Date.now() - entity._lastSay < 5000) return;
        entity._lastSay = Date.now();

        const phrases = BRM.ENTITY_PHRASES[type] || BRM.ENTITY_PHRASES.chase;
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];

        BRM.TTS.say(phrase, { rate: 0.7, pitch: 0.2 });

        // Показываем в игре
        if (BRM.toasts) {
            BRM.toasts.push({
                text: '"' + phrase + '"',
                color: '#ff0044',
                life: 2.5
            });
        }
    };

    // ═══════════════════════════════════════════════════
    //  ОБНОВЛЕНИЕ ГРОМКОСТИ
    // ═══════════════════════════════════════════════════
    BRM.updateVolume = function() {
        if (BRM.Sound.humGain) {
            BRM.Sound.humGain.gain.value = 0.015 *
                (BRM.settings.masterVolume / 100) *
                (BRM.settings.musicVolume / 100);
        }
        if (BRM.Music.audio) {
            BRM.Music.audio.volume = BRM.settings.musicVolume / 100 * 0.5;
        }
    };

    BRM.MODULES_LOADED = BRM.MODULES_LOADED || [];
    BRM.MODULES_LOADED.push('audio');
    console.log('[BRM] audio.js loaded ✓');

})();
