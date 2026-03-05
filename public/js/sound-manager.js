/**
 * SoundManager - Oyun Ses Yönetim Modülü
 * ARTAMEDO Elektrik Devresi Quiz Oyunu
 * 
 * Web Audio API ile dinamik ses üretimi + dosya tabanlı sesler desteği
 */

class SoundManager {
    constructor() {
        // Web Audio API context
        this.audioContext = null;
        this.masterGain = null;
        this.musicGain = null;
        this.effectGain = null;

        // Ses türleri ve konfigürasyonları
        this.soundTypes = {
            background_music: {
                name: 'Arka Plan Müziği',
                loop: true,
                category: 'music',
                generator: 'ambientMusic'
            },
            correct_answer: {
                name: 'Doğru Cevap',
                loop: false,
                category: 'effect',
                generator: 'successChime'
            },
            wrong_answer: {
                name: 'Yanlış Cevap',
                loop: false,
                category: 'effect',
                generator: 'errorBuzz'
            },
            timer_tick: {
                name: 'Süre Sayacı',
                loop: false,
                category: 'effect',
                generator: 'tick'
            },
            timer_warning: {
                name: 'Süre Uyarısı',
                loop: false,
                category: 'effect',
                generator: 'warning'
            },
            timer_end: {
                name: 'Süre Bitti',
                loop: false,
                category: 'effect',
                generator: 'alarm'
            },
            next_player: {
                name: 'Sıradaki Oyuncu',
                loop: false,
                category: 'effect',
                generator: 'transition'
            },
            qr_scan: {
                name: 'QR Okuma',
                loop: false,
                category: 'effect',
                generator: 'beep'
            },
            game_start: {
                name: 'Oyun Başlangıç',
                loop: false,
                category: 'effect',
                generator: 'fanfare'
            },
            game_end: {
                name: 'Oyun Bitiş',
                loop: false,
                category: 'effect',
                generator: 'gameOver'
            },
            victory: {
                name: 'Kazanma',
                loop: false,
                category: 'effect',
                generator: 'victory'
            },
            button_click: {
                name: 'Buton Tıklama',
                loop: false,
                category: 'effect',
                generator: 'click'
            },
            question_appear: {
                name: 'Soru Göründü',
                loop: false,
                category: 'effect',
                generator: 'whoosh'
            }
        };

        // Audio elementleri (dosya tabanlı sesler için)
        this.sounds = {};

        // Aktif oscillator'lar (loop sesler için)
        this.activeOscillators = {};

        // Ayarlar
        this.settings = {
            enabled: true,
            musicVolume: 0.5,
            effectVolume: 0.7,
            useWebAudio: true // Web Audio API kullan
        };

        // Ses dosya yolları (özel yüklenmiş dosyalar için)
        this.soundPaths = {};

        // Dosya tabanlı ses var mı?
        this.hasCustomSound = {};

        // Not: init() fonksiyonu dışarıdan çağrılmalı (new SoundManager() sonrası await soundManager.init())
        // Constructor'da async çağrı yapılmıyor
    }

    async init() {
        // localStorage'dan ayarları yükle
        this.loadSettings();

        // Web Audio API'yi başlat
        this.initWebAudio();

        // Sunucudan ses ayarlarını yükle
        await this.loadSoundPaths();

        // Audio elementlerini oluştur (özel dosyalar için)
        this.createAudioElements();
        
        // background_music keepAlive mekanizmasını başlat
        this.startBackgroundMusicKeepAlive();
    }

    initWebAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Master gain node
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);

            // Müzik gain node
            this.musicGain = this.audioContext.createGain();
            this.musicGain.gain.value = this.settings.musicVolume;
            this.musicGain.connect(this.masterGain);

            // Efekt gain node
            this.effectGain = this.audioContext.createGain();
            this.effectGain.gain.value = this.settings.effectVolume;
            this.effectGain.connect(this.masterGain);

            console.log('Web Audio API başarıyla başlatıldı');
        } catch (e) {
            console.warn('Web Audio API başlatılamadı:', e);
            this.settings.useWebAudio = false;
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('soundSettings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (e) {
                console.warn('Ses ayarları yüklenemedi:', e);
            }
        }
    }

    saveSettings() {
        localStorage.setItem('soundSettings', JSON.stringify(this.settings));
    }

    async loadSoundPaths() {
        try {
            const response = await fetch('/api/sound-settings');
            if (response.ok) {
                const data = await response.json();
                
                console.log('📡 Sunucudan ses ayarları alındı:', data);
                
                // Her ses tipi için ayarları yükle
                for (const [type, setting] of Object.entries(data)) {
                    if (!this.soundTypes[type]) continue;
                    
                    // Özel ses dosyası varsa kaydet
                    if (setting.customFile) {
                        this.soundPaths[type] = setting.customFile;
                        this.hasCustomSound[type] = true;
                    }
                    
                    // enabled ve volume bilgilerini kaydet (sunucu değerleri kullan)
                    this.soundTypes[type].enabled = setting.enabled !== false;
                    // ✅ Sunucu volume var mı kontrol et, yoksa varsayılan 50 kullan
                    this.soundTypes[type].volume = (setting.volume !== null && setting.volume !== undefined) ? setting.volume : 50;
                    
                    console.log(`✅ ${type} yüklendi: volume=${this.soundTypes[type].volume}`);
                }
            } else {
                console.warn('⚠️ Ses ayarları yanıtı ok değil:', response.status);
            }
        } catch (e) {
            console.warn('❌ Ses dosya yolları yüklenemedi:', e);
        }

        // Varsayılan yolları ayarla (henüz set edilmemiş olanlar için)
        for (const type of Object.keys(this.soundTypes)) {
            if (!this.soundPaths[type]) {
                this.soundPaths[type] = `/sounds/default/${type}.mp3`;
            }
            // enabled varsayılanı (volume zaten ayarlandı)
            if (this.soundTypes[type].enabled === undefined) {
                this.soundTypes[type].enabled = true;
            }
        }
        
        // Sunucu değerlerini settings ile senkronize et
        // background_music volume değerini musicVolume'a yansıt
        if (this.soundTypes.background_music?.volume !== undefined && this.soundTypes.background_music.volume > 0) {
            this.settings.musicVolume = this.soundTypes.background_music.volume / 100;
            console.log('🔊 musicVolume set:', this.settings.musicVolume);
        }
        // correct_answer volume değerini effectVolume'a yansıt (efekt sesleri için referans)
        if (this.soundTypes.correct_answer?.volume !== undefined && this.soundTypes.correct_answer.volume > 0) {
            this.settings.effectVolume = this.soundTypes.correct_answer.volume / 100;
            console.log('🔊 effectVolume set:', this.settings.effectVolume);
        }
        
        // Gain node'ları güncelle
        if (this.musicGain) {
            this.musicGain.gain.value = this.settings.musicVolume;
        }
        if (this.effectGain) {
            this.effectGain.gain.value = this.settings.effectVolume;
        }
        
        // localStorage'a kaydet
        this.saveSettings();
    }

    // background_music'in sürekli çalmasını sağla
    startBackgroundMusicKeepAlive() {
        // Interval mekanizmasını KALDIRDIK - çok agresif, sürekli restart ediyor
        // Sadece user interaction ile başlat
        
        let hasUserInteracted = false;
        
        // User interaction event'lerinde background music'i başlat
        const resumeBackgroundMusic = () => {
            const audio = this.sounds['background_music'];
            if (!audio) return;
            
            const config = this.soundTypes['background_music'];
            if (!config || config.enabled === false) return;

            // AudioContext askıda ise aç
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(() => {});
            }
            
            // SADECE paused ise play çağır
            if (audio.paused && audio.readyState >= 2) {
                console.log('background_music keepAlive (user interaction) - resume ediliyor...');
                audio.play().catch(e => {});
                hasUserInteracted = true;
            } else if (audio.readyState >= 2) {
                // Bazı tarayıcılar paused flag'i yanlış bildiriyor olabilir, zorla dene
                setTimeout(() => {
                    if (audio.paused) {
                        audio.play().catch(() => {});
                    }
                }, 30);
            }
        };
        
        // Click, touch ve visibility change event'lerinde resume et
        document.addEventListener('click', resumeBackgroundMusic, { passive: true, once: false });
        document.addEventListener('touchstart', resumeBackgroundMusic, { passive: true, once: false });
        // Pointer etkileşiminden hemen sonra da kontrol et (pause sonrası)
        document.addEventListener('pointerdown', () => {
            setTimeout(() => resumeBackgroundMusic(), 30);
        }, { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                resumeBackgroundMusic();
            }
        });
    }

    createAudioElements() {
        for (const [type, config] of Object.entries(this.soundTypes)) {
            const audio = new Audio();
            
            // Sadece özel dosya varsa src'yi ayarla, yoksa boş bırak
            // Web Audio API ile üretilecek sesler için audio element gerekli değil
            if (this.soundPaths[type] && this.hasCustomSound[type]) {
                audio.src = this.soundPaths[type];
                audio.preload = 'auto';
            }
            
            audio.loop = config.loop;

            // Arka plan müziği beklenmedik pause alırsa kaldığı yerden devam et
            if (type === 'background_music') {
                audio.addEventListener('pause', () => {
                    if (audio.ended) return; // doğal bitişte dokunma
                    const cfg = this.soundTypes['background_music'];
                    if (this.settings.muted || (cfg && cfg.enabled === false)) return;
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        this.audioContext.resume().catch(() => {});
                    }
                    if (audio.paused && audio.readyState >= 2) {
                        audio.play().catch(() => {});
                    } else if (audio.readyState >= 2) {
                        setTimeout(() => {
                            if (audio.paused) audio.play().catch(() => {});
                        }, 30);
                    }
                });
            }

            // Ses seviyesini ayarla
            if (config.category === 'music') {
                audio.volume = this.settings.musicVolume;
            } else {
                audio.volume = this.settings.effectVolume;
            }

            this.sounds[type] = audio;
        }
    }

    // ========================================
    // WEB AUDIO API SES ÜRETİCİLERİ
    // ========================================

    // Başarı sesi (doğru cevap)
    generateSuccessChime() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 (major chord)

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.05);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.4);

            osc.connect(gain);
            gain.connect(this.effectGain);

            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.5);
        });
    }

    // Hata sesi (yanlış cevap)
    generateErrorBuzz() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);

        osc.connect(gain);
        gain.connect(this.effectGain);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    // Tik sesi (süre sayacı)
    generateTick() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.value = 800;

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.connect(gain);
        gain.connect(this.effectGain);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    // Uyarı sesi (süre azaldığında)
    generateWarning() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;

        for (let i = 0; i < 2; i++) {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'square';
            osc.frequency.value = 880;

            gain.gain.setValueAtTime(0.2, now + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.1);

            osc.connect(gain);
            gain.connect(this.effectGain);

            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.1);
        }
    }

    // Alarm sesi (süre bitti)
    generateAlarm() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;

        for (let i = 0; i < 3; i++) {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now + i * 0.2);
            osc.frequency.setValueAtTime(400, now + i * 0.2 + 0.1);

            gain.gain.setValueAtTime(0.25, now + i * 0.2);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.2 + 0.18);

            osc.connect(gain);
            gain.connect(this.effectGain);

            osc.start(now + i * 0.2);
            osc.stop(now + i * 0.2 + 0.2);
        }
    }

    // Bip sesi (QR okuma)
    generateBeep() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.value = 1200;

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.effectGain);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    // Tık sesi (buton)
    generateClick() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.value = 600;

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

        osc.connect(gain);
        gain.connect(this.effectGain);

        osc.start(now);
        osc.stop(now + 0.03);
    }

    // Geçiş sesi (sıradaki oyuncu)
    generateTransition() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const notes = [392, 523.25]; // G4, C5

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, now + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.2, now + i * 0.12 + 0.03);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.2);

            osc.connect(gain);
            gain.connect(this.effectGain);

            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.25);
        });
    }

    // Fanfare (oyun başlangıç)
    generateFanfare() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const notes = [392, 392, 392, 523.25, 659.25]; // G4, G4, G4, C5, E5
        const durations = [0.15, 0.15, 0.15, 0.3, 0.4];
        let time = 0;

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'triangle';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, now + time);
            gain.gain.linearRampToValueAtTime(0.25, now + time + 0.02);
            gain.gain.linearRampToValueAtTime(0, now + time + durations[i]);

            osc.connect(gain);
            gain.connect(this.effectGain);

            osc.start(now + time);
            osc.stop(now + time + durations[i] + 0.1);

            time += durations[i];
        });
    }

    // Whoosh (soru göründü)
    generateWhoosh() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;

        // Beyaz gürültü ile whoosh efekti
        const bufferSize = this.audioContext.sampleRate * 0.3;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const source = this.audioContext.createBufferSource();
        const filter = this.audioContext.createBiquadFilter();
        const gain = this.audioContext.createGain();

        source.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.linearRampToValueAtTime(2000, now + 0.15);
        filter.Q.value = 1;

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.effectGain);

        source.start(now);
    }

    // Game Over sesi
    generateGameOver() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const notes = [523.25, 493.88, 440, 392]; // C5, B4, A4, G4 (inen)

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, now + i * 0.2);
            gain.gain.linearRampToValueAtTime(0.2, now + i * 0.2 + 0.05);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.2 + 0.25);

            osc.connect(gain);
            gain.connect(this.effectGain);

            osc.start(now + i * 0.2);
            osc.stop(now + i * 0.2 + 0.3);
        });
    }

    // Zafer sesi
    generateVictory() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const melody = [
            { freq: 523.25, start: 0, dur: 0.15 },     // C5
            { freq: 587.33, start: 0.15, dur: 0.15 },  // D5
            { freq: 659.25, start: 0.3, dur: 0.15 },   // E5
            { freq: 783.99, start: 0.45, dur: 0.3 },   // G5
            { freq: 659.25, start: 0.75, dur: 0.15 },  // E5
            { freq: 783.99, start: 0.9, dur: 0.5 }     // G5
        ];

        melody.forEach(note => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'triangle';
            osc.frequency.value = note.freq;

            gain.gain.setValueAtTime(0, now + note.start);
            gain.gain.linearRampToValueAtTime(0.25, now + note.start + 0.02);
            gain.gain.setValueAtTime(0.25, now + note.start + note.dur - 0.05);
            gain.gain.linearRampToValueAtTime(0, now + note.start + note.dur);

            osc.connect(gain);
            gain.connect(this.effectGain);

            osc.start(now + note.start);
            osc.stop(now + note.start + note.dur + 0.1);
        });
    }

    // Slot çevirme sesi (loop)
    generateSlotSpin() {
        if (!this.audioContext) return;
        if (this.activeOscillators['slot_spin']) return; // Zaten çalıyor

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();

        // LFO modülasyonu
        lfo.type = 'sine';
        lfo.frequency.value = 8;
        lfoGain.gain.value = 100;

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.type = 'sine';
        osc.frequency.value = 400;

        gain.gain.value = 0.15;

        osc.connect(gain);
        gain.connect(this.effectGain);

        osc.start(now);
        lfo.start(now);

        this.activeOscillators['slot_spin'] = { osc, lfo, gain };
    }

    stopSlotSpin() {
        const active = this.activeOscillators['slot_spin'];
        if (active) {
            const now = this.audioContext.currentTime;
            active.gain.gain.linearRampToValueAtTime(0, now + 0.1);
            active.osc.stop(now + 0.15);
            active.lfo.stop(now + 0.15);
            delete this.activeOscillators['slot_spin'];
        }
    }

    // Slot durma sesi
    generateSlotStop() {
        if (!this.audioContext) return;

        this.stopSlotSpin(); // Önce çevirme sesini durdur

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.25);

        osc.connect(gain);
        gain.connect(this.effectGain);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    // Arka plan müziği (ambient loop)
    generateAmbientMusic() {
        if (!this.audioContext) return;
        if (this.activeOscillators['background_music']) return;

        const now = this.audioContext.currentTime;

        // Ana drone
        const drone = this.audioContext.createOscillator();
        const droneGain = this.audioContext.createGain();
        drone.type = 'sine';
        drone.frequency.value = 110; // A2
        droneGain.gain.value = 0.08;

        // Yavaş LFO modülasyonu
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;
        lfoGain.gain.value = 5;
        lfo.connect(lfoGain);
        lfoGain.connect(drone.frequency);

        // Harmonik
        const harmonic = this.audioContext.createOscillator();
        const harmonicGain = this.audioContext.createGain();
        harmonic.type = 'sine';
        harmonic.frequency.value = 165; // E3
        harmonicGain.gain.value = 0.04;

        // Bağlantılar
        drone.connect(droneGain);
        droneGain.connect(this.musicGain);
        harmonic.connect(harmonicGain);
        harmonicGain.connect(this.musicGain);

        drone.start(now);
        lfo.start(now);
        harmonic.start(now);

        this.activeOscillators['background_music'] = {
            drone, harmonic, lfo, droneGain, harmonicGain
        };
    }

    stopAmbientMusic() {
        const active = this.activeOscillators['background_music'];
        if (active) {
            const now = this.audioContext.currentTime;
            active.droneGain.gain.linearRampToValueAtTime(0, now + 1);
            active.harmonicGain.gain.linearRampToValueAtTime(0, now + 1);

            setTimeout(() => {
                try {
                    active.drone.stop();
                    active.harmonic.stop();
                    active.lfo.stop();
                } catch (e) { }
                delete this.activeOscillators['background_music'];
            }, 1100);
        }
    }

    // ========================================
    // ANA API FONKSİYONLARI
    // ========================================

    // Ses çal
    play(type) {
        if (!this.settings.enabled) return;

        const config = this.soundTypes[type];
        if (!config) {
            console.warn(`Bilinmeyen ses tipi: ${type}`);
            return;
        }
        
        // Ses devre dışı bırakılmışsa çalma
        if (config.enabled === false) {
            console.log(`Ses devre dışı: ${type}`);
            return;
        }

        // Resume audio context if suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Önce özel dosya var mı kontrol et
        if (this.hasCustomSound[type]) {
            this.playFromFile(type);
            return;
        }

        // Web Audio API ile üret
        if (this.settings.useWebAudio && this.audioContext) {
            this.playGenerated(type, config.generator);
        } else {
            // Fallback: dosya tabanlı
            this.playFromFile(type);
        }
    }

    playGenerated(type, generator) {
        switch (generator) {
            case 'successChime':
                this.generateSuccessChime();
                break;
            case 'errorBuzz':
                this.generateErrorBuzz();
                break;
            case 'tick':
                this.generateTick();
                break;
            case 'warning':
                this.generateWarning();
                break;
            case 'alarm':
                this.generateAlarm();
                break;
            case 'beep':
                this.generateBeep();
                break;
            case 'click':
                this.generateClick();
                break;
            case 'transition':
                this.generateTransition();
                break;
            case 'fanfare':
                this.generateFanfare();
                break;
            case 'whoosh':
                this.generateWhoosh();
                break;
            case 'gameOver':
                this.generateGameOver();
                break;
            case 'victory':
                this.generateVictory();
                break;
            case 'slotSpin':
                this.generateSlotSpin();
                break;
            case 'slotStop':
                this.generateSlotStop();
                break;
            case 'ambientMusic':
                this.generateAmbientMusic();
                break;
            default:
                console.warn(`Bilinmeyen ses üretici: ${generator}`);
        }
    }

    playFromFile(type) {
        const audio = this.sounds[type];
        if (!audio) {
            console.warn(`Ses bulunamadı: ${type}`);
            return;
        }

        // Ses dosyası yüklenmemişse atla
        if (audio.readyState < 2) {
            console.warn(`Ses henüz yüklenmedi: ${type}`);
            return;
        }

        console.log(`${type} çalınıyor - loop: ${audio.loop}, src: ${audio.src}`);

        // Volume ayarını uygula (0-100'den 0-1'e çevir)
        const config = this.soundTypes[type];
        if (config && config.volume !== undefined) {
            const baseVolume = config.volume / 100;
            // Kategori bazlı volume ile birleştir
            if (config.category === 'music') {
                audio.volume = baseVolume * this.settings.musicVolume;
            } else {
                audio.volume = baseVolume * this.settings.effectVolume;
            }
        }

        // Loop olmayan sesleri baştan başlat
        if (!audio.loop) {
            audio.currentTime = 0;
        }
        
        // background_music için ek güvenlik - ended event ile otomatik restart
        if (type === 'background_music' && audio.loop) {
            // Daha önce eklenmiş event listener'ı kaldır
            audio.onended = null;
            audio.onended = () => {
                console.log('background_music ended - yeniden başlatılıyor...');
                audio.currentTime = 0;
                audio.play().catch(e => console.warn('Yeniden başlatma hatası:', e));
            };

            // paused olursa kaldığı yerden devam et (currentTime'ı sıfırlama)
            audio.onpause = () => {
                if (audio.ended) return; // doğal bitişte dokunma
                // muted ise veya config disabled ise zorlama
                const config = this.soundTypes['background_music'];
                if (this.settings.muted || (config && config.enabled === false)) return;
                setTimeout(() => {
                    if (audio.paused) {
                        audio.play().catch(() => {});
                    }
                }, 50);
            };
        }

        audio.play().then(() => {
            console.log(`${type} başarıyla çalmaya başladı`);
        }).catch(e => {
            console.warn(`Ses çalınamadı (${type}):`, e.message);
        });
    }

    // Ses durdur
    stop(type) {
        // Aktif oscillator varsa durdur
        if (type === 'background_music') {
            this.stopAmbientMusic();
        }

        // Audio element varsa durdur
        const audio = this.sounds[type];
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    }

    // Tüm sesleri durdur
    stopAll() {
        // Tüm aktif oscillator'ları durdur
        this.stopAmbientMusic();

        // Tüm audio elementlerini durdur
        for (const audio of Object.values(this.sounds)) {
            audio.pause();
            audio.currentTime = 0;
        }
    }

    // Arka plan müziğini başlat
    startMusic() {
        this.play('background_music');
    }

    // Arka plan müziğini durdur
    stopMusic() {
        this.stop('background_music');
    }

    // Sesleri aç/kapat
    toggle() {
        this.settings.enabled = !this.settings.enabled;
        this.saveSettings();

        if (!this.settings.enabled) {
            this.stopAll();
        }

        return this.settings.enabled;
    }

    // Sesleri aç
    enable() {
        this.settings.enabled = true;
        this.saveSettings();
    }

    // Sesleri kapat
    disable() {
        this.settings.enabled = false;
        this.stopAll();
        this.saveSettings();
    }

    // Müzik ses seviyesini ayarla
    setMusicVolume(volume) {
        this.settings.musicVolume = Math.max(0, Math.min(1, volume));
        this.saveSettings();

        // Web Audio gain'i güncelle
        if (this.musicGain) {
            this.musicGain.gain.value = this.settings.musicVolume;
        }

        // Audio elementlerini güncelle
        for (const [type, config] of Object.entries(this.soundTypes)) {
            if (config.category === 'music' && this.sounds[type]) {
                this.sounds[type].volume = this.settings.musicVolume;
            }
        }
    }

    // Efekt ses seviyesini ayarla
    setEffectVolume(volume) {
        this.settings.effectVolume = Math.max(0, Math.min(1, volume));
        this.saveSettings();

        // Web Audio gain'i güncelle
        if (this.effectGain) {
            this.effectGain.gain.value = this.settings.effectVolume;
        }

        // Audio elementlerini güncelle
        for (const [type, config] of Object.entries(this.soundTypes)) {
            if (config.category === 'effect' && this.sounds[type]) {
                this.sounds[type].volume = this.settings.effectVolume;
            }
        }
    }

    // Genel ses seviyesini ayarla (hem müzik hem efekt)
    setVolume(volume) {
        const normalizedVolume = Math.max(0, Math.min(1, volume));
        this.setMusicVolume(normalizedVolume);
        this.setEffectVolume(normalizedVolume);
    }

    // Sesi aç/kapa
    setMuted(muted) {
        this.settings.muted = muted;
        this.saveSettings();

        // Master gain'i kontrol et
        if (this.masterGain) {
            this.masterGain.gain.value = muted ? 0 : 1;
        }

        // Tüm audio elementlerini kontrol et
        for (const type in this.sounds) {
            if (this.sounds[type]) {
                this.sounds[type].muted = muted;
            }
        }
    }

    // Ses dosyasını güncelle
    updateSoundPath(type, path) {
        if (this.soundPaths[type] !== undefined) {
            this.soundPaths[type] = path;
            this.hasCustomSound[type] = !path.includes('/default/');

            // Audio elementini güncelle
            if (this.sounds[type]) {
                this.sounds[type].src = path;
                this.sounds[type].load();
            }
        }
    }

    // Özel sesi kaldır (varsayılana dön)
    resetSound(type) {
        this.soundPaths[type] = `/sounds/default/${type}.mp3`;
        this.hasCustomSound[type] = false;

        if (this.sounds[type]) {
            this.sounds[type].src = this.soundPaths[type];
            this.sounds[type].load();
        }
    }

    // Ayarları getir
    getSettings() {
        return { ...this.settings };
    }

    // Ses türlerini getir
    getSoundTypes() {
        return { ...this.soundTypes };
    }

    // Ses yollarını getir
    getSoundPaths() {
        return { ...this.soundPaths };
    }

    // Kullanıcı etkileşimi sonrası sesleri etkinleştir
    unlockAudio() {
        // Web Audio Context'i resume et
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Audio elementlerini de etkinleştir
        for (const audio of Object.values(this.sounds)) {
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
            }).catch(() => { });
        }
    }

    // Ses önizleme (test için)
    preview(type) {
        const wasEnabled = this.settings.enabled;
        this.settings.enabled = true;
        this.play(type);
        this.settings.enabled = wasEnabled;
    }
}

// Sayfa yüklendiğinde ilk kullanıcı etkileşiminde sesleri etkinleştir (ama global instance oluşturma)
// game.js'de soundManager = new SoundManager() ile oluşturulacak
document.addEventListener('click', function unlockAudioOnce() {
    if (typeof soundManager !== 'undefined' && soundManager !== null) {
        soundManager.unlockAudio();
    }
    document.removeEventListener('click', unlockAudioOnce);
}, { once: true });

document.addEventListener('touchstart', function unlockAudioOnce() {
    if (typeof soundManager !== 'undefined' && soundManager !== null) {
        soundManager.unlockAudio();
    }
    document.removeEventListener('touchstart', unlockAudioOnce);
}, { once: true });
