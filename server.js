const express = require('express');
const { createServer } = require('http');
const { createServer: createHttpsServer } = require('https');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const app = express();

// HTTPS sertifikaları
const CERT_PATH = path.join(__dirname, 'cert');
let httpsServer = null;
let httpServer = null;

// HTTPS sertifikası varsa kullan
if (fs.existsSync(path.join(CERT_PATH, 'cloudflare-origin-cert.pem')) &&
  fs.existsSync(path.join(CERT_PATH, 'cloudflare-origin-key.pem'))) {
  const httpsOptions = {
    cert: fs.readFileSync(path.join(CERT_PATH, 'cloudflare-origin-cert.pem')),
    key: fs.readFileSync(path.join(CERT_PATH, 'cloudflare-origin-key.pem'))
  };
  httpsServer = createHttpsServer(httpsOptions, app);
}

// HTTP sunucusu her zaman oluştur (fallback ve redirect için)
httpServer = createServer(app);

// Socket.io - HTTPS varsa onu kullan, yoksa HTTP
const activeServer = httpsServer || httpServer;
const io = new Server(activeServer, {
  transports: ['websocket', 'polling'],
  serveClient: false,
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Patterns klasörü
const PATTERNS_PATH = path.join(__dirname, 'public', 'patterns');
if (!fs.existsSync(PATTERNS_PATH)) {
  fs.mkdirSync(PATTERNS_PATH, { recursive: true });
}

// Models klasörü (3D modeller için)
const MODELS_PATH = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(MODELS_PATH)) {
  fs.mkdirSync(MODELS_PATH, { recursive: true });
}

// JSON Database
const DB_PATH = path.join(__dirname, 'database.json');

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initialDB = { questions: [], games: [], settings: { totalSteps: 24 } };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
    return initialDB;
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  // Ensure settings exist
  if (!db.settings) {
    db.settings = { totalSteps: 24 };
  }
  // Migrate legacy "battle" questions to "group_duel"
  const migrated = migrateBattleToGroupDuel(db);
  if (migrated) {
    saveDB(db);
  }
  return db;
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function migrateBattleToGroupDuel(db) {
  if (!db || !Array.isArray(db.questions)) return false;
  let changed = false;
  db.questions.forEach(q => {
    if (q && q.type === 'battle') {
      q.type = 'group_duel';
      if (!q.mode) q.mode = 'group_duel';
      changed = true;
    }
  });
  return changed;
}

// Admin Password Configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
const DEFAULT_PASSWORD = '1234';

// Initialize admin password in database if not exists
function initializeAdminPassword() {
  const db = loadDB();
  if (!db.admin) {
    db.admin = { password: DEFAULT_PASSWORD };
    saveDB(db);
  }
}

initializeAdminPassword();

// API Routes

// Admin Login API
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ success: false, error: 'Şifre gerekli' });
    }
    
    const db = loadDB();
    const storedPassword = db.admin?.password || ADMIN_PASSWORD;
    
    // Şifre doğrulama (basit string karşılaştırması)
    if (password.trim() === storedPassword.trim()) {
      res.json({ success: true, message: 'Giriş başarılı' });
    } else {
      res.status(401).json({ success: false, error: 'Şifre hatalı' });
    }
  } catch (error) {
    console.error('Admin login hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

// Admin Change Password API
app.post('/api/admin/change-password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Tüm alanlar gerekli' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Yeni şifre en az 6 karakter olmalıdır' });
    }
    
    const db = loadDB();
    const storedPassword = db.admin?.password || ADMIN_PASSWORD;
    
    // Mevcut şifreyi doğrula
    if (currentPassword.trim() !== storedPassword.trim()) {
      return res.status(401).json({ success: false, error: 'Mevcut şifre hatalı' });
    }
    
    // Yeni şifreyi kaydet
    if (!db.admin) {
      db.admin = {};
    }
    db.admin.password = newPassword;
    saveDB(db);
    
    res.json({ success: true, message: 'Şifre başarıyla değiştirildi' });
  } catch (error) {
    console.error('Şifre değiştirme hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

// Pattern Upload API - AR marker pattern dosyasını kaydet
app.post('/api/upload-pattern', (req, res) => {
  try {
    const { patternData, filename } = req.body;

    if (!patternData) {
      return res.status(400).json({ error: 'Pattern verisi gerekli' });
    }

    // Base64 data URL'den içeriği çıkar
    let content = patternData;
    if (patternData.startsWith('data:')) {
      const base64Data = patternData.split(',')[1];
      content = Buffer.from(base64Data, 'base64').toString('utf-8');
    }

    // Dosya adı oluştur
    const patternFilename = filename || `pattern-${Date.now()}.patt`;
    const patternPath = path.join(PATTERNS_PATH, patternFilename);

    // Dosyayı kaydet
    fs.writeFileSync(patternPath, content);

    // URL döndür
    const patternUrl = `/patterns/${patternFilename}`;
    res.json({ success: true, url: patternUrl });
  } catch (error) {
    console.error('Pattern yükleme hatası:', error);
    res.status(500).json({ error: 'Pattern yüklenemedi' });
  }
});

// 3D Model Upload API - GLB/GLTF dosyalarını kaydet
app.post('/api/upload-model', (req, res) => {
  try {
    const { modelData, filename } = req.body;

    if (!modelData) {
      return res.status(400).json({ error: 'Model verisi gerekli' });
    }

    // Base64 data URL'den içeriği çıkar
    if (!modelData.startsWith('data:')) {
      return res.status(400).json({ error: 'Geçersiz model formatı' });
    }

    const base64Data = modelData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Dosya adı oluştur
    const modelFilename = filename || `model-${Date.now()}.glb`;
    const modelPath = path.join(MODELS_PATH, modelFilename);

    // Dosyayı kaydet
    fs.writeFileSync(modelPath, buffer);

    // URL döndür
    const modelUrl = `/models/${modelFilename}`;
    res.json({ success: true, url: modelUrl });
  } catch (error) {
    console.error('Model yükleme hatası:', error);
    res.status(500).json({ error: 'Model yüklenemedi' });
  }
});

// Sounds klasörü
const SOUNDS_PATH = path.join(__dirname, 'public', 'sounds');
const SOUNDS_DEFAULT_PATH = path.join(SOUNDS_PATH, 'default');
const SOUNDS_CUSTOM_PATH = path.join(SOUNDS_PATH, 'custom');

if (!fs.existsSync(SOUNDS_DEFAULT_PATH)) {
  fs.mkdirSync(SOUNDS_DEFAULT_PATH, { recursive: true });
}
if (!fs.existsSync(SOUNDS_CUSTOM_PATH)) {
  fs.mkdirSync(SOUNDS_CUSTOM_PATH, { recursive: true });
}

// Sound Settings API - Ses ayarlarını getir
app.get('/api/sound-settings', (req, res) => {
  try {
    const db = loadDB();
    const soundPaths = db.soundSettings?.paths || {};
    const soundSettingsDB = db.soundSettings?.settings || {};
    
    // Her ses tipi için ayarları oluştur
    const soundTypes = [
      'background_music', 'correct_answer', 'wrong_answer', 'timer_tick',
      'timer_warning', 'timer_end', 'next_player', 'qr_scan',
      'game_start', 'game_end', 'victory', 'button_click', 'question_appear'
    ];
    
    const soundSettings = {};
    soundTypes.forEach(type => {
      const settings = soundSettingsDB[type] || {};
      soundSettings[type] = {
        enabled: settings.enabled !== false, // Varsayılan true
        volume: settings.volume || 50, // Varsayılan 50
        customFile: soundPaths[type] || null
      };
    });
    
    res.json(soundSettings);
  } catch (error) {
    console.error('Ses ayarları yükleme hatası:', error);
    res.status(500).json({ error: 'Ses ayarları yüklenemedi' });
  }
});

// Sound Settings API - Ses ayarlarını kaydet
app.post('/api/sound-settings', (req, res) => {
  try {
    const { paths } = req.body;
    const db = loadDB();
    db.soundSettings = { paths: paths || {} };
    saveDB(db);
    res.json({ success: true });
  } catch (error) {
    console.error('Ses ayarları kaydetme hatası:', error);
    res.status(500).json({ error: 'Ses ayarları kaydedilemedi' });
  }
});

// Sound Upload API - Ses dosyası yükle
app.post('/api/upload-sound', (req, res) => {
  try {
    const { soundData, soundType, filename } = req.body;

    if (!soundData || !soundType) {
      return res.status(400).json({ error: 'Ses verisi ve türü gerekli' });
    }

    // Base64 data URL'den içeriği çıkar
    if (!soundData.startsWith('data:')) {
      return res.status(400).json({ error: 'Geçersiz ses formatı' });
    }

    const base64Data = soundData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Dosya adı oluştur
    const ext = filename ? path.extname(filename) : '.mp3';
    const soundFilename = `${soundType}_custom${ext}`;
    const soundPath = path.join(SOUNDS_CUSTOM_PATH, soundFilename);

    // Dosyayı kaydet
    fs.writeFileSync(soundPath, buffer);

    // URL döndür
    const soundUrl = `/sounds/custom/${soundFilename}`;

    // Ayarları güncelle
    const db = loadDB();
    if (!db.soundSettings) db.soundSettings = { paths: {} };
    db.soundSettings.paths[soundType] = soundUrl;
    saveDB(db);

    res.json({ success: true, url: soundUrl });
  } catch (error) {
    console.error('Ses yükleme hatası:', error);
    res.status(500).json({ error: 'Ses yüklenemedi' });
  }
});

// Sound Reset API - Sesi varsayılana döndür
app.post('/api/reset-sound', (req, res) => {
  try {
    const { soundType } = req.body;

    if (!soundType) {
      return res.status(400).json({ error: 'Ses türü gerekli' });
    }

    const db = loadDB();
    if (db.soundSettings && db.soundSettings.paths) {
      delete db.soundSettings.paths[soundType];
      saveDB(db);
    }

    res.json({ success: true, url: `/sounds/default/${soundType}.mp3` });
  } catch (error) {
    console.error('Ses sıfırlama hatası:', error);
    res.status(500).json({ error: 'Ses sıfırlanamadı' });
  }
});

// Ses ayarını güncelle (enabled, volume)
app.post('/api/update-sound-setting', (req, res) => {
  try {
    const { soundType, enabled, volume } = req.body;

    if (!soundType) {
      return res.status(400).json({ error: 'Ses türü gerekli' });
    }

    const db = loadDB();
    if (!db.soundSettings) {
      db.soundSettings = { paths: {}, settings: {} };
    }
    if (!db.soundSettings.settings) {
      db.soundSettings.settings = {};
    }
    if (!db.soundSettings.settings[soundType]) {
      db.soundSettings.settings[soundType] = {};
    }

    // Güncelleme yap
    if (enabled !== undefined) {
      db.soundSettings.settings[soundType].enabled = enabled;
    }
    if (volume !== undefined) {
      db.soundSettings.settings[soundType].volume = volume;
    }

    saveDB(db);
    
    console.log(`✅ Ses ayarı kaydedildi: ${soundType} = volume:${volume}`);
    
    // ✅ Tüm bağlı istemcilere (admin paneller) Socket.IO ile bildir
    io.emit('sound-setting-updated', { soundType, volume });
    console.log(`📢 Socket.IO: Tüm istemcilere sound-setting-updated gönderildi`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Ses ayarı güncelleme hatası:', error);
    res.status(500).json({ error: 'Ayar güncellenemedi' });
  }
});

// Ses listesi API
app.get('/api/sounds', (req, res) => {
  try {
    const defaultSounds = fs.existsSync(SOUNDS_DEFAULT_PATH)
      ? fs.readdirSync(SOUNDS_DEFAULT_PATH).filter(f => /\.(mp3|wav|ogg)$/i.test(f))
      : [];
    const customSounds = fs.existsSync(SOUNDS_CUSTOM_PATH)
      ? fs.readdirSync(SOUNDS_CUSTOM_PATH).filter(f => /\.(mp3|wav|ogg)$/i.test(f))
      : [];

    res.json({ default: defaultSounds, custom: customSounds });
  } catch (error) {
    console.error('Ses listesi hatası:', error);
    res.status(500).json({ error: 'Ses listesi alınamadı' });
  }
});

// Dinamik AR sayfası - pattern URL'i ile HTML oluştur
app.get('/ar-custom', (req, res) => {
  const { pattern, type, modelUrl, title, description } = req.query;

  if (!pattern) {
    return res.redirect('/ar-viewer-custom.html');
  }

  const animationType = type || 'circuit';
  const patternUrl = decodeURIComponent(pattern);
  const customModelUrl = modelUrl ? decodeURIComponent(modelUrl) : '';
  const customTitle = title ? decodeURIComponent(title) : '';
  const customDescription = description ? decodeURIComponent(description) : '';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>AR Görüntüleyici - Özel Marker</title>
  <script src="/libs/aframe.min.js"></script>
  <script src="/libs/aframe-extras.min.js"></script>
  <script src="/libs/aframe-ar.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Poppins', sans-serif; overflow: hidden; }
    .ar-overlay {
      position: fixed; top: 0; left: 0; right: 0; z-index: 999;
      padding: 20px; background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
      color: white; text-align: center;
    }
    .ar-title { display: none; }
    .ar-instructions { font-size: 0.9rem; opacity: 0.9; }
    .ar-close-btn {
      position: fixed; top: 12px; right: 12px; z-index: 1002;
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(255, 107, 107, 0.9); border: none;
      color: white; font-size: 22px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .ar-loading {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      z-index: 999; text-align: center; color: white;
    }
    .ar-loading-spinner {
      width: 60px; height: 60px; border: 4px solid rgba(255,255,255,0.3);
      border-top-color: #4cc9f0; border-radius: 50%;
      animation: spin 1s linear infinite; margin: 0 auto 15px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animation-info {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      background: linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%);
      color: white; padding: 16px 20px; text-align: center;
      border-bottom: 1px solid rgba(99, 102, 241, 0.3);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .animation-info h3 { margin-bottom: 4px; color: #4cc9f0; font-weight: 600; font-size: 1.1rem; }
    .animation-info p { color: #94a3b8; font-size: 0.85rem; }
    
    /* AR Kontrol Paneli - Yeni Tasarım */
    .ar-controls {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 1001;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white; padding: 20px; border-radius: 24px 24px 0 0;
      border-top: 1px solid rgba(99, 102, 241, 0.3);
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
    }
    .ar-controls.hidden { display: none; }
    .control-row { display: flex; align-items: center; gap: 15px; margin-bottom: 16px; }
    .control-row:last-child { margin-bottom: 0; }
    .control-label { font-size: 0.85rem; min-width: 60px; color: #94a3b8; display: flex; align-items: center; gap: 8px; }
    .control-label svg { width: 18px; height: 18px; stroke: #4cc9f0; stroke-width: 2; }
    .control-slider {
      flex: 1; height: 8px; border-radius: 4px;
      -webkit-appearance: none; appearance: none;
      background: linear-gradient(90deg, #0f172a 0%, #1e293b 100%);
      outline: none; border: 1px solid rgba(99, 102, 241, 0.2);
    }
    .control-slider::-webkit-slider-thumb {
      -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%;
      background: linear-gradient(135deg, #4cc9f0 0%, #7b2cbf 100%);
      cursor: pointer; box-shadow: 0 2px 10px rgba(76, 201, 240, 0.5); border: 2px solid white;
    }
    .control-value { min-width: 50px; text-align: right; font-size: 0.9rem; color: #4cc9f0; font-weight: 600; }
    .control-buttons { display: flex; gap: 15px; justify-content: center; padding-top: 5px; }
    .control-btn {
      width: 56px; height: 56px; border-radius: 16px; border: 2px solid transparent;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }
    .control-btn svg { width: 24px; height: 24px; stroke-width: 2.5; }
    .control-btn:active { transform: scale(0.95); }
    .btn-play { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); border-color: rgba(74, 222, 128, 0.3); }
    .btn-play svg { stroke: white; fill: white; }
    .btn-pause { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-color: rgba(251, 191, 36, 0.3); }
    .btn-pause svg { stroke: white; }
    .btn-stop { background: linear-gradient(135deg, #f87171 0%, #ef4444 100%); border-color: rgba(248, 113, 113, 0.3); }
    .btn-stop svg { stroke: white; fill: white; }
    .toggle-controls-btn {
      position: fixed; bottom: 20px; right: 20px; z-index: 1002;
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, #4cc9f0 0%, #7b2cbf 100%);
      border: 2px solid rgba(99, 102, 241, 0.3); color: white; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(76, 201, 240, 0.4); transition: all 0.3s ease;
    }
    .toggle-controls-btn svg { width: 26px; height: 26px; stroke: white; stroke-width: 2; }
    .toggle-controls-btn.active { background: linear-gradient(135deg, #f72585 0%, #7b2cbf 100%); box-shadow: 0 4px 20px rgba(247, 37, 133, 0.4); }
    
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="ar-overlay">
    <div class="ar-title" id="ar-title">AR Animasyon</div>
    <div class="ar-instructions">Kamerayı özel marker'a doğrultun</div>
  </div>
  <button class="ar-close-btn" onclick="closeAR()">✕</button>
  <div class="ar-loading" id="ar-loading">
    <div class="ar-loading-spinner"></div>
    <p>AR Yükleniyor...</p>
  </div>
  <div class="animation-info hidden" id="animation-info">
    <h3 id="info-title">Animasyon</h3>
    <p id="info-description">Açıklama</p>
  </div>

  <!-- AR Kontrol Paneli -->
  <button class="toggle-controls-btn" id="toggle-controls" onclick="toggleControls()">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  </button>
  
  <div class="ar-controls hidden" id="ar-controls">
    <div class="control-row">
      <span class="control-label">
        <svg viewBox="0 0 24 24" fill="none"><path d="M21 21H3V3"/><path d="M21 9L15 15 9 9 3 15"/></svg>
        Boyut
      </span>
      <input type="range" class="control-slider" id="scale-slider" min="0.01" max="1" step="0.01" value="0.1">
      <span class="control-value" id="scale-value">0.1x</span>
    </div>
    <div class="control-row">
      <span class="control-label">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        Işık
      </span>
      <input type="range" class="control-slider" id="light-slider" min="0.5" max="5" step="0.1" value="3">
      <span class="control-value" id="light-value">3.0x</span>
    </div>
    <div class="control-row">
      <span class="control-label">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
        Zaman
      </span>
      <input type="range" class="control-slider" id="timeline-slider" min="0" max="100" step="0.1" value="0">
      <span class="control-value" id="timeline-value">0:00</span>
    </div>
    <div class="control-row">
      <div class="control-buttons">
        <button class="control-btn btn-play" onclick="playAnimation()">
          <svg viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21 5,3"/></svg>
        </button>
        <button class="control-btn btn-pause" onclick="pauseAnimation()">
          <svg viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </button>
        <button class="control-btn btn-stop" onclick="stopAnimation()">
          <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        </button>
      </div>
    </div>
  </div>

  <a-scene 
    embedded 
    arjs="sourceType: webcam; detectionMode: mono_and_matrix; matrixCodeType: 3x3; debugUIEnabled: false;" 
    vr-mode-ui="enabled: false"
    renderer="logarithmicDepthBuffer: true; antialias: true; colorManagement: true; physicallyCorrectLights: true;">
    
    <!-- Global Işık Kaynakları -->
    <a-entity id="ambient-light" light="type: ambient; color: #ffffff; intensity: 3"></a-entity>
    <a-entity id="hemisphere-light" light="type: hemisphere; color: #ffffff; groundColor: #444444; intensity: 2.25"></a-entity>
    
    <a-marker 
      type="pattern" 
      url="${patternUrl}" 
      id="ar-marker"
      smooth="true"
      smoothCount="5"
      smoothTolerance="0.01"
      smoothThreshold="2">
      <!-- Marker İçi Işık Kaynakları -->
      <a-entity id="directional-light" light="type: directional; color: #ffffff; intensity: 3" position="1 3 2"></a-entity>
      <a-entity id="directional-light-2" light="type: directional; color: #ffffff; intensity: 2.25" position="-2 2 -1"></a-entity>
      <a-entity id="point-light" light="type: point; color: #ffffff; intensity: 3; distance: 10" position="0 2 0"></a-entity>
      <a-entity id="ar-content"></a-entity>
    </a-marker>
    <a-entity camera></a-entity>
  </a-scene>

  <script>
    // Tam ekran fonksiyonları
    function enterFullscreen() {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    }
    
    // Sayfa yüklenince tam ekran aç
    document.addEventListener('DOMContentLoaded', () => {
      const tryFullscreen = () => {
        enterFullscreen();
        document.removeEventListener('click', tryFullscreen);
        document.removeEventListener('touchstart', tryFullscreen);
      };
      document.addEventListener('click', tryFullscreen);
      document.addEventListener('touchstart', tryFullscreen);
      setTimeout(enterFullscreen, 100);
    });
    
    const animations = {
      circuit: { title: 'Elektrik Devresi', description: 'Basit bir elektrik devresinde akım akışını gösteren animasyon' },
      bulb: { title: 'Ampul Yanıp Sönme', description: 'Elektrik akımı ile ampulün yanıp sönmesi' },
      current: { title: 'Akım Akışı', description: 'Elektrik akımının iletken içinde hareket etmesi' },
      resistance: { title: 'Direnç', description: 'Elektrik direncinin akım üzerindeki etkisi' },
      voltage: { title: 'Voltaj', description: 'Elektrik potansiyel farkı animasyonu' },
      custom: { title: ${JSON.stringify(customTitle || 'Özel 3D Model')}, description: ${JSON.stringify(customDescription || 'Yüklenen özel 3D model animasyonu')} }
    };
    
    const animationType = ${JSON.stringify(animationType)};
    const customModelUrl = ${JSON.stringify(customModelUrl)};
    const customTitle = ${JSON.stringify(customTitle)};
    const customDescription = ${JSON.stringify(customDescription)};
    const animConfig = animations[animationType] || animations.circuit;
    
    document.getElementById('ar-title').textContent = animConfig.title;
    document.getElementById('info-title').textContent = animConfig.title;
    document.getElementById('info-description').textContent = animConfig.description;

    // Cleanup fonksiyonu
    function cleanupAR() {
      try {
        // Timeline güncellemeyi durdur
        if (timelineUpdateInterval) {
          clearInterval(timelineUpdateInterval);
          timelineUpdateInterval = null;
        }
        
        // Animasyonları durdur
        if (currentModel) {
          const mixerComp = currentModel.components['animation-mixer'];
          if (mixerComp && mixerComp.mixer) {
            mixerComp.mixer.stopAllAction();
          }
        }
        
        // Kamera stream'ini durdur
        const video = document.querySelector('video');
        if (video && video.srcObject) {
          const tracks = video.srcObject.getTracks();
          tracks.forEach(track => track.stop());
          video.srcObject = null;
        }
        
        // AR.js'i temizle
        const scene = document.querySelector('a-scene');
        if (scene && scene.components && scene.components.arjs) {
          const arjsSystem = scene.systems.arjs;
          if (arjsSystem && arjsSystem.arToolkitContext) {
            arjsSystem.arToolkitContext = null;
          }
        }
        
        console.log('AR cleanup completed');
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    }
    
    function closeAR() {
      cleanupAR();
      localStorage.removeItem('ar-animation-data');
      
      // Sayfayı yeniden yükle veya geri dön
      setTimeout(() => {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'close-ar' }, '*');
        } else {
          window.location.href = '/admin.html';
        }
      }, 100);
    }

    // Sayfa kapatılırken de cleanup yap
    window.addEventListener('beforeunload', cleanupAR);
    window.addEventListener('pagehide', cleanupAR);

    let sceneLoaded = false;
    let sceneLoadTimeout = null;
    
    document.querySelector('a-scene').addEventListener('loaded', function() {
      console.log('AR Scene loaded');
      sceneLoaded = true;
      if (sceneLoadTimeout) clearTimeout(sceneLoadTimeout);
      document.getElementById('ar-loading').classList.add('hidden');
      addAnimationContent();
      
      const marker = document.getElementById('ar-marker');
      marker.addEventListener('markerFound', () => {
        console.log('Marker found!');
        document.querySelector('.ar-instructions').classList.add('hidden');
        document.getElementById('animation-info').classList.remove('hidden');
        
        // Animasyonu otomatik başlat
        setTimeout(() => {
          setupModelControls();
          playAnimation();
        }, 500);
      });
      marker.addEventListener('markerLost', () => {
        console.log('Marker lost');
        document.getElementById('animation-info').classList.add('hidden');
        document.querySelector('.ar-instructions').classList.remove('hidden');
      });
    });
    
    // Timeout için güvenlik önlemi - 15 saniye içinde yüklenmediyse hata göster
    sceneLoadTimeout = setTimeout(() => {
      if (!sceneLoaded) {
        console.error('AR Scene failed to load in time');
        document.getElementById('ar-loading').innerHTML = '<div class="ar-loading-spinner"></div><p>AR yüklenirken sorun oluştu</p><button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #4cc9f0; border: none; border-radius: 8px; color: white; cursor: pointer;">Yeniden Dene</button>';
      }
    }, 15000);
    
    document.querySelector('a-scene').addEventListener('arjs-video-loaded', function() {
      console.log('Video loaded');
      // Video yüklendiğinde de loading'i kaldır
      if (!sceneLoaded) {
        sceneLoaded = true;
        if (sceneLoadTimeout) clearTimeout(sceneLoadTimeout);
        document.getElementById('ar-loading').classList.add('hidden');
      }
    });

    function addAnimationContent() {
      const content = document.getElementById('ar-content');
      if (!content) return;

      switch(animationType) {
        case 'circuit': createCircuitAnimation(content); break;
        case 'bulb': createBulbAnimation(content); break;
        case 'current': createCurrentAnimation(content); break;
        case 'resistance': createResistanceAnimation(content); break;
        case 'voltage': createVoltageAnimation(content); break;
        case 'custom': createCustomModelAnimation(content); break;
        default: createCircuitAnimation(content);
      }
    }

    function createCustomModelAnimation(parent) {
      if (!customModelUrl) {
        console.error('Custom model URL not provided');
        createCircuitAnimation(parent);
        return;
      }
      
      const modelEntity = document.createElement('a-entity');
      modelEntity.setAttribute('gltf-model', customModelUrl);
      modelEntity.setAttribute('scale', '0.1 0.1 0.1');
      modelEntity.setAttribute('position', '0 0.1 0');
      modelEntity.setAttribute('rotation', '0 0 0');
      modelEntity.setAttribute('animation-mixer', 'clip: *; loop: repeat');
      modelEntity.setAttribute('id', 'custom-model');
      parent.appendChild(modelEntity);
      
      // currentModel'ı hemen ata
      currentModel = modelEntity;
      
      // Model yüklenince animasyonu başlat
      modelEntity.addEventListener('model-loaded', function() {
        console.log('Custom model loaded');
        playAnimation();
      });
    }

    function createCircuitAnimation(parent) {
      const battery = document.createElement('a-box');
      battery.setAttribute('position', '-0.4 0.1 0');
      battery.setAttribute('width', '0.15');
      battery.setAttribute('height', '0.25');
      battery.setAttribute('depth', '0.08');
      battery.setAttribute('color', '#ff4444');
      parent.appendChild(battery);

      const bulbBase = document.createElement('a-cylinder');
      bulbBase.setAttribute('position', '0.4 0.05 0');
      bulbBase.setAttribute('radius', '0.08');
      bulbBase.setAttribute('height', '0.1');
      bulbBase.setAttribute('color', '#888888');
      parent.appendChild(bulbBase);

      const bulb = document.createElement('a-sphere');
      bulb.setAttribute('position', '0.4 0.18 0');
      bulb.setAttribute('radius', '0.1');
      bulb.setAttribute('color', '#ffff00');
      bulb.setAttribute('material', 'emissive: #ffff00; emissiveIntensity: 0.5');
      bulb.setAttribute('animation', 'property: material.emissiveIntensity; from: 0.2; to: 1; dur: 500; dir: alternate; loop: true');
      parent.appendChild(bulb);

      const wire = document.createElement('a-box');
      wire.setAttribute('position', '0 0 0');
      wire.setAttribute('width', '0.65');
      wire.setAttribute('height', '0.02');
      wire.setAttribute('depth', '0.02');
      wire.setAttribute('color', '#333333');
      parent.appendChild(wire);

      const electron = document.createElement('a-sphere');
      electron.setAttribute('radius', '0.03');
      electron.setAttribute('color', '#00d4ff');
      electron.setAttribute('material', 'emissive: #00d4ff; emissiveIntensity: 1');
      electron.setAttribute('position', '-0.3 0 0');
      electron.setAttribute('animation', 'property: position; from: -0.3 0 0; to: 0.3 0 0; dur: 1000; loop: true');
      parent.appendChild(electron);
    }

    function createBulbAnimation(parent) {
      const socket = document.createElement('a-cylinder');
      socket.setAttribute('position', '0 0 0');
      socket.setAttribute('radius', '0.1');
      socket.setAttribute('height', '0.15');
      socket.setAttribute('color', '#666666');
      parent.appendChild(socket);

      const glass = document.createElement('a-sphere');
      glass.setAttribute('position', '0 0.2 0');
      glass.setAttribute('radius', '0.18');
      glass.setAttribute('color', '#ffffcc');
      glass.setAttribute('material', 'transparent: true; opacity: 0.8; emissive: #ffff00; emissiveIntensity: 0.3');
      glass.setAttribute('animation', 'property: material.emissiveIntensity; from: 0.1; to: 1; dur: 800; dir: alternate; loop: true');
      parent.appendChild(glass);
    }

    function createCurrentAnimation(parent) {
      const wire = document.createElement('a-box');
      wire.setAttribute('position', '0 0 0');
      wire.setAttribute('width', '1');
      wire.setAttribute('height', '0.08');
      wire.setAttribute('depth', '0.08');
      wire.setAttribute('color', '#cc6600');
      parent.appendChild(wire);

      for (let i = 0; i < 5; i++) {
        const electron = document.createElement('a-sphere');
        electron.setAttribute('radius', '0.035');
        electron.setAttribute('color', '#00d4ff');
        electron.setAttribute('material', 'emissive: #00d4ff; emissiveIntensity: 1');
        electron.setAttribute('animation', 'property: position; from: ' + (-0.5 + i * 0.1) + ' 0 0.06; to: ' + (0.5 + i * 0.1) + ' 0 0.06; dur: ' + (2000 + i * 100) + '; loop: true');
        parent.appendChild(electron);
      }
    }

    function createResistanceAnimation(parent) {
      const body = document.createElement('a-box');
      body.setAttribute('position', '0 0 0');
      body.setAttribute('width', '0.4');
      body.setAttribute('height', '0.15');
      body.setAttribute('depth', '0.15');
      body.setAttribute('color', '#d4a574');
      parent.appendChild(body);

      const heat = document.createElement('a-sphere');
      heat.setAttribute('position', '0 0 0');
      heat.setAttribute('radius', '0.25');
      heat.setAttribute('color', '#ff4400');
      heat.setAttribute('material', 'transparent: true; opacity: 0.2; emissive: #ff4400; emissiveIntensity: 0.3');
      heat.setAttribute('animation', 'property: material.opacity; from: 0.1; to: 0.4; dur: 1000; dir: alternate; loop: true');
      parent.appendChild(heat);
    }

    function createVoltageAnimation(parent) {
      const posTerminal = document.createElement('a-box');
      posTerminal.setAttribute('position', '-0.35 0 0');
      posTerminal.setAttribute('width', '0.15');
      posTerminal.setAttribute('height', '0.3');
      posTerminal.setAttribute('depth', '0.1');
      posTerminal.setAttribute('color', '#ff0000');
      parent.appendChild(posTerminal);

      const negTerminal = document.createElement('a-box');
      negTerminal.setAttribute('position', '0.35 0 0');
      negTerminal.setAttribute('width', '0.15');
      negTerminal.setAttribute('height', '0.3');
      negTerminal.setAttribute('depth', '0.1');
      negTerminal.setAttribute('color', '#0066ff');
      parent.appendChild(negTerminal);

      const charge = document.createElement('a-sphere');
      charge.setAttribute('radius', '0.04');
      charge.setAttribute('color', '#00ff00');
      charge.setAttribute('material', 'emissive: #00ff00; emissiveIntensity: 1');
      charge.setAttribute('animation', 'property: position; from: -0.25 0 0.08; to: 0.25 0 0.08; dur: 1500; loop: true');
      parent.appendChild(charge);
    }
    
    // AR Kontrol Fonksiyonları
    let currentModel = null;
    let isPlaying = true;
    
    function toggleControls() {
      const controls = document.getElementById('ar-controls');
      const btn = document.getElementById('toggle-controls');
      controls.classList.toggle('hidden');
      btn.classList.toggle('active');
    }
    
    // Zamanı formatla
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return mins + ':' + secs.toString().padStart(2, '0');
    }
    
    // Timeline güncelleme
    let timelineUpdateInterval = null;
    let isDraggingTimeline = false;
    
    function updateTimelineDisplay() {
      if (isDraggingTimeline || !isPlaying) return;
      
      if (currentModel) {
        const mixerComp = currentModel.components['animation-mixer'];
        if (mixerComp && mixerComp.mixer) {
          const mixer = mixerComp.mixer;
          const actions = mixer._actions;
          
          if (actions && actions.length > 0) {
            const action = actions[0];
            if (action && action._clip) {
              const duration = action._clip.duration;
              const currentTime = action.time % duration;
              const percent = (currentTime / duration) * 100;
              
              document.getElementById('timeline-slider').value = percent;
              document.getElementById('timeline-value').textContent = formatTime(currentTime);
            }
          }
        }
      }
    }
    
    function startTimelineUpdate() {
      if (timelineUpdateInterval) clearInterval(timelineUpdateInterval);
      timelineUpdateInterval = setInterval(updateTimelineDisplay, 100);
    }
    
    // Boyut kontrolü
    document.getElementById('scale-slider').addEventListener('input', function(e) {
      const scale = parseFloat(e.target.value);
      document.getElementById('scale-value').textContent = scale.toFixed(2) + 'x';
      
      const content = document.getElementById('ar-content');
      if (content && content.children.length > 0) {
        for (let child of content.children) {
          child.setAttribute('scale', scale + ' ' + scale + ' ' + scale);
        }
      }
    });
    
    // Işık kontrolü
    document.getElementById('light-slider').addEventListener('input', function(e) {
      const intensity = parseFloat(e.target.value);
      document.getElementById('light-value').textContent = intensity.toFixed(1) + 'x';
      
      // Tüm ışıkları güncelle
      const ambientLight = document.getElementById('ambient-light');
      const hemisphereLight = document.getElementById('hemisphere-light');
      const directionalLight = document.getElementById('directional-light');
      const directionalLight2 = document.getElementById('directional-light-2');
      const pointLight = document.getElementById('point-light');
      
      if (ambientLight) ambientLight.setAttribute('light', 'intensity', intensity);
      if (hemisphereLight) hemisphereLight.setAttribute('light', 'intensity', intensity * 0.75);
      if (directionalLight) directionalLight.setAttribute('light', 'intensity', intensity);
      if (directionalLight2) directionalLight2.setAttribute('light', 'intensity', intensity * 0.75);
      if (pointLight) pointLight.setAttribute('light', 'intensity', intensity);
      
      // GLB modelin materyallerini de aydınlat
      const content = document.getElementById('ar-content');
      if (content) {
        const models = content.querySelectorAll('[gltf-model]');
        models.forEach(function(model) {
          if (model.object3D) {
            model.object3D.traverse(function(node) {
              if (node.isMesh && node.material) {
                if (Array.isArray(node.material)) {
                  node.material.forEach(function(mat) {
                    if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                      mat.envMapIntensity = intensity;
                      mat.needsUpdate = true;
                    }
                  });
                } else {
                  if (node.material.isMeshStandardMaterial || node.material.isMeshPhysicalMaterial) {
                    node.material.envMapIntensity = intensity;
                    node.material.needsUpdate = true;
                  }
                }
              }
            });
          }
        });
      }
    });
    
    // Timeline sürükleme
    document.getElementById('timeline-slider').addEventListener('mousedown', function() { isDraggingTimeline = true; });
    document.getElementById('timeline-slider').addEventListener('touchstart', function() { isDraggingTimeline = true; });
    document.getElementById('timeline-slider').addEventListener('mouseup', function() { isDraggingTimeline = false; });
    document.getElementById('timeline-slider').addEventListener('touchend', function() { isDraggingTimeline = false; });
    
    // Timeline kontrolü
    document.getElementById('timeline-slider').addEventListener('input', function(e) {
      const percent = parseFloat(e.target.value);
      
      if (currentModel) {
        const mixerComp = currentModel.components['animation-mixer'];
        if (mixerComp && mixerComp.mixer) {
          const mixer = mixerComp.mixer;
          
          const actions = mixer._actions;
          if (actions && actions.length > 0) {
            for (let action of actions) {
              if (action._clip) {
                const duration = action._clip.duration;
                const time = (percent / 100) * duration;
                action.time = time;
                document.getElementById('timeline-value').textContent = formatTime(time);
              }
            }
            mixer.update(0);
          }
        }
      }
    });
    
    function playAnimation() {
      isPlaying = true;
      
      if (currentModel) {
        const mixerComp = currentModel.components['animation-mixer'];
        if (mixerComp && mixerComp.mixer) {
          mixerComp.mixer.timeScale = 1;
        }
      }
      
      const content = document.getElementById('ar-content');
      if (content) {
        for (let child of content.children) {
          if (child.components && child.components.animation) {
            child.setAttribute('animation', 'enabled', true);
          }
        }
      }
      
      startTimelineUpdate();
    }
    
    function pauseAnimation() {
      isPlaying = false;
      
      if (currentModel) {
        const mixerComp = currentModel.components['animation-mixer'];
        if (mixerComp && mixerComp.mixer) {
          mixerComp.mixer.timeScale = 0;
        }
      }
      
      const content = document.getElementById('ar-content');
      if (content) {
        for (let child of content.children) {
          if (child.components && child.components.animation) {
            child.setAttribute('animation', 'enabled', false);
          }
        }
      }
    }
    
    function stopAnimation() {
      isPlaying = false;
      
      if (currentModel) {
        const mixerComp = currentModel.components['animation-mixer'];
        if (mixerComp && mixerComp.mixer) {
          const mixer = mixerComp.mixer;
          mixer.timeScale = 0;
          
          const actions = mixer._actions;
          if (actions) {
            for (let action of actions) {
              action.time = 0;
            }
            mixer.update(0);
          }
        }
      }
      
      document.getElementById('timeline-slider').value = 0;
      document.getElementById('timeline-value').textContent = '0:00';
    }
    
    // Model yüklendiğinde referansı kaydet
    function setupModelControls() {
      const content = document.getElementById('ar-content');
      if (content && content.children.length > 0) {
        for (let child of content.children) {
          if (child.hasAttribute('gltf-model')) {
            currentModel = child;

            // Model yüklenince animation-mixer'ı kontrol et
            child.addEventListener('model-loaded', function () {
              console.log('Model loaded, setting up controls');
              const mixerComp = child.components['animation-mixer'];
              if (mixerComp && mixerComp.mixer) {
                console.log('Animation mixer found');
                // Timeline güncellemeyi başlat
                startTimelineUpdate();
              }
            });
            break;
          }
        }
      }
    }

    // Sayfa yüklenince kontrolleri kur
    setTimeout(setupModelControls, 2000);
  </script>
</body>
</html>`;

  res.type('html').send(html);
});

// Settings API
app.get('/api/settings', (req, res) => {
  const db = loadDB();
  res.json(db.settings);
});

app.put('/api/settings', (req, res) => {
  const { totalSteps, qrSettings } = req.body;
  const db = loadDB();

  db.settings = {
    ...db.settings,
    totalSteps: parseInt(totalSteps) || db.settings.totalSteps || 24
  };

  // QR ayarlarını kaydet
  if (qrSettings) {
    db.settings.qrSettings = qrSettings;
  }

  saveDB(db);
  res.json({ message: 'Ayarlar kaydedildi', settings: db.settings });
});

// Questions API
app.get('/api/questions', (req, res) => {
  const db = loadDB();
  // Add default values for correct_steps and wrong_steps
  const questionsWithDefaults = db.questions.map(q => ({
    ...q,
    correct_steps: q.correct_steps || 2,
    wrong_steps: q.wrong_steps || 1
  }));
  res.json(questionsWithDefaults);
});

app.get('/api/questions/:id', (req, res) => {
  const db = loadDB();
  const question = db.questions.find(q => q.id === req.params.id);
  if (question) {
    // Ensure correct_steps and wrong_steps have default values
    question.correct_steps = question.correct_steps || 2;
    question.wrong_steps = question.wrong_steps || 1;
    res.json(question);
  } else {
    res.status(404).json({ error: 'Soru bulunamadı' });
  }
});

app.get('/api/questions/qr/:qrCode', (req, res) => {
  const db = loadDB();
  const question = db.questions.find(q => q.qr_code === req.params.qrCode);
  if (question) {
    // Ensure correct_steps and wrong_steps have default values
    question.correct_steps = question.correct_steps || 2;
    question.wrong_steps = question.wrong_steps || 1;
    res.json(question);
  } else {
    res.status(404).json({ error: 'Bu QR koda ait soru bulunamadı' });
  }
});

app.post('/api/questions', (req, res) => {
  const { type, correct_steps, wrong_steps, time_limit, qr_code, question_text, image_url, options, correct_answer, fill_blanks, matching_pairs, drag_drop, application, info } = req.body;
  const db = loadDB();

  // Normalize QR code (trim whitespace)
  const normalizedQRCode = qr_code ? String(qr_code).trim() : null;

  // Check if QR code already exists (only if QR code is not empty)
  if (normalizedQRCode && db.questions.some(q => q.qr_code && String(q.qr_code).trim() === normalizedQRCode)) {
    return res.status(400).json({ error: 'Bu QR kodu zaten kullanılıyor' });
  }

  const newQuestion = {
    id: uuidv4(),
    type,
    correct_steps: correct_steps || 2,
    wrong_steps: wrong_steps || 1,
    time_limit: time_limit || 0,
    qr_code: normalizedQRCode,
    question_text,
    image_url: image_url || null,
    options: options || null,
    correct_answer,
    fill_blanks: fill_blanks || null,
    matching_pairs: matching_pairs || null,
    drag_drop: drag_drop || null,
    application: application || null,
    info: info || null,
    created_at: new Date().toISOString()
  };

  db.questions.push(newQuestion);
  saveDB(db);

  res.json({ id: newQuestion.id, message: 'Soru başarıyla eklendi' });
});

app.put('/api/questions/:id', (req, res) => {
  const { type, correct_steps, wrong_steps, time_limit, qr_code, question_text, image_url, options, correct_answer, fill_blanks, matching_pairs, drag_drop, application, info } = req.body;
  const db = loadDB();

  const index = db.questions.findIndex(q => q.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Soru bulunamadı' });
  }

  // Normalize QR code (trim whitespace)
  const normalizedQRCode = qr_code ? String(qr_code).trim() : null;

  // Debug: tüm sorular ve QR kodlarını listele
  console.log('=== PUT DEBUG ===');
  console.log(`Current QR to update: "${normalizedQRCode}"`);
  console.log(`Updating question ID: "${req.params.id}"`);
  console.log('Database questions:');
  db.questions.forEach(q => {
    if (q.qr_code) {
      console.log(`  - ID: ${q.id}, QR: "${q.qr_code}" (trimmed: "${String(q.qr_code).trim()}")`);
    }
  });

  // Check if QR code already exists for another question (only if QR code is not empty)
  if (normalizedQRCode && db.questions.some(q => q.qr_code && String(q.qr_code).trim() === normalizedQRCode && q.id !== req.params.id)) {
    console.log(`❌ PUT: Duplicate QR code check FAILED. normalizedQRCode: "${normalizedQRCode}", updatingId: "${req.params.id}"`);
    return res.status(400).json({ error: 'Bu QR kodu zaten kullanılıyor' });
  }
  
  console.log(`✅ PUT: Updating question ${req.params.id} with QR code: "${normalizedQRCode}"`);

  db.questions[index] = {
    ...db.questions[index],
    type,
    correct_steps: correct_steps || 2,
    wrong_steps: wrong_steps || 1,
    time_limit: time_limit || 0,
    qr_code: normalizedQRCode,
    question_text,
    image_url: image_url || null,
    options: options || null,
    correct_answer,
    fill_blanks: fill_blanks || null,
    matching_pairs: matching_pairs || null,
    drag_drop: drag_drop || null,
    application: application || null,
    info: info || null
  };

  saveDB(db);
  res.json({ message: 'Soru başarıyla güncellendi' });
});

app.delete('/api/questions/:id', (req, res) => {
  const db = loadDB();
  db.questions = db.questions.filter(q => q.id !== req.params.id);
  saveDB(db);
  res.json({ message: 'Soru silindi' });
});

// QR Code generator
app.get('/api/qr/:code', async (req, res) => {
  try {
    const qrDataUrl = await QRCode.toDataURL(req.params.code, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    res.json({ qr: qrDataUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Games API
app.post('/api/games', (req, res) => {
  const { playerCount, players } = req.body;
  const db = loadDB();

  const scores = {};
  players.forEach((p, i) => scores[i + 1] = 0);

  const newGame = {
    id: uuidv4(),
    player_count: playerCount,
    current_player: 1,
    players,
    scores,
    status: 'active',
    created_at: new Date().toISOString()
  };

  db.games.push(newGame);
  saveDB(db);

  res.json({ id: newGame.id, message: 'Oyun başlatıldı' });
});

app.get('/api/games/:id', (req, res) => {
  const db = loadDB();
  const game = db.games.find(g => g.id === req.params.id);
  if (game) {
    res.json(game);
  } else {
    res.status(404).json({ error: 'Oyun bulunamadı' });
  }
});

app.put('/api/games/:id', (req, res) => {
  const { current_player, scores, status } = req.body;
  const db = loadDB();

  const index = db.games.findIndex(g => g.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Oyun bulunamadı' });
  }

  db.games[index] = {
    ...db.games[index],
    current_player,
    scores,
    status
  };

  saveDB(db);
  res.json({ message: 'Oyun güncellendi' });
});

// Socket.io for real-time game updates
io.on('connection', (socket) => {
  console.log('Oyuncu bağlandı:', socket.id);

  socket.on('join-game', (gameId) => {
    socket.join(gameId);
    console.log(`Socket ${socket.id} joined game ${gameId}`);
  });

  socket.on('answer-submitted', (data) => {
    io.to(data.gameId).emit('update-scores', data);
  });

  socket.on('next-player', (data) => {
    io.to(data.gameId).emit('player-changed', data);
  });

  socket.on('game-ended', (data) => {
    io.to(data.gameId).emit('show-results', data);
  });

  socket.on('disconnect', () => {
    console.log('Oyuncu ayrıldı:', socket.id);
  });
});

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/game/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Get local IP address
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const HTTP_PORT = 3000;
const HTTPS_PORT = 3443;
const localIP = getLocalIP();

// HTTPS sunucusunu başlat
if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`🔒 HTTPS sunucusu çalışıyor:`);
    console.log(`   Bilgisayar: https://localhost:${HTTPS_PORT}`);
    console.log(`   📱 Telefon: https://${localIP}:${HTTPS_PORT}`);
    console.log(`📋 Yönetici paneli: https://localhost:${HTTPS_PORT}/admin`);
  });
}

// HTTP sunucusunu başlat
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`🎮 HTTP sunucusu çalışıyor:`);
  console.log(`   Bilgisayar: http://localhost:${HTTP_PORT}`);
  console.log(`   📱 Telefon: http://${localIP}:${HTTP_PORT}`);
  if (!httpsServer) {
    console.log(`📋 Yönetici paneli: http://localhost:${HTTP_PORT}/admin`);
  }
  console.log('');
  console.log('⚠️  Telefondan bağlanmak için aynı WiFi ağında olmalısınız.');
  if (httpsServer) {
    console.log('🔒 HTTPS aktif - Kamera erişimi için HTTPS kullanın.');
  }
});
