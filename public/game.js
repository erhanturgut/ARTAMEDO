// Game State
let TOTAL_STEPS = 24; // Varsayılan değer, sunucudan güncellenecek

// Ses Yöneticisi
let soundManager = null;

// Socket.io
let socket = null;

// DOM Elements (en başta deklarasyon - Temporal Dead Zone sorununu çözmek için)
let playerNamesContainer = null;
let mainMenu = null;
let gameScreen = null;
let resultsScreen = null;
let startGameBtn = null;
let currentPlayerBadge = null;
let scoreDisplay = null;
let qrContainer = null;
let questionCard = null;
let resultIndicator = null;
let manualQrModal = null;
let manualQrInput = null;

// Initialize DOM Elements
function initDOMElements() {
  playerNamesContainer = document.getElementById('player-names');
  mainMenu = document.getElementById('main-menu');
  gameScreen = document.getElementById('game-screen');
  resultsScreen = document.getElementById('results-screen');
  startGameBtn = document.getElementById('start-game-btn');
  currentPlayerBadge = document.getElementById('current-player-badge');
  scoreDisplay = document.getElementById('score-display');
  qrContainer = document.getElementById('qr-container');
  questionCard = document.getElementById('question-card');
  resultIndicator = document.getElementById('result-indicator');
  manualQrModal = document.getElementById('manual-qr-modal');
  manualQrInput = document.getElementById('manual-qr-input');
  
  // Socket.io'yu başlat - WebSocket + polling fallback
  socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10
  });
}

// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Başlatılıyor...');
  
  // DOM Elements'ı başlat
  initDOMElements();
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  // Ses yöneticisini başlat
  initSoundManager();
  
  // Oyuncu seçimi butonları ve diğer event listener'ları kur
  setupPlayerSelection();
  setupGameEventListeners();
  setupSocketListeners();
  
  // Fullscreen button setup
  setupFullscreen();
  
  // Otomatik tam ekran aç (ilk kullanıcı etkileşiminde)
  autoEnterFullscreen();

  // Kurallar modal aç/kapat
  const openRulesBtn = document.getElementById('open-rules-btn');
  const rulesModal = document.getElementById('rules-modal');
  const rulesCloseBtn = document.getElementById('rules-close-btn');
  const rulesCloseX = document.getElementById('rules-x-btn');
  if (openRulesBtn && rulesModal) {
    openRulesBtn.addEventListener('click', () => {
      rulesModal.classList.remove('hidden');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }
  const closeRules = () => rulesModal && rulesModal.classList.add('hidden');
  if (rulesCloseBtn) rulesCloseBtn.addEventListener('click', closeRules);
  if (rulesCloseX) rulesCloseX.addEventListener('click', closeRules);
  if (rulesModal) {
    rulesModal.addEventListener('click', (e) => {
      if (e.target === rulesModal) closeRules();
    });
  }
});

// Fullscreen functionality
function setupFullscreen() {
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (!fullscreenBtn) return;
  
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  
  // Update on fullscreen change
  document.addEventListener('fullscreenchange', updateFullscreenState);
  document.addEventListener('webkitfullscreenchange', updateFullscreenState);
  document.addEventListener('mozfullscreenchange', updateFullscreenState);
  document.addEventListener('MSFullscreenChange', updateFullscreenState);
}

function autoEnterFullscreen() {
  // Kullanıcı etkileşimi gerektiğinden ilk tıklamada tam ekran aç
  const tryFullscreen = (e) => {
    // Modal veya buton tıklamasını kontrol et
    if (e.target.closest('.modal') || e.target.closest('#fullscreen-btn')) {
      return; // Modal içindeki tıklamalarda tam ekran açma
    }
    
    enterFullscreen();
    document.removeEventListener('click', tryFullscreen);
    document.removeEventListener('touchend', tryFullscreen);
  };
  
  // Sayfa yüklendiğinde zaten tam ekrandaysa bir şey yapma
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    return;
  }
  
  document.addEventListener('click', tryFullscreen);
  document.addEventListener('touchend', tryFullscreen);
}

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

function toggleFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement && 
      !document.mozFullScreenElement && !document.msFullscreenElement) {
    enterFullscreen();
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

function updateFullscreenState() {
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (!fullscreenBtn) return;
  
  const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || 
                       document.mozFullScreenElement || document.msFullscreenElement;
  
  // Tam ekrandayken butonu gizle, değilken göster
  if (isFullscreen) {
    fullscreenBtn.style.display = 'none';
  } else {
    fullscreenBtn.style.display = 'flex';
  }
}

// Renk tanımlamaları
const PLAYER_COLORS = {
  red: { name: 'Kırmızı', bg: '#ef4444', border: '#fca5a5', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
  purple: { name: 'Mor', bg: '#a855f7', border: '#d8b4fe', gradient: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)' },
  blue: { name: 'Mavi', bg: '#3b82f6', border: '#93c5fd', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
  cyan: { name: 'Turkuaz', bg: '#06b6d4', border: '#67e8f9', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
  green: { name: 'Yeşil', bg: '#22c55e', border: '#86efac', gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' },
  brown: { name: 'Kahverengi', bg: '#a16207', border: '#fbbf24', gradient: 'linear-gradient(135deg, #a16207 0%, #854d0e 100%)' }
};

const COLOR_KEYS = ['red', 'purple', 'blue', 'cyan', 'green', 'brown'];

let gameState = {
  gameId: null,
  playerCount: 0,
  players: [], // {name, color, colorKey}
  playerOrder: [], // Rastgele belirlenen oyun sırası (player index'leri)
  scores: {}, // Her oyuncunun mevcut adımı (0-TOTAL_STEPS arası)
  currentPlayerIndex: 0, // playerOrder içindeki index
  currentQuestion: null,
  selectedQuestionType: null, // Seçilen soru tipi
  timerInterval: null, // Süre sayacı
  duelPlayers: [], // Kapışma modundaki oyuncular
  duelAnswers: {}, // Kapışma cevapları
  duelOpponent: undefined // Duel'de seçilen rakip oyuncu index'i
};

// Soru tipi isimleri
const QUESTION_TYPE_NAMES = {
  multiple: 'Çoktan Seçmeli',
  truefalse: 'Doğru/Yanlış',
  fillblank: 'Boşluk Doldurma',
  duel: 'Kapışma 2\'li',
  group_duel: 'Kapışma Hep Birlikte',
  matching: 'Eşleme',
  drag_drop: 'Sürükle Bırak',
  application: 'Uygulama'
};

function getQuestionMode(question) {
  if (!question) return 'normal';
  if (question.mode) {
    return question.mode === 'battle' ? 'group_duel' : question.mode;
  }
  if (question.type === 'duel' || question.type === 'group_duel' || question.type === 'battle') {
    return question.type === 'battle' ? 'group_duel' : question.type;
  }
  return 'normal';
}

function getQuestionBaseType(question) {
  if (!question) return 'multiple';
  if (question.base_type) return question.base_type;
  const mode = getQuestionMode(question);
  if (mode !== 'normal') return 'application';
  return question.type || 'multiple';
}

// Load game settings from server
async function loadGameSettings() {
  try {
    const response = await fetch('/api/settings');
    const settings = await response.json();
    TOTAL_STEPS = settings.totalSteps || 24;
  } catch (error) {
    console.log('Ayarlar yüklenemedi, varsayılan değerler kullanılıyor');
  }
}

// Load settings on page load
loadGameSettings();

// QR Scanner
let html5QrCode = null;
let isScanning = false;
let lastScannedCode = null;
let lastScanTime = 0;

// Player Selection Setup
function setupPlayerSelection() {
  console.log('setupPlayerSelection çağrıldı');
  
  const playerBtns = document.querySelectorAll('.player-btn');
  console.log('Player seçim butonları bulundu:', playerBtns.length);
  
  if (playerBtns.length === 0) {
    console.error('Player butonları bulunamadı!');
    // Tekrar dene
    setTimeout(() => {
      console.log('Player butonları için tekrar deneniyor...');
      const retryBtns = document.querySelectorAll('.player-btn');
      if (retryBtns.length > 0) {
        setupPlayerSelectionButtons(retryBtns);
      }
    }, 500);
    return;
  }
  
  setupPlayerSelectionButtons(playerBtns);
}

function setupPlayerSelectionButtons(playerBtns) {
  console.log('Setting up', playerBtns.length, 'player buttons');
  
  playerBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const count = this.dataset.count;
      console.log('Oyuncu sayısı seçildi:', count);
      
      document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
      gameState.playerCount = parseInt(count);
      showPlayerNameInputs();
    });
  });
}

function showPlayerNameInputs() {
  console.log('Showing name inputs for', gameState.playerCount, 'players');
  playerNamesContainer.innerHTML = '';
  playerNamesContainer.classList.remove('hidden');
  
  // Hide turn order display when changing player count
  document.getElementById('turn-order-display').classList.add('hidden');
  
  const availableColors = [...COLOR_KEYS];
  
  for (let i = 1; i <= gameState.playerCount; i++) {
    const div = document.createElement('div');
    div.className = 'player-name-input';
    
    // Color selector HTML
    let colorOptions = '';
    COLOR_KEYS.forEach((colorKey, idx) => {
      const color = PLAYER_COLORS[colorKey];
      const selected = idx === i - 1 ? 'selected' : '';
      const disabled = '';
      colorOptions += `<option value="${colorKey}" ${selected}>${color.name}</option>`;
    });
    
    div.innerHTML = `
      <div class="player-color-indicator" data-player="${i}" style="background: ${PLAYER_COLORS[COLOR_KEYS[i-1]].bg}"></div>
      <input type="text" placeholder="Oyuncu ${i} adı" data-player="${i}">
      <select class="player-color-select" data-player="${i}">
        ${colorOptions}
      </select>
    `;
    playerNamesContainer.appendChild(div);
  }
  
  // Add color change listeners
  document.querySelectorAll('.player-color-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const playerNum = e.target.dataset.player;
      const colorKey = e.target.value;
      const indicator = document.querySelector(`.player-color-indicator[data-player="${playerNum}"]`);
      indicator.style.background = PLAYER_COLORS[colorKey].bg;
      
      // Check for duplicate colors
      validateColorSelections();
    });
  });
  
  startGameBtn.classList.remove('hidden');
}

function validateColorSelections() {
  const selects = document.querySelectorAll('.player-color-select');
  const selectedColors = [];
  let hasDuplicate = false;
  
  selects.forEach(select => {
    if (selectedColors.includes(select.value)) {
      hasDuplicate = true;
    }
    selectedColors.push(select.value);
  });
  
  if (hasDuplicate) {
    startGameBtn.disabled = true;
    startGameBtn.style.opacity = '0.5';
  } else {
    startGameBtn.disabled = false;
    startGameBtn.style.opacity = '1';
  }
  
  return !hasDuplicate;
}

// Setup Game Event Listeners
function setupGameEventListeners() {
  // Start Game
  startGameBtn.addEventListener('click', async () => {
    console.log('Start game button clicked!');
    console.log('Player count:', gameState.playerCount);
    console.log('Players:', gameState.players);
    
    // Validate colors first
    if (!validateColorSelections()) {
      alert('Her oyuncu farklı bir renk seçmelidir!');
      return;
    }
    
    // Oyun başlangıç sesi
    playSound('game_start');
    
    // Butonu hemen gizle (çift tıklama önleme)
    startGameBtn.classList.add('hidden');
    
    const inputs = document.querySelectorAll('.player-name-input input');
    const colorSelects = document.querySelectorAll('.player-color-select');
    gameState.players = [];
    
    inputs.forEach((input, index) => {
      const colorKey = colorSelects[index].value;
      gameState.players.push({
        name: input.value || `Oyuncu ${index + 1}`,
        colorKey: colorKey,
        color: PLAYER_COLORS[colorKey]
      });
      gameState.scores[index] = 0;
    });
    
    // Rastgele oyun sırası belirle
    gameState.playerOrder = shuffleArray([...Array(gameState.playerCount).keys()]);
    gameState.currentPlayerIndex = 0;
    
    // Show turn order with animation (oyuncu butona basınca devam edecek)
    showTurnOrder();
  });

  // Oyun sırası gösterildikten sonra "Oyuna Başla" butonuna tıklayınca
  document.getElementById('confirm-start-btn').addEventListener('click', async () => {
    console.log('Confirm start button clicked!');
    console.log('Game ID will be created for:', gameState.playerCount, 'players');
    
    // Butonu devre dışı bırak
    const confirmBtn = document.getElementById('confirm-start-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Başlatılıyor...';
    
    // Create game in database
  const response = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerCount: gameState.playerCount,
      players: gameState.players.map(p => p.name)
    })
  });
  
  const data = await response.json();
  gameState.gameId = data.id;
  
  // Join socket room
  socket.emit('join-game', gameState.gameId);
  
  // Show game screen
  showScreen('game');
  updateGameUI();
  // Doğrudan QR tarama ekranına geç
  showQRScanner();
  });
}

// Shuffle array (Fisher-Yates)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Show turn order with animation
function showTurnOrder() {
  const turnOrderDisplay = document.getElementById('turn-order-display');
  const turnOrderList = document.getElementById('turn-order-list');
  
  turnOrderDisplay.classList.remove('hidden');
  turnOrderList.innerHTML = '';
  
  gameState.playerOrder.forEach((playerIdx, order) => {
    const player = gameState.players[playerIdx];
    const item = document.createElement('div');
    item.className = 'turn-order-item';
    item.style.animationDelay = `${order * 0.3}s`;
    item.innerHTML = `
      <span class="turn-order-number">${order + 1}</span>
      <span class="turn-order-color" style="background: ${player.color.bg}"></span>
      <span class="turn-order-name">${player.name}</span>
    `;
    turnOrderList.appendChild(item);
  });
}

// Screen Management
function showScreen(screen) {
  mainMenu.classList.remove('active');
  gameScreen.classList.remove('active');
  resultsScreen.classList.remove('active');
  
  if (screen === 'menu') mainMenu.classList.add('active');
  if (screen === 'game') gameScreen.classList.add('active');
  if (screen === 'results') resultsScreen.classList.add('active');
}

// Get current player (based on turn order)
function getCurrentPlayer() {
  const playerIdx = gameState.playerOrder[gameState.currentPlayerIndex];
  return gameState.players[playerIdx];
}

function getCurrentPlayerIndex() {
  return gameState.playerOrder[gameState.currentPlayerIndex];
}

// Update Game UI
function updateGameUI() {
  const currentPlayer = getCurrentPlayer();
  
  // Update player badge with custom color
  currentPlayerBadge.textContent = currentPlayer.name.toUpperCase();
  currentPlayerBadge.style.background = currentPlayer.color.gradient;
  currentPlayerBadge.style.color = '#fff';
  currentPlayerBadge.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';
  
  // Update progress border if question is visible
  const questionWrapper = document.getElementById('question-wrapper');
  if (!questionWrapper.classList.contains('hidden')) {
    updateProgressBorder();
  }
}

// Update Progress Border around question card
function updateProgressBorder() {
  const progressBorder = document.getElementById('score-display');
  progressBorder.innerHTML = '';
  
  const playerIdx = getCurrentPlayerIndex();
  const currentPlayer = getCurrentPlayer();
  const currentStep = Math.max(0, Math.min(TOTAL_STEPS, gameState.scores[playerIdx] || 0));
  
  // Create horizontal progress track
  const progressTrack = document.createElement('div');
  progressTrack.className = 'progress-track-horizontal';
  
  // Create all step circles in a single row
  for (let step = 1; step <= TOTAL_STEPS; step++) {
    const stepCircle = document.createElement('div');
    stepCircle.className = 'progress-step';
    
    if (step <= currentStep) {
      stepCircle.classList.add('completed');
      stepCircle.style.background = `${currentPlayer.color.bg}40`;
      stepCircle.style.borderColor = currentPlayer.color.bg;
      stepCircle.style.color = currentPlayer.color.bg;
    }
    
    if (step === currentStep && step > 0) {
      stepCircle.classList.add('current');
      stepCircle.style.background = currentPlayer.color.bg;
      stepCircle.style.borderColor = currentPlayer.color.border;
      stepCircle.style.color = '#fff';
      stepCircle.style.boxShadow = `0 0 12px ${currentPlayer.color.bg}`;
    }
    
    if (step === TOTAL_STEPS) {
      stepCircle.classList.add('finish');
      stepCircle.innerHTML = '<i data-lucide="trophy" class="step-icon"></i>';
    } else {
      stepCircle.textContent = step;
    }
    progressTrack.appendChild(stepCircle);
  }
  
  progressBorder.appendChild(progressTrack);
  
  // Re-initialize Lucide icons for dynamically added content
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  // Check if player won
  if (currentStep >= TOTAL_STEPS) {
    setTimeout(() => showWinner(playerIdx), 500);
  }
}

// Show Winner
function showWinner(playerIdx) {
  stopQRScanner();
  showScreen('results');
  showResults();
}

// QR Scanner
function startQRScanner() {
  if (isScanning) return;
  
  const qrReaderElement = document.getElementById('qr-reader');
  qrReaderElement.innerHTML = ''; // Temizle
  
  // Check if camera is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCameraError('Bu tarayıcı kamera erişimini desteklemiyor.');
    return;
  }
  
  html5QrCode = new Html5Qrcode("qr-reader");
  
  const config = { 
    fps: 10, 
    qrbox: { width: 200, height: 200 },
    aspectRatio: 1.0
  };
  
  // First request camera permission explicitly
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
      // Stop the stream, we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      // Now start QR scanner
      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
          console.log('QR Kod okundu:', decodedText);
          onQRCodeScanned(decodedText);
        },
        (errorMessage) => {
          // Tarama hataları sessizce geçilir
        }
      ).then(() => {
        isScanning = true;
        console.log('QR Scanner başlatıldı');
        hideManualInputPrompt();
      }).catch(err => {
        console.log('QR Scanner başlatılamadı:', err);
        showCameraError('Kamera başlatılamadı. Lütfen manuel giriş yapın.');
      });
    })
    .catch(err => {
      console.log('Kamera izni alınamadı:', err);
      if (err.name === 'NotAllowedError') {
        showCameraError('Kamera izni reddedildi. Lütfen tarayıcı ayarlarından kamera iznini verin veya manuel giriş yapın.');
      } else if (err.name === 'NotFoundError') {
        showCameraError('Kamera bulunamadı. Lütfen manuel giriş yapın.');
      } else if (err.name === 'NotReadableError') {
        showCameraError('Kamera başka bir uygulama tarafından kullanılıyor olabilir.');
      } else {
        showCameraError('Kamera erişimi sağlanamadı. Lütfen manuel giriş yapın.');
      }
    });
}

function showCameraError(message) {
  const qrReaderElement = document.getElementById('qr-reader');
  qrReaderElement.innerHTML = `
    <div class="camera-error">
      <i data-lucide="camera-off" class="camera-error-icon"></i>
      <p>${message}</p>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  // Show manual input prompt more prominently
  showManualInputPrompt();
}

function showManualInputPrompt() {
  const scannerText = document.querySelector('.scanner-text');
  if (scannerText) {
    scannerText.innerHTML = '<strong>Kamera kullanılamıyor.</strong><br>Aşağıdaki butona tıklayarak QR kodunu manuel girebilirsiniz.';
  }
  
  const manualBtn = document.getElementById('manual-qr-btn');
  if (manualBtn) {
    manualBtn.classList.add('camera-fallback');
  }
}

function hideManualInputPrompt() {
  const scannerText = document.querySelector('.scanner-text');
  if (scannerText) {
    scannerText.textContent = 'QR Kodu Tara';
  }
  
  const manualBtn = document.getElementById('manual-qr-btn');
  if (manualBtn) {
    manualBtn.classList.remove('camera-fallback');
  }
}

function stopQRScanner() {
  if (html5QrCode && isScanning) {
    html5QrCode.stop().then(() => {
      isScanning = false;
      console.log('QR Scanner durduruldu');
    }).catch(err => {
      console.log('Scanner durdurma hatası:', err);
      isScanning = false;
    });
  }
}

async function onQRCodeScanned(qrCode) {
  // Debounce - aynı kod 2 saniye içinde tekrar taranmasın
  const now = Date.now();
  if (qrCode === lastScannedCode && (now - lastScanTime) < 2000) {
    console.log('Aynı QR kod çok hızlı tarandı, atlanıyor');
    return;
  }
  
  lastScannedCode = qrCode;
  lastScanTime = now;
  
  // QR tarama sesi
  playSound('qr_scan');
  
  stopQRScanner();
  await loadQuestion(qrCode);
}

// Manual QR Entry
document.getElementById('manual-qr-btn').addEventListener('click', () => {
  manualQrModal.classList.remove('hidden');
  manualQrInput.focus();
});

document.getElementById('submit-qr-btn').addEventListener('click', async () => {
  const qrCode = manualQrInput.value.trim();
  if (qrCode) {
    manualQrModal.classList.add('hidden');
    stopQRScanner();
    await loadQuestion(qrCode);
    manualQrInput.value = '';
  }
});

document.getElementById('cancel-qr-btn').addEventListener('click', () => {
  manualQrModal.classList.add('hidden');
  manualQrInput.value = '';
});

// Load Question
async function loadQuestion(qrCode) {
  try {
    console.log('Soru yükleniyor, QR:', qrCode);
    
    const response = await fetch(`/api/questions/qr/${qrCode}`);
    if (!response.ok) {
      console.log('API hatası:', response.status);
      showQRNotFoundModal(`"${qrCode}" koduna ait soru bulunamadı.`);
      return;
    }
    
    const question = await response.json();
    console.log('Soru yüklendi:', question.type, question.question_text?.substring(0, 50));
    
    gameState.currentQuestion = question;
    displayQuestion(question);
  } catch (error) {
    console.error('Soru yüklenirken hata:', error);
    showQRNotFoundModal('Soru yüklenirken bir hata oluştu!');
  }
}

// QR Bulunamadı Modal
function showQRNotFoundModal(message) {
  const modal = document.getElementById('qr-not-found-modal');
  const messageEl = document.getElementById('qr-not-found-message');
  messageEl.textContent = message;
  modal.classList.remove('hidden');
  
  // Lucide ikonunu güncelle
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function hideQRNotFoundModal() {
  const modal = document.getElementById('qr-not-found-modal');
  modal.classList.add('hidden');
  
  // Eğer soru görünüyorsa gizle
  const questionWrapper = document.getElementById('question-wrapper');
  if (questionWrapper && !questionWrapper.classList.contains('hidden')) {
    questionWrapper.classList.add('hidden');
  }
  
  // QR container'ı göster
  const qrContainer = document.getElementById('qr-container');
  if (qrContainer) {
    qrContainer.classList.remove('hidden');
  }
  
  // Just restart QR scanner, don't show type selection again
  startQRScanner();
}

// QR Bulunamadı Modal OK butonu
document.getElementById('qr-not-found-ok-btn').addEventListener('click', hideQRNotFoundModal);

// Display Question
function displayQuestion(question) {
  qrContainer.classList.add('hidden');
  
  // Soru belirir sesi
  playSound('question_appear');
  
  // Show question wrapper with progress border
  const questionWrapper = document.getElementById('question-wrapper');
  questionWrapper.classList.remove('hidden');
  
  // Update progress border
  updateProgressBorder();
  
  // Get image - check image_url or application check image (base64 or legacy localStorage key)
  let imageHtml = '';
  const rawImage = question.image_url || question.application?.checkImage || null;
  if (rawImage) {
    let imageSrc = rawImage;

    // Legacy support: if it's a localStorage key, try to get from localStorage
    if (typeof rawImage === 'string' && rawImage.startsWith('quiz_image_')) {
      const imageData = localStorage.getItem(rawImage);
      if (imageData) {
        imageSrc = imageData;
      } else {
        imageSrc = null; // Image not found in localStorage
      }
    }

    if (imageSrc) {
      imageHtml = `<img src="${imageSrc}" class="question-image" alt="Soru görseli">`;
    }
  }
  
  const questionHeaderHtml = `
    <div class="question-header">
      ${imageHtml}
      <p class="question-text">${question.question_text}</p>
    </div>
  `;

  // Timer HTML if time_limit is set
  let timerHtml = '';
  if (question.time_limit && question.time_limit > 0) {
    timerHtml = `
      <div class="question-timer">
        <div class="timer-circle-container">
          <svg viewBox="0 0 36 36">
            <path class="timer-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            <path class="timer-progress" id="timer-progress" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          </svg>
          <span class="timer-text" id="timer-text">${question.time_limit}</span>
        </div>
      </div>
    `;
  }

  const mode = getQuestionMode(question);
  const baseType = getQuestionBaseType(question);

  const buildBaseQuestionHtml = () => {
    const questionHeaderText = baseType === 'fillblank'
      ? ''
      : `<p class="question-text">${question.question_text}</p>`;

    let baseHtml = `
      <div class="question-header">
        ${imageHtml}
        ${questionHeaderText}
      </div>`;

    if (baseType === 'multiple') {
      baseHtml += `<div class="answer-options">`;
      const letters = ['A', 'B', 'C', 'D'];
      question.options.forEach((option, index) => {
        baseHtml += `
          <button class="option-btn" data-answer="${letters[index]}">
            <span class="option-letter">${letters[index]}</span>
            <span>${option}</span>
          </button>
        `;
      });
      baseHtml += `</div>`;
    } else if (baseType === 'truefalse') {
      baseHtml += `
        <div class="true-false-options">
          <button class="tf-btn true-btn" data-answer="true">
            <span class="tf-icon">✓</span>
            <span>Doğru</span>
          </button>
          <button class="tf-btn false-btn" data-answer="false">
            <span class="tf-icon">✗</span>
            <span>Yanlış</span>
          </button>
        </div>
      `;
    } else if (baseType === 'fillblank') {
      // fill_blanks null check
      if (!question.fill_blanks || !question.fill_blanks.answers || !question.fill_blanks.options) {
        baseHtml += `<div class="error-message">Bu soru için veri eksik. Lütfen soruyu düzenleyin.</div>`;
      } else {
        baseHtml += `<div class="fill-blank-container">`;
        
        // Parse question with blanks
        let questionWithBlanks = question.question_text;
        const blanks = question.fill_blanks.answers;
        
        blanks.forEach((blank, index) => {
          questionWithBlanks = questionWithBlanks.replace('___', `<span class="blank-slot" data-index="${index}"></span>`);
        });
        
        baseHtml += `<div class="fill-blank-question">${questionWithBlanks}</div>`;
        baseHtml += `<div class="draggable-options">`;
        
        // Shuffle options
        const shuffledOptions = [...question.fill_blanks.options].sort(() => Math.random() - 0.5);
        shuffledOptions.forEach(option => {
          baseHtml += `<div class="draggable-word" draggable="true" data-word="${option}">${option}</div>`;
        });
        
        baseHtml += `</div>`;
        baseHtml += `<button class="btn-primary submit-answer-btn" id="submit-fill-blank">Cevabı Kontrol Et</button>`;
        baseHtml += `</div>`;
      }
    } else if (baseType === 'matching') {
      baseHtml += `
        <div class="matching-container">
          <div class="matching-columns">
            <div class="matching-left" id="matching-left">
              <!-- Left items -->
            </div>
            <div class="matching-lines" id="matching-lines">
              <svg id="matching-svg"></svg>
            </div>
            <div class="matching-right" id="matching-right">
              <!-- Right items (shuffled) -->
            </div>
          </div>
          <div class="matching-actions">
            <button class="btn-primary submit-answer-btn" id="submit-matching">Eşleştirmeyi Kontrol Et</button>
          </div>
        </div>
      `;
    } else if (baseType === 'drag_drop') {
      baseHtml += `
        <div class="dragdrop-container">
          <div class="dragdrop-zones" id="dragdrop-zones">
            <!-- Drop zones will be added dynamically -->
          </div>
          <div class="dragdrop-items" id="dragdrop-items">
            <!-- Draggable items -->
          </div>
          <button class="btn-primary submit-answer-btn" id="submit-dragdrop">Kontrol Et</button>
        </div>
      `;
    }

    return baseHtml;
  };

  let html = '';

  if (mode === 'duel' || mode === 'group_duel') {
    if (baseType === 'application') {
      if (mode === 'duel') {
        // Duel mode - 2 players compete with opponent selection (application)
        let opponentHtml = '';
        
        // Opponent selection - show all other players
        if (gameState.duelOpponent === undefined) {
          const currentPlayerIdx = gameState.playerOrder[gameState.currentPlayerIndex];
          const otherPlayers = gameState.playerOrder.filter(idx => idx !== currentPlayerIdx);
          console.log('🎮 Duel - Mevcut oyuncu:', currentPlayerIdx, gameState.players[currentPlayerIdx]?.name);
          console.log('🎮 Duel - Rakip seçenekleri:', otherPlayers.map(idx => `${idx}: ${gameState.players[idx]?.name}`));
          
          if (otherPlayers.length > 0) {
            opponentHtml = `
              <div class="duel-opponent-selector" id="duel-opponent-selector">
                <h3>Karşılacak Oyuncuyu Seçin:</h3>
                <div class="opponent-buttons">
                  ${otherPlayers.map(opponentIdx => `
                    <button class="opponent-btn" onclick="selectDuelOpponent(${opponentIdx})">
                      <div class="opponent-color" style="background: ${gameState.players[opponentIdx].color.gradient || gameState.players[opponentIdx].color}"></div>
                      <div class="opponent-name">${gameState.players[opponentIdx].name}</div>
                    </button>
                  `).join('')}
                </div>
              </div>
            `;
          }
        }
        
        const appData = question.application || {};
        const hintText = appData.checkText || '';
        const instructions = appData.instructions || '';
        const checkImage = appData.checkImage || question.check_image || '';
        const currentPlayerIdx = gameState.playerOrder[gameState.currentPlayerIndex];
        const currentPlayerColor = gameState.players[currentPlayerIdx].color;
        const opponentColor = gameState.duelOpponent !== undefined ? gameState.players[gameState.duelOpponent].color : 'gray';

        html = timerHtml + `
          <div class="duel-container application-container">
            <div class="duel-header">
              <span class="duel-title">KAPIŞMA - 2 Kişi</span>
            </div>
            ${questionHeaderHtml}
            ${opponentHtml}
            ${gameState.duelOpponent !== undefined ? `
              <div class="duel-matchup">
                <div class="duel-player">
                  <div class="player-badge" style="background: ${currentPlayerColor.gradient || currentPlayerColor}"></div>
                  <span class="player-name">${gameState.players[currentPlayerIdx].name}</span>
                </div>
                <div class="vs-text">vs</div>
                <div class="duel-opponent">
                  <div class="player-badge" style="background: ${opponentColor.gradient || opponentColor}"></div>
                  <span class="player-name">${gameState.players[gameState.duelOpponent].name}</span>
                </div>
              </div>
              ${hintText ? `<div class="application-hint"><p class="task-hint">💡 İpucu: ${hintText}</p></div>` : ''}
              <div class="application-status" id="application-status">
                <p class="status-waiting">${instructions || 'Görevi gerçekleştirin ve kontrol edin.'}</p>
              </div>
              <div class="application-buttons" id="application-buttons">
                ${question.time_limit && question.time_limit > 0 ? `
                <button class="btn-secondary application-start-timer" id="application-start-timer">Süreyi Başlat</button>
                ` : ''}
                <button class="btn-primary application-check hidden" id="application-check">
                  <i data-lucide="check-circle" class="btn-icon-svg"></i> Kontrol Et
                </button>
              </div>
              <div class="application-verify hidden" id="application-verify">
                ${checkImage ? `<img src="${checkImage}" alt="Kontrol Görseli" class="application-check-image">` : '<div class="application-check-placeholder"><i data-lucide="image" class="check-placeholder-icon"></i><p>Kontrol Görseli</p></div>'}
                <p class="verify-question">Uygulama doğru mu?</p>
                <div class="verify-buttons">
                  <button class="btn-success verify-correct" id="verify-correct">Doğru</button>
                  <button class="btn-danger verify-wrong" id="verify-wrong">Yanlış</button>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      } else {
        // Group Duel - all players compete with application task
        const appData = question.application || {};
        const hintText = appData.checkText || '';
        const instructions = appData.instructions || '';
        const checkImage = appData.checkImage || question.check_image || '';

        html = timerHtml + `
          <div class="group-duel-container application-container">
            <div class="duel-header">
              <span class="duel-title">KAPIŞMA - Hep Birlikte</span>
            </div>
            ${questionHeaderHtml}
            ${hintText ? `<div class="application-hint"><p class="task-hint">💡 İpucu: ${hintText}</p></div>` : ''}
            <div class="application-status" id="application-status">
              <p class="status-waiting">${instructions || 'Görevi gerçekleştirin ve kontrol edin.'}</p>
            </div>
            <div class="application-buttons" id="application-buttons">
              ${question.time_limit && question.time_limit > 0 ? `
              <button class="btn-secondary application-start-timer" id="application-start-timer">Süreyi Başlat</button>
              ` : ''}
              <button class="btn-primary application-check hidden" id="application-check">
                <i data-lucide="check-circle" class="btn-icon-svg"></i> Kontrol Et
              </button>
            </div>
            <div class="application-verify hidden" id="application-verify">
              ${checkImage ? `<img src="${checkImage}" alt="Kontrol Görseli" class="application-check-image">` : '<div class="application-check-placeholder"><i data-lucide="image" class="check-placeholder-icon"></i><p>Kontrol Görseli</p></div>'}
              <p class="verify-question">Uygulama doğru mu?</p>
              <div class="verify-buttons">
                <button class="btn-success verify-correct" id="verify-correct">Doğru</button>
                <button class="btn-danger verify-wrong" id="verify-wrong">Yanlış</button>
              </div>
            </div>
          </div>
        `;
      }
    } else {
      const baseQuestionHtml = buildBaseQuestionHtml();

      if (mode === 'duel') {
        let opponentHtml = '';
        
        if (gameState.duelOpponent === undefined) {
          const currentPlayerIdx = gameState.playerOrder[gameState.currentPlayerIndex];
          const otherPlayers = gameState.playerOrder.filter(idx => idx !== currentPlayerIdx);
          if (otherPlayers.length > 0) {
            opponentHtml = `
              <div class="duel-opponent-selector" id="duel-opponent-selector">
                <h3>Karşılacak Oyuncuyu Seçin:</h3>
                <div class="opponent-buttons">
                  ${otherPlayers.map(opponentIdx => `
                    <button class="opponent-btn" onclick="selectDuelOpponent(${opponentIdx})">
                      <div class="opponent-color" style="background: ${gameState.players[opponentIdx].color.gradient || gameState.players[opponentIdx].color}"></div>
                      <div class="opponent-name">${gameState.players[opponentIdx].name}</div>
                    </button>
                  `).join('')}
                </div>
              </div>
            `;
          }
        }

        const currentPlayerIdx = gameState.playerOrder[gameState.currentPlayerIndex];
        const currentPlayerColor = gameState.players[currentPlayerIdx].color;
        const opponentColor = gameState.duelOpponent !== undefined ? gameState.players[gameState.duelOpponent].color : 'gray';

        html = timerHtml + `
          <div class="duel-container">
            <div class="duel-header">
              <span class="duel-title">KAPIŞMA - 2 Kişi</span>
            </div>
            ${opponentHtml}
            ${gameState.duelOpponent !== undefined ? `
              <div class="duel-matchup">
                <div class="duel-player">
                  <div class="player-badge" style="background: ${currentPlayerColor.gradient || currentPlayerColor}"></div>
                  <span class="player-name">${gameState.players[currentPlayerIdx].name}</span>
                </div>
                <div class="vs-text">vs</div>
                <div class="duel-opponent">
                  <div class="player-badge" style="background: ${opponentColor.gradient || opponentColor}"></div>
                  <span class="player-name">${gameState.players[gameState.duelOpponent].name}</span>
                </div>
              </div>
              <div class="duel-question-content">
                ${baseQuestionHtml}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        html = timerHtml + `
          <div class="group-duel-container">
            <div class="duel-header">
              <span class="duel-title">KAPIŞMA - Hep Birlikte</span>
            </div>
            <div class="duel-question-content">
              ${baseQuestionHtml}
            </div>
          </div>
        `;
      }
    }
  } else if (baseType === 'application') {
    const appData = question.application || {};
    const hintText = appData.checkText || '';
    const instructions = appData.instructions || '';
    const checkImage = appData.checkImage || question.check_image || '';

    html = timerHtml + `
      <div class="application-container">
        <div class="application-header">
          <span>UYGULAMA</span>
        </div>
        ${questionHeaderHtml}
        ${hintText ? `<div class="application-hint"><p class="task-hint">💡 İpucu: ${hintText}</p></div>` : ''}
        <div class="application-status" id="application-status">
          <p class="status-waiting">${instructions || 'Görevi gerçekleştirin ve kontrol edin.'}</p>
        </div>
        <div class="application-buttons" id="application-buttons">
          ${question.time_limit && question.time_limit > 0 ? `
          <button class="btn-secondary application-start-timer" id="application-start-timer">Süreyi Başlat</button>
          ` : ''}
          <button class="btn-primary application-check hidden" id="application-check">
            <i data-lucide="check-circle" class="btn-icon-svg"></i> Kontrol Et
          </button>
        </div>
        <div class="application-verify hidden" id="application-verify">
          ${checkImage ? `<img src="${checkImage}" alt="Kontrol Görseli" class="application-check-image">` : '<div class="application-check-placeholder"><i data-lucide="image" class="check-placeholder-icon"></i><p>Kontrol Görseli</p></div>'}
          <p class="verify-question">Uygulama doğru mu?</p>
          <div class="verify-buttons">
            <button class="btn-success verify-correct" id="verify-correct">Doğru</button>
            <button class="btn-danger verify-wrong" id="verify-wrong">Yanlış</button>
          </div>
        </div>
      </div>
    `;
  } else {
    html = timerHtml + buildBaseQuestionHtml();
  }

  questionCard.innerHTML = html;

  // Start timer if time_limit is set
  if (baseType !== 'application' && question.time_limit && question.time_limit > 0) {
    if (!(mode === 'duel' && gameState.duelOpponent === undefined)) {
      startQuestionTimer(question.time_limit, question);
    }
  }

  // Add event listeners based on question type
  if (mode === 'duel' && gameState.duelOpponent === undefined) {
    return;
  }

  if (baseType === 'multiple') {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => checkAnswer(btn.dataset.answer, question));
    });
  } else if (baseType === 'truefalse') {
    document.querySelectorAll('.tf-btn').forEach(btn => {
      btn.addEventListener('click', () => checkAnswer(btn.dataset.answer, question));
    });
  } else if (baseType === 'fillblank') {
    const submitBtn = document.getElementById('submit-fill-blank');
    if (submitBtn) {
      setupDragAndDrop();
      submitBtn.addEventListener('click', () => checkFillBlankAnswer(question));
    }
  } else if (mode === 'duel' && baseType === 'application') {
    setupDuelMode(question);
  } else if (mode === 'group_duel' && baseType === 'application') {
    setupGroupDuelMode(question);
  } else if (baseType === 'matching') {
    setupMatchingGame(question);
  } else if (baseType === 'drag_drop') {
    setupDragDropGame(question);
  } else if (baseType === 'application') {
    setupApplicationMode(question);
  }
}

// Drag and Drop for Fill Blank
let selectedWord = null;

function setupDragAndDrop() {
  const draggables = document.querySelectorAll('.draggable-word');
  const slots = document.querySelectorAll('.blank-slot');
  
  if (draggables.length === 0 || slots.length === 0) {
    console.error('Drag and drop elemanları bulunamadı:', draggables.length, slots.length);
    return;
  }
  
  console.log('Drag and drop kurulumu:', draggables.length, 'kelime,', slots.length, 'boşluk');
  
  // Touch drag state
  let draggedElement = null;
  let dragClone = null;
  let touchOffsetX = 0;
  let touchOffsetY = 0;
  
  // Kelime seçimi
  draggables.forEach(draggable => {
    // Desktop drag
    draggable.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', draggable.dataset.word);
      draggable.classList.add('dragging');
    });
    
    draggable.addEventListener('dragend', () => {
      draggable.classList.remove('dragging');
    });
    
    // Touch sürükleme başlat
    draggable.addEventListener('touchstart', (e) => {
      if (draggable.classList.contains('used')) return;
      
      e.preventDefault();
      const touch = e.touches[0];
      const rect = draggable.getBoundingClientRect();
      
      touchOffsetX = touch.clientX - rect.left;
      touchOffsetY = touch.clientY - rect.top;
      
      // Sürüklenen elemanın klonunu oluştur
      dragClone = draggable.cloneNode(true);
      dragClone.classList.add('drag-clone');
      dragClone.style.position = 'fixed';
      dragClone.style.left = (touch.clientX - touchOffsetX) + 'px';
      dragClone.style.top = (touch.clientY - touchOffsetY) + 'px';
      dragClone.style.zIndex = '9999';
      dragClone.style.pointerEvents = 'none';
      dragClone.style.opacity = '0.9';
      dragClone.style.transform = 'scale(1.1)';
      document.body.appendChild(dragClone);
      
      draggedElement = draggable;
      draggable.classList.add('dragging');
    });
    
    // Tıklama ile seçim (alternatif yöntem)
    draggable.addEventListener('click', (e) => {
      e.preventDefault();
      if (draggable.classList.contains('used')) return;
      
      document.querySelectorAll('.draggable-word.selected').forEach(el => el.classList.remove('selected'));
      draggable.classList.add('selected');
      selectedWord = draggable.dataset.word;
    });
  });
  
  // Touch hareket
  document.addEventListener('touchmove', (e) => {
    if (!dragClone) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    dragClone.style.left = (touch.clientX - touchOffsetX) + 'px';
    dragClone.style.top = (touch.clientY - touchOffsetY) + 'px';
    
    // Hangi slot'un üzerinde olduğunu kontrol et
    slots.forEach(slot => {
      const rect = slot.getBoundingClientRect();
      if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
          touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        slot.classList.add('drag-over');
      } else {
        slot.classList.remove('drag-over');
      }
    });
  }, { passive: false });
  
  // Touch bırak
  document.addEventListener('touchend', (e) => {
    if (!dragClone || !draggedElement) return;
    
    const touch = e.changedTouches[0];
    
    // Hangi slot'a bırakıldı?
    slots.forEach(slot => {
      slot.classList.remove('drag-over');
      const rect = slot.getBoundingClientRect();
      
      if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
          touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        
        if (!slot.classList.contains('filled')) {
          const word = draggedElement.dataset.word;
          slot.textContent = word;
          slot.dataset.word = word;
          slot.classList.add('filled');
          draggedElement.classList.add('used');
        }
      }
    });
    
    // Temizle
    draggedElement.classList.remove('dragging');
    dragClone.remove();
    dragClone = null;
    draggedElement = null;
  });
  
  // Boşluk seçimi
  slots.forEach(slot => {
    // Desktop drop
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('drag-over');
    });
    
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
    });
    
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      const word = e.dataTransfer.getData('text/plain');
      
      if (!slot.classList.contains('filled')) {
        slot.textContent = word;
        slot.dataset.word = word;
        slot.classList.add('filled');
        
        const draggable = document.querySelector(`.draggable-word[data-word="${word}"]`);
        if (draggable) draggable.classList.add('used');
      }
    });
    
    // Tıklama ile yerleştirme veya kaldırma
    slot.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (slot.classList.contains('filled')) {
        // Doluysa kaldır
        const word = slot.dataset.word;
        slot.textContent = '';
        slot.dataset.word = '';
        slot.classList.remove('filled');
        
        const draggable = document.querySelector(`.draggable-word[data-word="${word}"]`);
        if (draggable) {
          draggable.classList.remove('used');
          draggable.classList.remove('selected');
        }
      } else if (selectedWord) {
        // Boşsa ve seçili kelime varsa yerleştir
        slot.textContent = selectedWord;
        slot.dataset.word = selectedWord;
        slot.classList.add('filled');
        
        const draggable = document.querySelector(`.draggable-word[data-word="${selectedWord}"]`);
        if (draggable) {
          draggable.classList.add('used');
          draggable.classList.remove('selected');
        }
        selectedWord = null;
      }
    });
  });
}

// Question Timer
let questionTimerInterval = null;
let questionTimeRemaining = 0;

function startQuestionTimer(seconds, question) {
  questionTimeRemaining = seconds;
  const timerText = document.getElementById('timer-text');
  const timerProgress = document.getElementById('timer-progress');
  const totalTime = seconds;
  const circumference = 100; // SVG path length approximation
  
  if (timerProgress) {
    timerProgress.style.strokeDasharray = circumference;
    timerProgress.style.strokeDashoffset = 0;
  }
  
  questionTimerInterval = setInterval(() => {
    questionTimeRemaining--;
    
    // Timer tick sesi (sadece son 10 saniyede)
    if (questionTimeRemaining <= 10 && questionTimeRemaining > 0) {
      playSound('timer_tick');
    }
    
    if (timerText) {
      timerText.textContent = questionTimeRemaining;
      
      // Change color based on time
      if (questionTimeRemaining <= 5) {
        timerText.classList.add('danger');
        timerText.classList.remove('warning');
      } else if (questionTimeRemaining <= 10) {
        timerText.classList.add('warning');
        timerText.classList.remove('danger');
        // Uyarı sesi (10. saniyede bir kere)
        if (questionTimeRemaining === 10) {
          playSound('timer_warning');
        }
      }
    }
    
    if (timerProgress) {
      const progress = (totalTime - questionTimeRemaining) / totalTime;
      timerProgress.style.strokeDashoffset = circumference * progress;
      
      // Change color based on time
      if (questionTimeRemaining <= 5) {
        timerProgress.classList.add('danger');
        timerProgress.classList.remove('warning');
      } else if (questionTimeRemaining <= 10) {
        timerProgress.classList.add('warning');
        timerProgress.classList.remove('danger');
      }
    }
    
    if (questionTimeRemaining <= 0) {
      clearInterval(questionTimerInterval);
      questionTimerInterval = null;
      // Süre bitti sesi
      playSound('timer_end');
      handleTimeUp(question);
    }
  }, 1000);
}

function stopQuestionTimer() {
  if (questionTimerInterval) {
    clearInterval(questionTimerInterval);
    questionTimerInterval = null;
  }
  // Clear timer from question card
  const questionTimer = document.querySelector('.question-timer');
  if (questionTimer) {
    questionTimer.remove();
  }
}

function handleTimeUp(question) {
  // Eğer cevap zaten verilmişse (result indicator görünürse) bir şey yapma
  if (!resultIndicator.classList.contains('hidden')) {
    return;
  }
  
  // Disable all answer buttons
  document.querySelectorAll('.option-btn, .tf-btn, .duel-buzzer, .submit-answer-btn, .draggable-word, .blank-slot, .application-check, .verify-correct, .verify-wrong').forEach(btn => {
    btn.disabled = true;
    btn.style.pointerEvents = 'none';
  });

  // Hide control buttons after time up
  document.querySelectorAll('.submit-answer-btn').forEach(btn => {
    btn.classList.add('hidden');
  });
  
  // Show time up message with styled icon
  const questionTimer = document.querySelector('.question-timer');
  if (questionTimer) {
    questionTimer.innerHTML = `
      <div class="time-up-badge">
        <i data-lucide="alarm-clock-off"></i>
        <span>Süre Doldu!</span>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  
  // Kapışma modlarında süre dolarsa katılan herkes -adım alsın
  const mode = getQuestionMode(question);
  const baseType = getQuestionBaseType(question);
  if (mode === 'duel') {
    showDuelBothWrong(question);
    return;
  }
  if (mode === 'group_duel') {
    showGroupDuelResult(false, question);
    return;
  }
  
  // Treat as wrong answer
  showQuestionResult(false, question);
}

// Duel Opponent Selection
function selectDuelOpponent(opponentIdx) {
  gameState.duelOpponent = opponentIdx;
  console.log('Seçilen rakip:', gameState.players[opponentIdx].name);
  console.log('Mevcut oyuncu:', gameState.currentPlayerIndex, gameState.players[gameState.currentPlayerIndex].name);
  
  // Soruyu yeniden göster
  const question = gameState.currentQuestion;
  if (question && getQuestionMode(question) === 'duel') {
    displayQuestion(question);
    // Süreyi manuel başlatacak - auto-start yok
  }
}

// Duel Mode Setup - Application task with 2 player competition
function setupDuelMode(question) {
  // Check if opponent is selected
  if (gameState.duelOpponent === undefined) {
    console.log('Rakip seçilmedi, seçim bekleniyor');
    return;
  }
  
  // Application modunda kullanılan aynı kurulum
  const startTimerBtn = document.getElementById('application-start-timer');
  const checkBtn = document.getElementById('application-check');
  const verifySection = document.getElementById('application-verify');
  const buttonsSection = document.getElementById('application-buttons');
  const statusSection = document.getElementById('application-status');

  // Süreyi başlat butonuna tıklandığında (manuel başlatma)
  if (startTimerBtn) {
    startTimerBtn.addEventListener('click', () => {
      // Butonu gizle
      startTimerBtn.classList.add('timer-started');
      startTimerBtn.disabled = true;
      
      // Kontrol Et butonunu göster
      if (checkBtn) {
        checkBtn.classList.remove('hidden');
      }
      
      // Süre başladığına dair uyarı sesi çal
      playSound('timer_warning');
      
      // Süreyi başlat
      if (question.time_limit && question.time_limit > 0) {
        startQuestionTimer(question.time_limit, question);
      }
    });
  }
  
  // Kontrol Et butonuna tıklandığında
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      // Süreyi durdur
      stopQuestionTimer();
      
      // Kontrol Et butonunu gizle
      buttonsSection.classList.add('hidden');
      statusSection.classList.add('hidden');
      
      // Kontrol görseli ve doğru/yanlış butonlarını göster
      verifySection.classList.remove('hidden');
      
      // Lucide ikonlarını oluştur
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }
  
  // Doğru butonuna tıklandığında (Duel: First player to finish correctly wins)
  document.getElementById('verify-correct').addEventListener('click', () => {
    document.getElementById('verify-correct').disabled = true;
    document.getElementById('verify-wrong').disabled = true;
    showDuelResult(true, question);
  });
  
  // Yanlış butonuna tıklandığında (Her iki oyuncu da - puan alır)
  document.getElementById('verify-wrong').addEventListener('click', () => {
    document.getElementById('verify-correct').disabled = true;
    document.getElementById('verify-wrong').disabled = true;
    showDuelBothWrong(question);
  });
}

function showDuelBothWrong(question) {
  // Her iki oyuncuya da yanlış adım uygula
  const wrongSteps = question.wrong_steps || 1;
  const playerIdx = getCurrentPlayerIndex();
  const opponentIdx = gameState.duelOpponent;
  
  if (opponentIdx === undefined) {
    showResult(false);
    return;
  }
  
  // Verify section'dan sadece başlık ve butonları gizle
  const verifyQuestion = document.querySelector('.verify-question');
  const verifyButtons = document.querySelector('.verify-buttons');
  if (verifyQuestion) verifyQuestion.style.display = 'none';
  if (verifyButtons) verifyButtons.style.display = 'none';
  
  // Her iki oyuncunun da puanını düşür (0'ın altına inmesin)
  const playerPrevScore = Number(gameState.scores[playerIdx] || 0);
  const opponentPrevScore = Number(gameState.scores[opponentIdx] || 0);
  const playerNewScore = Math.max(0, playerPrevScore - wrongSteps);
  const opponentNewScore = Math.max(0, opponentPrevScore - wrongSteps);
  const playerChange = playerNewScore - playerPrevScore;
  const opponentChange = opponentNewScore - opponentPrevScore;
  gameState.scores[playerIdx] = playerNewScore;
  gameState.scores[opponentIdx] = opponentNewScore;
  
  // Sonuçları göster
  const playerName = gameState.players[playerIdx].name;
  const opponentName = gameState.players[opponentIdx].name;
  const playerColor = gameState.players[playerIdx].color;
  const opponentColor = gameState.players[opponentIdx].color;
  
  resultIndicator.classList.remove('hidden', 'correct', 'wrong');
  resultIndicator.classList.add('wrong');
  
  resultIndicator.innerHTML = `
    <div class="duel-result-container">
      <div class="result-header">
        <div class="result-icon result-icon-error">
          <i data-lucide="thumbs-down"></i>
        </div>
        <h3 class="result-title">HER İKİSİ DE YANLIŞ!</h3>
      </div>
      <div class="duel-result-players">
        <div class="result-player loser-player">
          <div class="result-player-badge" style="background: ${playerColor.gradient || playerColor}"></div>
          <div class="result-player-name">${playerName}</div>
          <div class="result-player-score negative">${playerChange} adım</div>
        </div>
        <div class="result-player loser-player">
          <div class="result-player-badge" style="background: ${opponentColor.gradient || opponentColor}"></div>
          <div class="result-player-name">${opponentName}</div>
          <div class="result-player-score negative">${opponentChange} adım</div>
        </div>
      </div>
      <div class="result-actions"><button class="btn-primary result-ok-btn">Tamam</button></div>
    </div>
  `;
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  const okBtn = resultIndicator.querySelector('.result-ok-btn');
  if (okBtn) {
    okBtn.addEventListener('click', () => {
      okBtn.disabled = true;
      resultIndicator.classList.add('hidden');
      gameState.duelOpponent = undefined;
      addNextPlayerButton();
    });
  }
  
  // Sunucuya bildir
  socket.emit('answer-submitted', {
    gameId: gameState.gameId,
    player: playerIdx,
    isCorrect: false,
    steps: -wrongSteps,
    scores: gameState.scores
  });
  
  socket.emit('answer-submitted', {
    gameId: gameState.gameId,
    player: opponentIdx,
    isCorrect: false,
    steps: -wrongSteps,
    scores: gameState.scores
  });
  
  updateGameUI();
}

// Group Duel Mode Setup - Application task with all players competition
function setupGroupDuelMode(question) {
  // Application modunda kullanılan aynı kurulum
  const startTimerBtn = document.getElementById('application-start-timer');
  const checkBtn = document.getElementById('application-check');
  const verifySection = document.getElementById('application-verify');
  const buttonsSection = document.getElementById('application-buttons');
  const statusSection = document.getElementById('application-status');

  // Süreyi başlat butonuna tıklandığında (manuel başlatma)
  if (startTimerBtn) {
    startTimerBtn.addEventListener('click', () => {
      // Butonu gizle
      startTimerBtn.classList.add('timer-started');
      startTimerBtn.disabled = true;
      
      // Kontrol Et butonunu göster
      if (checkBtn) {
        checkBtn.classList.remove('hidden');
      }
      
      // Süre başladığına dair uyarı sesi çal
      playSound('timer_warning');
      
      // Süreyi başlat
      if (question.time_limit && question.time_limit > 0) {
        startQuestionTimer(question.time_limit, question);
      }
    });
  }
  
  // Kontrol Et butonuna tıklandığında
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      // Süreyi durdur
      stopQuestionTimer();
      
      // Kontrol Et butonunu gizle
      buttonsSection.classList.add('hidden');
      statusSection.classList.add('hidden');
      
      // Kontrol görseli ve doğru/yanlış butonlarını göster
      verifySection.classList.remove('hidden');
      
      // Lucide ikonlarını oluştur
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }
  
  // Doğru butonuna tıklandığında (Group Duel: First player to finish correctly wins, others lose)
  document.getElementById('verify-correct').addEventListener('click', () => {
    document.getElementById('verify-correct').disabled = true;
    document.getElementById('verify-wrong').disabled = true;
    showGroupDuelResult(true, question);
  });
  
  // Yanlış butonuna tıklandığında
  document.getElementById('verify-wrong').addEventListener('click', () => {
    document.getElementById('verify-correct').disabled = true;
    document.getElementById('verify-wrong').disabled = true;
    showGroupDuelResult(false, question);
  });
}

// Matching Game Setup
function setupMatchingGame(question) {
  const leftColumn = document.getElementById('matching-left');
  const rightColumn = document.getElementById('matching-right');
  const pairs = question.matching_pairs || [];
  
  let selectedLeft = null;
  const connections = [];

  const clearConnectionVisuals = (conn) => {
    const leftItem = document.querySelector(`.matching-left-item[data-index="${conn.left}"]`);
    const rightItem = document.querySelector(`.matching-right-item[data-original="${conn.right}"]`);

    if (leftItem) {
      leftItem.classList.remove('connected');
      leftItem.removeAttribute('data-pair');
    }

    if (rightItem) {
      rightItem.classList.remove('connected');
      rightItem.removeAttribute('data-pair');
    }
  };

  const applyPairBadge = (item, pairId) => {
    item.setAttribute('data-pair', pairId);
  };
  
  // Create left items
  pairs.forEach((pair, index) => {
    const leftItem = document.createElement('div');
    leftItem.className = 'matching-item matching-left-item';
    leftItem.dataset.index = index;
    leftItem.textContent = pair.left;
    leftColumn.appendChild(leftItem);
  });
  
  // Create shuffled right items
  const shuffledPairs = [...pairs].sort(() => Math.random() - 0.5);
  shuffledPairs.forEach((pair, index) => {
    const rightItem = document.createElement('div');
    rightItem.className = 'matching-item matching-right-item';
    rightItem.dataset.original = pairs.findIndex(p => p.right === pair.right);
    rightItem.textContent = pair.right;
    rightColumn.appendChild(rightItem);
  });
  
  // Click handlers
  document.querySelectorAll('.matching-left-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.matching-left-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedLeft = item.dataset.index;
    });
  });
  
  document.querySelectorAll('.matching-right-item').forEach(item => {
    item.addEventListener('click', () => {
      if (selectedLeft === null) return;
      
      // Check if already connected
      const existingConn = connections.find(c => c.left === selectedLeft || c.right === item.dataset.original);
      if (existingConn) {
        // Remove existing connection
        clearConnectionVisuals(existingConn);
        connections.splice(connections.indexOf(existingConn), 1);
      }
      
      const pairId = Number(selectedLeft) + 1;
      connections.push({
        left: selectedLeft,
        right: item.dataset.original,
        pairId
      });
      
      // Visual feedback
      const leftItem = document.querySelector(`.matching-left-item[data-index="${selectedLeft}"]`);
      leftItem.classList.add('connected');
      applyPairBadge(leftItem, pairId);
      item.classList.add('connected');
      applyPairBadge(item, pairId);
      
      document.querySelectorAll('.matching-left-item').forEach(i => i.classList.remove('selected'));
      selectedLeft = null;
      
      drawMatchingLines(connections);
    });
  });

  const redrawLines = () => drawMatchingLines(connections);
  leftColumn.addEventListener('scroll', redrawLines, { passive: true });
  rightColumn.addEventListener('scroll', redrawLines, { passive: true });
  window.addEventListener('resize', redrawLines);
  
  // Submit button
  document.getElementById('submit-matching').addEventListener('click', () => {
    let allCorrect = true;
    
    connections.forEach(conn => {
      const leftItem = document.querySelector(`.matching-left-item[data-index="${conn.left}"]`);
      const rightItem = document.querySelector(`.matching-right-item[data-original="${conn.right}"]`);
      
      if (conn.left === conn.right) {
        leftItem.classList.add('correct');
        rightItem.classList.add('correct');
      } else {
        leftItem.classList.add('wrong');
        rightItem.classList.add('wrong');
        allCorrect = false;
      }
    });
    
    // Check if all pairs are connected
    if (connections.length !== pairs.length) {
      allCorrect = false;
    }
    
    document.getElementById('submit-matching').disabled = true;
    document.getElementById('submit-matching').classList.add('hidden');
    stopQuestionTimer();
    showQuestionResult(allCorrect, question);
  });
}

function drawMatchingLines(connections) {
  const svg = document.getElementById('matching-svg');
  if (!svg) return;
  
  svg.innerHTML = '';

  const lineColors = [
    '#7C3AED',
    '#2563EB',
    '#059669',
    '#D97706',
    '#DC2626',
    '#0EA5E9',
    '#9333EA'
  ];
  
  connections.forEach(conn => {
    const leftItem = document.querySelector(`.matching-left-item[data-index="${conn.left}"]`);
    const rightItem = document.querySelector(`.matching-right-item[data-original="${conn.right}"]`);
    
    if (leftItem && rightItem) {
      const leftRect = leftItem.getBoundingClientRect();
      const rightRect = rightItem.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();

      const pairColor = lineColors[(Number(conn.pairId || 1) - 1) % lineColors.length];
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', leftRect.right - svgRect.left);
      line.setAttribute('y1', leftRect.top + leftRect.height / 2 - svgRect.top);
      line.setAttribute('x2', rightRect.left - svgRect.left);
      line.setAttribute('y2', rightRect.top + rightRect.height / 2 - svgRect.top);
      line.setAttribute('stroke', pairColor);
      line.setAttribute('stroke-width', '3');
      line.setAttribute('stroke-linecap', 'round');
      
      svg.appendChild(line);
    }
  });
}

// Drag Drop Game Setup
function setupDragDropGame(question) {
  const itemsContainer = document.getElementById('dragdrop-items');
  const dragData = question.drag_drop || {};
  
  let items = [];
  let touchItem = null;
  let touchStartY = 0;
  
  if (dragData.type === 'order') {
    // For order type, items can be dragged and reordered
    items = dragData.items.map((text, index) => ({
      text: text,
      order: index
    }));
  } else if (dragData.type === 'category') {
    // For category type, create zones from categories
    const zonesContainer = document.getElementById('dragdrop-zones');
    const zones = dragData.categories.map(cat => ({ label: cat.name }));
    
    zones.forEach((zone, index) => {
      const zoneDiv = document.createElement('div');
      zoneDiv.className = 'drop-zone';
      zoneDiv.dataset.zone = index;
      zoneDiv.innerHTML = `
        <div class="zone-label">${zone.label}</div>
        <div class="zone-items" data-zone="${index}"></div>
      `;
      zonesContainer.appendChild(zoneDiv);
    });
    
    dragData.categories.forEach((cat, catIndex) => {
      cat.items.forEach(itemText => {
        items.push({
          text: itemText,
          zone: catIndex.toString()
        });
      });
    });
  }
  
  let draggedItem = null;
  
  // Create draggable items (shuffled for order type)
  const shuffledItems = dragData.type === 'order' 
    ? [...items].sort(() => Math.random() - 0.5)
    : items;
    
  shuffledItems.forEach((item) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'dragdrop-item';
    itemDiv.draggable = true;
    itemDiv.dataset.item = item.text;
    if (item.order !== undefined) {
      itemDiv.dataset.correctOrder = item.order;
    }
    if (item.zone !== undefined) {
      itemDiv.dataset.correctZone = item.zone;
    }
    itemDiv.textContent = item.text;
    itemsContainer.appendChild(itemDiv);
  });
  
  // Setup drag events for all items
  const setupAllDragEvents = () => {
    document.querySelectorAll('#dragdrop-items .dragdrop-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        document.querySelectorAll('#dragdrop-items .dragdrop-item').forEach(i => i.classList.remove('drag-over-item'));
      });
      
      // Touch events for mobile
      item.addEventListener('touchstart', (e) => {
        if (dragData.type === 'order' && !itemsContainer.classList.contains('checked')) {
          touchItem = item;
          touchStartY = e.touches[0].clientY;
          item.classList.add('dragging');
        }
      });
      
      item.addEventListener('touchend', () => {
        if (touchItem) {
          touchItem.classList.remove('dragging');
          touchItem = null;
        }
        document.querySelectorAll('#dragdrop-items .dragdrop-item').forEach(i => i.classList.remove('drag-over-item'));
      });
      
      item.addEventListener('touchmove', (e) => {
        if (!touchItem || dragData.type !== 'order' || itemsContainer.classList.contains('checked')) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const deltaY = touch.clientY - touchStartY;
        
        // Yukarı sürükle
        if (deltaY < -40) {
          const prevItem = touchItem.previousElementSibling;
          if (prevItem && prevItem.classList.contains('dragdrop-item')) {
            itemsContainer.insertBefore(touchItem, prevItem);
            setupAllDragEvents();
            touchStartY = touch.clientY;
          }
        }
        // Aşağı sürükle
        else if (deltaY > 40) {
          const nextItem = touchItem.nextElementSibling?.nextElementSibling;
          if (nextItem && nextItem.classList.contains('dragdrop-item')) {
            itemsContainer.insertBefore(touchItem, nextItem);
            setupAllDragEvents();
            touchStartY = touch.clientY;
          }
        }
      });
      
      // For order type, allow reordering within items container
      if (dragData.type === 'order') {
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (draggedItem && draggedItem !== item) {
            item.classList.add('drag-over-item');
          }
        });
        
        item.addEventListener('dragleave', () => {
          item.classList.remove('drag-over-item');
        });
        
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          if (draggedItem && draggedItem !== item) {
            itemsContainer.insertBefore(draggedItem, item);
            setupAllDragEvents();
          }
        });
      }
    });
    
    // Setup zone events for category type
    if (dragData.type === 'category') {
      document.querySelectorAll('.zone-items').forEach(zone => {
        zone.addEventListener('dragover', (e) => {
          e.preventDefault();
          zone.classList.add('drag-over');
        });
        
        zone.addEventListener('dragleave', () => {
          zone.classList.remove('drag-over');
        });
        
        zone.addEventListener('drop', (e) => {
          e.preventDefault();
          zone.classList.remove('drag-over');
          
          if (draggedItem) {
            zone.appendChild(draggedItem);
            draggedItem.classList.add('placed');
            setupAllDragEvents();
          }
        });
      });
    }
  };
  
  setupAllDragEvents();
  
  // Submit button
  document.getElementById('submit-dragdrop').addEventListener('click', () => {
    let allCorrect = true;
    
    if (dragData.type === 'order') {
      // Check order of items in container
      const placedItems = document.querySelectorAll('#dragdrop-items .dragdrop-item');
      
      placedItems.forEach((item, index) => {
        const correctOrder = parseInt(item.dataset.correctOrder);
        if (correctOrder === index) {
          item.classList.add('correct');
        } else {
          item.classList.add('wrong');
          allCorrect = false;
        }
      });
    } else {
      // Check category placement
      document.querySelectorAll('.zone-items').forEach(zone => {
        const zoneIndex = zone.dataset.zone;
        zone.querySelectorAll('.dragdrop-item').forEach(item => {
          if (item.dataset.correctZone === zoneIndex) {
            item.classList.add('correct');
          } else {
            item.classList.add('wrong');
            allCorrect = false;
          }
        });
      });
      
      // Check items not placed
      document.querySelectorAll('#dragdrop-items .dragdrop-item').forEach(item => {
        if (!item.classList.contains('placed')) {
          item.classList.add('wrong');
          allCorrect = false;
        }
      });
    }
    
    // Hide button
    document.getElementById('submit-dragdrop').classList.add('hidden');
    
    // Mark as checked
    itemsContainer.classList.add('checked');
    
    // Disable dragging
    document.querySelectorAll('#dragdrop-items .dragdrop-item').forEach(item => {
      item.draggable = false;
      item.style.cursor = 'default';
    });
    
    document.getElementById('submit-dragdrop').disabled = true;
    stopQuestionTimer();
    showQuestionResult(allCorrect, question);
  });
}

// Application Mode Setup
function setupApplicationMode(question) {
  // Lucide ikonlarını oluştur
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  const startTimerBtn = document.getElementById('application-start-timer');
  const checkBtn = document.getElementById('application-check');
  const verifySection = document.getElementById('application-verify');
  const buttonsSection = document.getElementById('application-buttons');
  const statusSection = document.getElementById('application-status');

  // Süreyi başlat butonuna tıklandığında (manuel başlatma)
  if (startTimerBtn) {
    startTimerBtn.addEventListener('click', () => {
      // Butonu gizle
      startTimerBtn.classList.add('timer-started');
      startTimerBtn.disabled = true;
      
      // Kontrol Et butonunu göster
      if (checkBtn) {
        checkBtn.classList.remove('hidden');
      }
      
      // Süre başladığına dair uyarı sesi çal
      playSound('timer_warning');
      
      // Süreyi başlat
      if (question.time_limit && question.time_limit > 0) {
        startQuestionTimer(question.time_limit, question);
      }
    });
  }
  
  // Kontrol Et butonuna tıklandığında
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      // Süreyi durdur
      stopQuestionTimer();
      
      // Kontrol Et butonunu gizle
      buttonsSection.classList.add('hidden');
      statusSection.classList.add('hidden');
      
      // Kontrol görseli ve doğru/yanlış butonlarını göster
      verifySection.classList.remove('hidden');
      
      // Lucide ikonlarını oluştur
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }
  
  // Doğru butonuna tıklandığında
  document.getElementById('verify-correct').addEventListener('click', () => {
    document.getElementById('verify-correct').disabled = true;
    document.getElementById('verify-wrong').disabled = true;
    showQuestionResult(true, question);
  });
  
  // Yanlış butonuna tıklandığında
  document.getElementById('verify-wrong').addEventListener('click', () => {
    document.getElementById('verify-correct').disabled = true;
    document.getElementById('verify-wrong').disabled = true;
    showQuestionResult(false, question);
  });
}

// Check Answer
function checkAnswer(answer, question) {
  stopQuestionTimer();
  const mode = getQuestionMode(question);
  const baseType = getQuestionBaseType(question);
  const isCorrect = answer.toLowerCase() === question.correct_answer.toLowerCase();
  
  // Ses efekti çal
  playSound(isCorrect ? 'correct_answer' : 'wrong_answer');
  
  // Highlight buttons
  if (baseType === 'multiple') {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.answer.toLowerCase() === question.correct_answer.toLowerCase()) {
        btn.classList.add('correct');
      } else if (btn.dataset.answer === answer && !isCorrect) {
        btn.classList.add('wrong');
      }
    });
  } else if (baseType === 'truefalse') {
    document.querySelectorAll('.tf-btn').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.answer === question.correct_answer) {
        btn.classList.add('correct');
      } else if (btn.dataset.answer === answer && !isCorrect) {
        btn.classList.add('wrong');
      }
    });
  }

  if (mode === 'duel' && baseType !== 'application') {
    if (isCorrect) {
      showDuelResult(true, question);
    } else {
      showDuelBothWrong(question);
    }
    return;
  }

  if (mode === 'group_duel' && baseType !== 'application') {
    showGroupDuelResult(isCorrect, question);
    return;
  }
  
  showResult(isCorrect);
}

// Check Fill Blank Answer
function checkFillBlankAnswer(question) {
  // Timer'ı durdur
  stopQuestionTimer();
  
  const slots = document.querySelectorAll('.blank-slot');
  const answers = question.fill_blanks.answers;
  let allCorrect = true;
  
  slots.forEach((slot, index) => {
    const userAnswer = slot.dataset.word || '';
    const correctAnswer = answers[index];
    
    if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
      slot.classList.add('correct');
    } else {
      slot.classList.add('wrong');
      allCorrect = false;
    }
  });
  
  // Ses efekti çal
  playSound(allCorrect ? 'correct_answer' : 'wrong_answer');
  
  // Tüm etkileşimleri devre dışı bırak
  document.getElementById('submit-fill-blank').disabled = true;
  document.querySelectorAll('.draggable-word').forEach(el => {
    el.style.pointerEvents = 'none';
  });
  document.querySelectorAll('.blank-slot').forEach(el => {
    el.style.pointerEvents = 'none';
  });

  showQuestionResult(allCorrect, question);
}

function showQuestionResult(isCorrect, question) {
  const mode = getQuestionMode(question);
  const baseType = getQuestionBaseType(question);

  if (mode === 'duel' && baseType !== 'application') {
    if (isCorrect) {
      showDuelResult(true, question);
    } else {
      showDuelBothWrong(question);
    }
    return;
  }

  if (mode === 'group_duel' && baseType !== 'application') {
    showGroupDuelResult(isCorrect, question);
    return;
  }

  // Regular application mode - gizle
  if (baseType === 'application') {
    const verifyQuestion = document.querySelector('.verify-question');
    const verifyButtons = document.querySelector('.verify-buttons');
    if (verifyQuestion) verifyQuestion.style.display = 'none';
    if (verifyButtons) verifyButtons.style.display = 'none';
  }

  showResult(isCorrect);
}

// Show Result
function showResult(isCorrect) {
  const correctSteps = gameState.currentQuestion.correct_steps || 2;
  const wrongSteps = gameState.currentQuestion.wrong_steps || 1;
  const playerIdx = getCurrentPlayerIndex();
  
  // Calculate new position
  let newPosition;
  if (isCorrect) {
    newPosition = (gameState.scores[playerIdx] || 0) + correctSteps;
  } else {
    newPosition = (gameState.scores[playerIdx] || 0) - wrongSteps;
  }
  
  // Clamp between 0 and TOTAL_STEPS
  newPosition = Math.max(0, Math.min(TOTAL_STEPS, newPosition));
  const actualChange = newPosition - (gameState.scores[playerIdx] || 0);
  
  gameState.scores[playerIdx] = newPosition;
  
  // Get player info
  const playerName = gameState.players[playerIdx].name;
  const playerColor = gameState.players[playerIdx].color;
  
  // Show indicator - kapışma tasarımı gibi
  resultIndicator.classList.remove('hidden', 'correct', 'wrong');
  resultIndicator.classList.add(isCorrect ? 'correct' : 'wrong');
  
  resultIndicator.innerHTML = `
    <div class="duel-result-container">
      <div class="result-header">
        <div class="result-icon ${isCorrect ? 'result-icon-success' : 'result-icon-error'}">
          <i data-lucide="${isCorrect ? 'check-circle' : 'thumbs-down'}"></i>
        </div>
        <h3 class="result-title">${isCorrect ? 'DOĞRU!' : 'YANLIŞ!'}</h3>
      </div>
      <div class="duel-result-players">
        <div class="result-player ${isCorrect ? 'winner-player' : 'loser-player'}">
          <div class="result-player-badge" style="background: ${playerColor.gradient || playerColor}"></div>
          <div class="result-player-name">${playerName}</div>
          <div class="result-player-score ${isCorrect ? 'positive' : 'negative'}">${isCorrect ? '+' : ''}${actualChange} adım</div>
        </div>
      </div>
      <div class="result-actions"><button class="btn-primary result-ok-btn">Tamam</button></div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  const okBtn = resultIndicator.querySelector('.result-ok-btn');
  if (okBtn) {
    okBtn.addEventListener('click', () => {
      okBtn.disabled = true;
      resultIndicator.classList.add('hidden');
      if (newPosition >= TOTAL_STEPS) {
        showScreen('results');
        showResults();
      } else {
        addNextPlayerButton();
      }
    });
  }
  
  // Emit score update
  socket.emit('answer-submitted', {
    gameId: gameState.gameId,
    player: playerIdx,
    isCorrect,
    steps: actualChange,
    scores: gameState.scores
  });
  
  // Update UI immediately
  updateGameUI();
  
}

// Duel Mode Result - Sıradaki oyuncu doğru bitirirlerse +puan, yanlış ise -puan
function showDuelResult(isCorrect, question) {
  const correctSteps = question.correct_steps || 2;
  const wrongSteps = question.wrong_steps || 1;
  const playerIdx = getCurrentPlayerIndex();
  const opponentIdx = gameState.duelOpponent;
  
  const currentPlayerName = gameState.players[playerIdx].name;
  const opponentName = gameState.players[opponentIdx].name;
  const currentPlayerColor = gameState.players[playerIdx].color;
  const opponentColor = gameState.players[opponentIdx].color;
  
  // Verify section'dan sadece başlık ve butonları gizle
  const verifyQuestion = document.querySelector('.verify-question');
  const verifyButtons = document.querySelector('.verify-buttons');
  if (verifyQuestion) verifyQuestion.style.display = 'none';
  if (verifyButtons) verifyButtons.style.display = 'none';
  
  // Cevap butonlarını devre dışı bırak (gizleme değil)
  document.querySelectorAll('.option-btn, .tf-btn, .duel-buzzer, .submit-answer-btn, .draggable-word, .blank-slot, .application-check, .verify-correct, .verify-wrong').forEach(btn => {
    btn.disabled = true;
    btn.style.pointerEvents = 'none';
  });
  
  // Winner/Loser selection UI
  resultIndicator.classList.remove('hidden', 'correct', 'wrong');
  resultIndicator.innerHTML = `
    <div class="duel-winner-selector">
      <p class="duel-question-text">Kim kazandı?</p>
      <div class="winner-selector-buttons">
        <button class="winner-select-btn current-player" onclick="confirmDuelWinner('${playerIdx}', '${opponentIdx}', ${correctSteps}, ${wrongSteps})">
          <div class="selector-color" style="background: ${currentPlayerColor.gradient || currentPlayerColor}"></div>
          <div class="selector-name">${currentPlayerName}</div>
        </button>
        <button class="winner-select-btn opponent-player" onclick="confirmDuelWinner('${opponentIdx}', '${playerIdx}', ${correctSteps}, ${wrongSteps})">
          <div class="selector-color" style="background: ${opponentColor.gradient || opponentColor}"></div>
          <div class="selector-name">${opponentName}</div>
        </button>
      </div>
    </div>
  `;
  
  // Lucide ikonlarını oluştur
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Duel Winner Confirmation
function confirmDuelWinner(winnerIdx, loserIdx, correctSteps, wrongSteps) {
  const prevWinnerScore = Number(gameState.scores[winnerIdx] || 0);
  const prevLoserScore = Number(gameState.scores[loserIdx] || 0);
  
  const winnerNewPosition = prevWinnerScore + correctSteps;
  const winnerFinalPosition = Math.max(0, Math.min(TOTAL_STEPS, winnerNewPosition));
  const winnerChange = winnerFinalPosition - prevWinnerScore;
  
  const loserNewPosition = prevLoserScore - wrongSteps;
  const loserFinalPosition = Math.max(0, Math.min(TOTAL_STEPS, loserNewPosition));
  const loserChange = loserFinalPosition - prevLoserScore;
  
  gameState.scores[winnerIdx] = winnerFinalPosition;
  gameState.scores[loserIdx] = loserFinalPosition;
  
  const winnerName = gameState.players[winnerIdx].name;
  const loserName = gameState.players[loserIdx].name;
  const winnerColor = gameState.players[winnerIdx].color;
  const loserColor = gameState.players[loserIdx].color;
  
  // Show result
  const winnerDisplayChange = Number.isFinite(winnerChange) ? winnerChange : correctSteps;
  const loserDisplayChange = Number.isFinite(loserChange) ? loserChange : -wrongSteps;
  
  resultIndicator.innerHTML = `
    <div class="duel-result-container">
      <div class="result-header">
        <div class="result-icon result-icon-success">
          <i data-lucide="trophy"></i>
        </div>
        <h3 class="result-title">${winnerName} KAZANDI!</h3>
      </div>
      <div class="duel-result-players">
        <div class="result-player winner-player">
          <div class="result-player-badge" style="background: ${winnerColor.gradient || winnerColor}"></div>
          <div class="result-player-name">${winnerName}</div>
          <div class="result-player-score positive">+${winnerDisplayChange} adım</div>
        </div>
        <div class="result-player loser-player">
          <div class="result-player-badge" style="background: ${loserColor.gradient || loserColor}"></div>
          <div class="result-player-name">${loserName}</div>
          <div class="result-player-score negative">${loserDisplayChange} adım</div>
        </div>
      </div>
      <div class="result-actions"><button class="btn-primary result-ok-btn">Tamam</button></div>
    </div>
  `;
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  const okBtn = resultIndicator.querySelector('.result-ok-btn');
  if (okBtn) {
    okBtn.addEventListener('click', () => {
      okBtn.disabled = true;
      resultIndicator.classList.add('hidden');
      
      // Duel'i sıfırla
      gameState.duelOpponent = undefined;
      
      // Kontrol et: oyuncu kazandı mı?
      if (winnerFinalPosition >= TOTAL_STEPS) {
        showScreen('results');
        showResults();
      } else if (loserFinalPosition >= TOTAL_STEPS) {
        showScreen('results');
        showResults();
      } else {
        addNextPlayerButton();
      }
    });
  }
  
  // Emit score update
  socket.emit('answer-submitted', {
    gameId: gameState.gameId,
    player: winnerIdx,
    isCorrect: true,
    steps: winnerChange,
    scores: gameState.scores
  });
  
  updateGameUI();
}

// Group Duel Mode Result - Oyuncuyu seçerek doğru/yanlış belirle
function showGroupDuelResult(isCorrect, question) {
  const correctSteps = question.correct_steps || 2;
  const wrongSteps = question.wrong_steps || 1;
  const currentPlayerIdx = getCurrentPlayerIndex();
  
  // Verify section'dan sadece başlık ve butonları gizle
  const verifyQuestion = document.querySelector('.verify-question');
  const verifyButtons = document.querySelector('.verify-buttons');
  if (verifyQuestion) verifyQuestion.style.display = 'none';
  if (verifyButtons) verifyButtons.style.display = 'none';
  
  // Cevap butonlarını devre dışı bırak (gizleme değil)
  document.querySelectorAll('.option-btn, .tf-btn, .duel-buzzer, .submit-answer-btn, .draggable-word, .blank-slot, .application-check, .verify-correct, .verify-wrong').forEach(btn => {
    btn.disabled = true;
    btn.style.pointerEvents = 'none';
  });
  
  // Tüm oyuncuları göster ve kimin doğru cevap verdiğini seç
  resultIndicator.classList.remove('hidden', 'correct', 'wrong');
  
  // Doğru cevap verilmedi - kapışma modunda adım değişmez
  if (!isCorrect) {
    resultIndicator.classList.add('wrong');
    
    // Tüm oyuncuların puanını düşür (0'ın altına inmesin)
    const playersHtml = gameState.playerOrder.map(playerIdx => {
      const prevScore = Number(gameState.scores[playerIdx] || 0);
      const newScore = Math.max(0, prevScore - wrongSteps);
      const change = newScore - prevScore;
      gameState.scores[playerIdx] = newScore;
      
      const playerColor = gameState.players[playerIdx].color;
      const playerName = gameState.players[playerIdx].name;
      return `
        <div class="result-player loser-player">
          <div class="result-player-badge" style="background: ${playerColor.gradient || playerColor}"></div>
          <div class="result-player-name">${playerName}</div>
          <div class="result-player-score negative">${change} adım</div>
        </div>
      `;
    }).join('');
    
    resultIndicator.innerHTML = `
      <div class="duel-result-container">
        <div class="result-header">
          <div class="result-icon result-icon-error">
            <i data-lucide="thumbs-down"></i>
          </div>
          <h3 class="result-title">HEPSİ YANLIŞ!</h3>
        </div>
        <div class="duel-result-players">
          ${playersHtml}
        </div>
        <div class="result-actions"><button class="btn-primary result-ok-btn">Tamam</button></div>
      </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    const okBtn = resultIndicator.querySelector('.result-ok-btn');
    if (okBtn) {
      okBtn.addEventListener('click', () => {
        okBtn.disabled = true;
        resultIndicator.classList.add('hidden');
        addNextPlayerButton();
      });
    }
    
    updateGameUI();
  } else {
    // Doğru cevap veren seçimi için butonları göster
    resultIndicator.innerHTML = `
      <div class="duel-winner-selector">
        <p class="duel-question-text">Doğru cevap veren kimdir?</p>
        <div class="winner-selector-buttons">
          ${gameState.playerOrder.map(playerIdx => {
            const playerColor = gameState.players[playerIdx].color;
            const playerName = gameState.players[playerIdx].name;
            return `
              <button class="winner-select-btn" onclick="confirmGroupDuelWinner(${playerIdx}, ${correctSteps}, ${wrongSteps})">
                <div class="selector-color" style="background: ${playerColor.gradient || playerColor}"></div>
                <div class="selector-name">${playerName}</div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// Group Duel Winner Confirmation
function confirmGroupDuelWinner(winnerIdx, correctSteps, wrongSteps) {
  // Kazanan oyuncu puanlarını artır
  const prevWinnerScore = Number(gameState.scores[winnerIdx] || 0);
  gameState.scores[winnerIdx] = prevWinnerScore + correctSteps;
  
  const winnerName = gameState.players[winnerIdx].name;
  const winnerColor = gameState.players[winnerIdx].color;
  
  // Kaybeden oyuncuların puanlarını azalt (0'ın altına inmesin)
  const loserChanges = {};
  gameState.playerOrder.forEach(playerIdx => {
    if (playerIdx !== winnerIdx) {
      const prevScore = Number(gameState.scores[playerIdx] || 0);
      const newScore = Math.max(0, prevScore - wrongSteps);
      loserChanges[playerIdx] = newScore - prevScore;
      gameState.scores[playerIdx] = newScore;
    }
  });
  
  // Show result
  const winnerDisplayChange = Number.isFinite(gameState.scores[winnerIdx] - prevWinnerScore)
    ? gameState.scores[winnerIdx] - prevWinnerScore
    : correctSteps;
  
  const loserPlayersHtml = gameState.playerOrder.map(playerIdx => {
    if (playerIdx === winnerIdx) return '';
    const loserColor = gameState.players[playerIdx].color;
    const loserName = gameState.players[playerIdx].name;
    const change = Number.isFinite(loserChanges[playerIdx]) ? loserChanges[playerIdx] : -wrongSteps;
    return `
      <div class="result-player loser-player">
        <div class="result-player-badge" style="background: ${loserColor.gradient || loserColor}"></div>
        <div class="result-player-name">${loserName}</div>
        <div class="result-player-score negative">${change} adım</div>
      </div>
    `;
  }).join('');
  
  resultIndicator.innerHTML = `
    <div class="duel-result-container">
      <div class="result-header">
        <div class="result-icon result-icon-success">
          <i data-lucide="trophy"></i>
        </div>
        <h3 class="result-title">${winnerName} KAZANDI!</h3>
      </div>
      <div class="duel-result-players">
        <div class="result-player winner-player">
          <div class="result-player-badge" style="background: ${winnerColor.gradient || winnerColor}"></div>
          <div class="result-player-name">${winnerName}</div>
          <div class="result-player-score positive">+${winnerDisplayChange} adım</div>
        </div>
        ${loserPlayersHtml}
      </div>
      <div class="result-actions"><button class="btn-primary result-ok-btn">Tamam</button></div>
    </div>
  `;
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  const okBtn = resultIndicator.querySelector('.result-ok-btn');
  if (okBtn) {
    okBtn.addEventListener('click', () => {
      okBtn.disabled = true;
      resultIndicator.classList.add('hidden');
      
      const currentPlayerIdx = getCurrentPlayerIndex();
      
      // Kontrol et: oyuncu kazandı mı?
      if (gameState.scores[winnerIdx] >= TOTAL_STEPS) {
        showScreen('results');
        showResults();
      } else {
        // Sonraki oyuncuya git
        addNextPlayerButton();
      }
    });
  }
  
  // Emit score update
  socket.emit('answer-submitted', {
    gameId: gameState.gameId,
    player: winnerIdx,
    isCorrect: true,
    steps: correctSteps,
    scores: gameState.scores
  });
  
  updateGameUI();
}

// Add Next Player Button
function addNextPlayerButton() {
  // Önceki butonları temizle
  const existingContainer = document.querySelector('.result-buttons');
  if (existingContainer) existingContainer.remove();
  
  // Butonları saran container
  const btnContainer = document.createElement('div');
  btnContainer.className = 'result-buttons';
  
  // Mevcut soruyu al
  const question = gameState.currentQuestion;
  
  // Bilgi butonu (eğer soru info içeriyorsa)
  if (question && question.info && question.info.enabled) {
    const infoBtn = document.createElement('button');
    infoBtn.className = 'btn-secondary info-btn';
    infoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; margin-right: 8px; vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> Bilgi';
    infoBtn.addEventListener('click', showQuestionInfo);
    btnContainer.appendChild(infoBtn);
  }
  
  // AR Animasyon butonu (eğer soru AR animasyon içeriyorsa)
  if (question && question.info && question.info.ar_animation && question.info.ar_animation.type) {
    const arBtn = document.createElement('button');
    arBtn.className = 'btn-ar-animation';
    arBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> AR Animasyon';
    arBtn.addEventListener('click', () => {
      const arAnimation = question.info.ar_animation;
      const title = question.info.title || 'AR Animasyon';
      openARViewer(arAnimation, title);
    });
    btnContainer.appendChild(arBtn);
  }
  
  // Sonraki oyuncu butonu
  const btn = document.createElement('button');
  btn.className = 'btn-primary next-player-btn';
  btn.textContent = 'Sonraki Oyuncu';
  btn.addEventListener('click', nextPlayer);
  btnContainer.appendChild(btn);
  
  // game-screen içine ekle (soru kartının altına)
  const gameScreen = document.getElementById('game-screen');
  if (gameScreen) {
    gameScreen.appendChild(btnContainer);
  }
  
  // Re-initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Soru bilgisini göster
function showQuestionInfo() {
  const question = gameState.currentQuestion;
  if (!question || !question.info) return;
  
  const info = question.info;
  const title = info.title || 'Bilgi';
  const text = info.text || '';
  const image = info.image || null;
  
  // Resim HTML'i oluştur
  const imageHtml = image ? `<div class="info-popup-image"><img src="${image}" alt="Bilgi resmi"></div>` : '';
  
  // Popup oluştur (AR butonu artık popup içinde değil, result-buttons container'ında)
  const popup = document.createElement('div');
  popup.className = 'info-popup-overlay';
  popup.innerHTML = `
    <div class="info-popup">
      <div class="info-popup-header">
        <i data-lucide="lightbulb"></i>
        <h3>${title}</h3>
        <button class="info-popup-close">&times;</button>
      </div>
      <div class="info-popup-content">
        ${imageHtml}
        <p>${text.replace(/\n/g, '<br>')}</p>
      </div>
      <button class="btn-primary info-popup-ok">Tamam</button>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  // Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  // Kapat butonları
  popup.querySelector('.info-popup-close').addEventListener('click', () => popup.remove());
  popup.querySelector('.info-popup-ok').addEventListener('click', () => popup.remove());
  popup.addEventListener('click', (e) => {
    if (e.target === popup) popup.remove();
  });
}

// AR Görüntüleyici aç
function openARViewer(arAnimation, title) {
  const type = arAnimation.type || 'circuit';
  const modelUrl = arAnimation.model_url || '';
  const modelTitle = arAnimation.model_title || '';
  const modelDescription = arAnimation.model_description || '';
  const aframeCode = arAnimation.aframe_code || '';
  const markerType = arAnimation.marker_type || 'hiro';
  const markerUrl = arAnimation.marker_url || '';
  const encodedTitle = encodeURIComponent(title);
  
  // Büyük verileri localStorage'a kaydet (URL boyut limitini aşmamak için)
  const arData = {
    type,
    title,
    modelUrl,
    modelTitle,
    modelDescription,
    aframeCode,
    markerType,
    markerUrl
  };
  localStorage.setItem('ar-animation-data', JSON.stringify(arData));
  
  let arUrl;
  
  // Marker tipine göre uygun sayfaya yönlendir
  if (markerType === 'custom' && markerUrl) {
    // Özel marker - önce sunucuya pattern yükle, sonra ar-custom'a git
    uploadPatternAndOpenAR(markerUrl, type, modelUrl, modelTitle, modelDescription);
    return;
  } else {
    // Hiro marker - doğrudan ar-viewer.html kullan
    arUrl = `/ar-viewer.html?type=${type}`;
  }
  
  // AR'yı tam ekran overlay olarak aç
  openAROverlay(arUrl);
}

// AR Overlay aç
function openAROverlay(arUrl) {
  // Mevcut overlay varsa kaldır
  const existingOverlay = document.getElementById('ar-overlay-container');
  if (existingOverlay) existingOverlay.remove();
  
  // Overlay container oluştur
  const overlay = document.createElement('div');
  overlay.id = 'ar-overlay-container';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    z-index: 99999; background: #000;
  `;
  
  // iframe oluştur
  const iframe = document.createElement('iframe');
  iframe.src = arUrl;
  iframe.style.cssText = `
    width: 100%; height: 100%; border: none;
  `;
  iframe.allow = 'camera; microphone; fullscreen';
  
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
  
  // iframe'den mesaj dinle (kapatma için)
  window.addEventListener('message', function handleARMessage(e) {
    if (e.data && e.data.type === 'close-ar') {
      overlay.remove();
      localStorage.removeItem('ar-animation-data');
      window.removeEventListener('message', handleARMessage);
    }
  });
}

// Özel marker için pattern yükle ve AR aç
async function uploadPatternAndOpenAR(patternData, animationType, modelUrl = '', modelTitle = '', modelDescription = '') {
  try {
    // Pattern'ı sunucuya yükle
    const response = await fetch('/api/upload-pattern', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        patternData: patternData,
        filename: `marker-${Date.now()}.patt`
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Sunucu tarafında dinamik sayfa ile aç
      let arUrl = `/ar-custom?type=${animationType}&pattern=${encodeURIComponent(result.url)}`;
      if (modelUrl) {
        arUrl += `&modelUrl=${encodeURIComponent(modelUrl)}`;
      }
      if (modelTitle) {
        arUrl += `&title=${encodeURIComponent(modelTitle)}`;
      }
      if (modelDescription) {
        arUrl += `&description=${encodeURIComponent(modelDescription)}`;
      }
      openAROverlay(arUrl);
    } else {
      console.error('Pattern yüklenemedi:', result.error);
      alert('AR marker yüklenemedi. Hiro marker ile açılıyor.');
      openAROverlay(`/ar-viewer.html?type=${animationType}`);
    }
  } catch (error) {
    console.error('Pattern yükleme hatası:', error);
    alert('AR marker yüklenemedi. Hiro marker ile açılıyor.');
    openAROverlay(`/ar-viewer.html?type=${animationType}`);
  }
}

// Next Player
async function nextPlayer() {
  gameState.currentPlayerIndex++;
  
  if (gameState.currentPlayerIndex >= gameState.playerCount) {
    // Cycle back to first player in order
    gameState.currentPlayerIndex = 0;
  }
  
  // Sonraki oyuncu sesi
  playSound('next_player');
  
  // Update game in database
  await fetch(`/api/games/${gameState.gameId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_player: gameState.currentPlayerIndex,
      scores: gameState.scores,
      status: 'active'
    })
  });
  
  socket.emit('next-player', {
    gameId: gameState.gameId,
    currentPlayer: gameState.currentPlayerIndex
  });
  
  updateGameUI();
  showQRScannerWithTypeSelection();
}

// Show QR Scanner (without type selection modal)
function showQRScanner() {
  // Hide question wrapper
  const questionWrapper = document.getElementById('question-wrapper');
  questionWrapper.classList.add('hidden');
  
  // Sonraki oyuncu butonlarını temizle
  const existingContainer = document.querySelector('.result-buttons');
  if (existingContainer) existingContainer.remove();
  
  qrContainer.classList.remove('hidden');
  
  // Start QR scanner if not already running
  startQRScanner();
}

// Show QR Scanner (after question is answered)
function showQRScannerWithTypeSelection() {
  // Hide question wrapper
  const questionWrapper = document.getElementById('question-wrapper');
  questionWrapper.classList.add('hidden');
  
  // Sonraki oyuncu butonlarını temizle
  const existingContainer = document.querySelector('.result-buttons');
  if (existingContainer) existingContainer.remove();
  
  qrContainer.classList.remove('hidden');
  
  // Doğrudan QR taramaya devam et
  showQRScanner();
}

// Setup Socket Listeners
function setupSocketListeners() {
  // Socket Events
  socket.on('update-scores', (data) => {
    gameState.scores = data.scores;
    updateGameUI();
  });

  socket.on('player-changed', (data) => {
    gameState.currentPlayer = data.currentPlayer;
    updateGameUI();
  });

  socket.on('show-results', (data) => {
    showResults();
  });
}

// Show Results
function showResults() {
  showScreen('results');
  
  // Oyun bitiş sesi
  playSound('game_end');
  
  const finalScores = document.getElementById('final-scores');
  finalScores.innerHTML = '';
  
  // Sort players by score (steps)
  const sortedPlayers = Object.entries(gameState.scores)
    .map(([idx, score]) => ({ idx: parseInt(idx), score, player: gameState.players[parseInt(idx)] }))
    .sort((a, b) => b.score - a.score);
  
  // Kazanan varsa zafer sesi çal
  const hasWinner = sortedPlayers.some(entry => entry.score >= TOTAL_STEPS);
  if (hasWinner) {
    setTimeout(() => playSound('victory'), 500);
  }
  
  // Rank icons with Lucide
  const rankIcons = [
    '<i data-lucide="crown" class="rank-icon gold"></i>',
    '<i data-lucide="medal" class="rank-icon silver"></i>',
    '<i data-lucide="award" class="rank-icon bronze"></i>',
    '<span class="rank-number">4</span>',
    '<span class="rank-number">5</span>',
    '<span class="rank-number">6</span>'
  ];
  
  sortedPlayers.forEach((entry, index) => {
    const isWinner = entry.score >= TOTAL_STEPS;
    
    const item = document.createElement('div');
    item.className = `final-score-item ${isWinner ? 'winner' : ''}`;
    
    item.innerHTML = `
      <span class="rank">${rankIcons[index]}</span>
      <span class="player-name-box" style="background: ${entry.player.color.gradient}">
        ${entry.player.name}
        ${isWinner ? '<i data-lucide="trophy" class="winner-icon-inline"></i>' : ''}
      </span>
    `;
    finalScores.appendChild(item);
  });
  
  // Lucide ikonlarını güncelle
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Play Again
document.getElementById('play-again-btn').addEventListener('click', () => {
  gameState = {
    gameId: null,
    playerCount: 0,
    players: [],
    playerOrder: [],
    scores: {},
    currentPlayerIndex: 0,
    currentQuestion: null,
    selectedQuestionType: null,
    timerInterval: null,
    duelPlayers: [],
    duelAnswers: {}
  };
  
  playerNamesContainer.innerHTML = '';
  playerNamesContainer.classList.add('hidden');
  startGameBtn.classList.add('hidden');
  document.getElementById('turn-order-display').classList.add('hidden');
  
  // Oyuna Başla butonunu sıfırla
  const confirmBtn = document.getElementById('confirm-start-btn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<i data-lucide="play" class="btn-icon-svg"></i> Oyuna Başla';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  
  document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('selected'));
  
  showScreen('menu');
});

// ===============================
// SORU TİPİ SEÇİM MODALI - SLOT MAKİNESİ
// ===============================

// Soru tipleri
const QUESTION_TYPES = [
  { type: 'multiple', name: 'Çoktan Seçmeli' },
  { type: 'truefalse', name: 'Doğru/Yanlış' },
  { type: 'fillblank', name: 'Boşluk Doldurma' },
  { type: 'duel', name: 'Kapışma 2\'li' },
  { type: 'group_duel', name: 'Kapışma Hep Birlikte' },
  { type: 'matching', name: 'Eşleme' },
  { type: 'drag_drop', name: 'Sürükle Bırak' },
  { type: 'application', name: 'Uygulama' }
];

let isSlotSpinning = false;
let weightedSlotTypes = []; // Ağırlıklı soru tipleri listesi (sabit 24 item)
let typeWeights = {}; // Her tipin ağırlığı (olasılık için)

// Soru sayısına göre ağırlıklı liste oluştur
async function buildWeightedTypeList() {
  try {
    const response = await fetch('/api/questions');
    const questions = await response.json();
    
    // Her tip için soru sayısını hesapla
    const typeCounts = {};
    let totalQuestions = 0;
    QUESTION_TYPES.forEach(t => typeCounts[t.type] = 0);
    
    questions.forEach(q => {
      if (typeCounts.hasOwnProperty(q.type)) {
        typeCounts[q.type]++;
        totalQuestions++;
      }
    });
    
    // Sorusu olan tipleri filtrele
    const availableTypes = QUESTION_TYPES.filter(t => typeCounts[t.type] > 0);
    
    // Eğer hiç soru yoksa tüm tipleri göster
    if (availableTypes.length === 0) {
      weightedSlotTypes = [...QUESTION_TYPES];
      typeWeights = {};
      QUESTION_TYPES.forEach(t => typeWeights[t.type] = 1 / QUESTION_TYPES.length);
      return weightedSlotTypes;
    }
    
    // Slot için sabit 24 item oluştur (3 tur için yeterli)
    // Her tipin slot'ta görünme sayısı = (tip soru sayısı / toplam soru) * 24
    const SLOT_SIZE = 24;
    weightedSlotTypes = [];
    typeWeights = {};
    
    availableTypes.forEach(typeInfo => {
      const count = typeCounts[typeInfo.type];
      const ratio = count / totalQuestions;
      typeWeights[typeInfo.type] = ratio;
      
      // En az 1, en fazla oranına göre slot item ekle
      const slotCount = Math.max(1, Math.round(ratio * SLOT_SIZE));
      for (let i = 0; i < slotCount; i++) {
        weightedSlotTypes.push(typeInfo);
      }
    });
    
    // Slot'u karıştır (shuffle)
    for (let i = weightedSlotTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [weightedSlotTypes[i], weightedSlotTypes[j]] = [weightedSlotTypes[j], weightedSlotTypes[i]];
    }
    
    console.log('Soru dağılımı:', typeCounts);
    console.log('Olasılıklar:', Object.entries(typeWeights).map(([k,v]) => `${k}: %${(v*100).toFixed(1)}`).join(', '));
    
    return weightedSlotTypes;
  } catch (error) {
    console.error('Soru tipleri yüklenemedi:', error);
    weightedSlotTypes = [...QUESTION_TYPES];
    typeWeights = {};
    QUESTION_TYPES.forEach(t => typeWeights[t.type] = 1 / QUESTION_TYPES.length);
    return weightedSlotTypes;
  }
}

// Ağırlığa göre rastgele tip seç
function selectRandomTypeByWeight() {
  const random = Math.random();
  let cumulative = 0;
  
  for (const [type, weight] of Object.entries(typeWeights)) {
    cumulative += weight;
    if (random <= cumulative) {
      return QUESTION_TYPES.find(t => t.type === type);
    }
  }
  
  // Fallback
  if (weightedSlotTypes.length > 0) {
    return weightedSlotTypes[Math.floor(Math.random() * weightedSlotTypes.length)];
  }
  return QUESTION_TYPES[0];
}

function initSlotMachine() {
  const reel = document.getElementById('slot-reel');
  if (!reel) return;
  
  // Eğer weightedSlotTypes boşsa varsayılan tipleri kullan
  let typesToUse = weightedSlotTypes.length > 0 ? weightedSlotTypes : [...QUESTION_TYPES];
  
  // Eğer hala boşsa (olasılık düşük ama garanti)
  if (typesToUse.length === 0) {
    typesToUse = [...QUESTION_TYPES];
  }
  
  console.log('Slot oluşturuluyor, tip sayısı:', typesToUse.length);
  
  // Sabit 60 item oluştur (dönerken yeterli olması için)
  let html = '';
  const DISPLAY_SIZE = 60;
  
  for (let i = 0; i < DISPLAY_SIZE; i++) {
    const idx = i % typesToUse.length;
    const item = typesToUse[idx];
    
    // Her durumda bir item oluştur
    const itemType = item?.type || QUESTION_TYPES[idx % QUESTION_TYPES.length].type;
    const itemName = item?.name || QUESTION_TYPES[idx % QUESTION_TYPES.length].name;
    
    html += `<div class="slot-item" data-type="${itemType}"><span>${itemName}</span></div>`;
  }
  
  reel.innerHTML = html;
  console.log('Slot itemları oluşturuldu:', reel.children.length);
}

async function showTypeSelectionModal() {
  const modal = document.getElementById('type-selection-modal');
  if (!modal) return;

  await buildWeightedTypeList();
  initSlotMachine();
  modal.classList.remove('hidden');

  const currentPlayerIdx = gameState.currentPlayerIndex;
  const currentPlayer = gameState.players[gameState.playerOrder[currentPlayerIdx]];
  const modalBadge = document.getElementById('modal-player-badge');
  if (modalBadge && currentPlayer) {
    modalBadge.textContent = currentPlayer.name;
    modalBadge.className = 'player-badge modal-player-badge';
    if (currentPlayer.color && currentPlayer.color.gradient) {
      modalBadge.style.background = currentPlayer.color.gradient;
    }
  }

  // Reset reel position and styling
  const reel = document.getElementById('slot-reel');
  if (reel) {
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0)';
  }

  // Remove selection styling
  document.getElementById('slot-window')?.classList.remove('selected');

  // Hide confirm section
  document.getElementById('confirm-type-section').classList.add('hidden');

  // Reset spin button
  const spinBtn = document.getElementById('spin-slot-btn');
  if (spinBtn) {
    spinBtn.disabled = false;
    spinBtn.innerHTML = '<i data-lucide="zap" class="btn-icon-svg"></i> Çevir!';
    spinBtn.style.background = '';
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function hideTypeSelectionModal() {
  document.getElementById('type-selection-modal').classList.add('hidden');
}

// Slot çevir
document.getElementById('spin-slot-btn')?.addEventListener('click', () => {
  if (isSlotSpinning) return;
  
  isSlotSpinning = true;
  
  // Hide confirm section
  document.getElementById('confirm-type-section').classList.add('hidden');
  
  const spinBtn = document.getElementById('spin-slot-btn');
  spinBtn.disabled = true;
  spinBtn.innerHTML = '<i data-lucide="loader" class="btn-icon-svg spinning"></i> Dönüyor...';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  // Remove previous selection styling
  document.getElementById('slot-window')?.classList.remove('selected');
  document.querySelectorAll('.slot-item.selected').forEach(el => el.classList.remove('selected'));
  
  const reel = document.getElementById('slot-reel');
  const itemHeight = 80;
  
  // Slot boşsa yeniden oluştur
  if (!reel || reel.children.length === 0) {
    console.log('Slot boş, yeniden oluşturuluyor...');
    initSlotMachine();
  }
  
  // Fallback tipler
  let typesToUse = weightedSlotTypes.length > 0 ? weightedSlotTypes : [...QUESTION_TYPES];
  if (typesToUse.length === 0) typesToUse = [...QUESTION_TYPES];
  
  // Ağırlığa göre rastgele tip seç
  let selectedType = selectRandomTypeByWeight();
  if (!selectedType) {
    // Fallback - rastgele bir tip seç
    selectedType = QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)];
    console.log('Fallback tip seçildi:', selectedType.name);
  }
  
  // Bu tipin slot'taki bir index'ini bul (rastgele bir konumda)
  const matchingIndices = [];
  for (let i = 0; i < reel.children.length; i++) {
    if (reel.children[i] && reel.children[i].dataset && reel.children[i].dataset.type === selectedType.type) {
      matchingIndices.push(i);
    }
  }
  
  console.log('Seçilen tip:', selectedType.name, '- Eşleşen indexler:', matchingIndices.length);
  
  // Eşleşme bulunamazsa herhangi bir geçerli index kullan
  let targetIndex;
  if (matchingIndices.length > 0) {
    targetIndex = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];
  } else {
    // Hiç eşleşme yoksa 25-35 arası rastgele bir index seç
    targetIndex = 25 + Math.floor(Math.random() * 10);
    console.log('Eşleşme bulunamadı, rastgele index:', targetIndex);
  }
  
  // En az 20 item geçecek şekilde hedef belirle
  const minSpinItems = 20;
  if (targetIndex < minSpinItems) {
    // Daha ilerideki bir eşleşme bul
    const laterMatches = matchingIndices.filter(i => i >= minSpinItems);
    if (laterMatches.length > 0) {
      targetIndex = laterMatches[Math.floor(Math.random() * laterMatches.length)];
    } else {
      targetIndex = minSpinItems + (targetIndex % Math.max(1, typesToUse.length));
    }
  }
  
  const finalPosition = targetIndex * itemHeight;
  
  // Reset position first
  reel.style.transition = 'none';
  reel.style.transform = 'translateY(0)';
  
  // Force reflow
  reel.offsetHeight;
  
  // Start spinning animation
  reel.style.transition = 'transform 3s cubic-bezier(0.15, 0.85, 0.35, 1)';
  reel.style.transform = `translateY(-${finalPosition}px)`;
  
  // After animation
  setTimeout(() => {
    isSlotSpinning = false;
    
    // Add neon effect to window and selected item
    document.getElementById('slot-window')?.classList.add('selected');
    const selectedItem = reel.children[targetIndex];
    if (selectedItem) {
      selectedItem.classList.add('selected');
    }
    
    // Select the type
    selectQuestionType(selectedType.type);
    
    // Re-enable button
    spinBtn.disabled = false;
    spinBtn.innerHTML = '<i data-lucide="refresh-cw" class="btn-icon-svg"></i> Tekrar Çevir';
    spinBtn.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }, 3100);
});

function selectQuestionType(type) {
  gameState.selectedQuestionType = type;
  
  // Just show confirm button, slot already shows the selected type
  document.getElementById('confirm-type-section').classList.remove('hidden');
}

// Tip seçimini onayla ve QR taramaya geç
document.getElementById('confirm-type-btn')?.addEventListener('click', () => {
  hideTypeSelectionModal();
  startQRScanner();
});

// ===============================
// SÜRE SAYACI
// ===============================

function startTimer(seconds, onComplete) {
  if (seconds <= 0) return;
  
  let remaining = seconds;
  
  // Timer görselini oluştur
  let timerContainer = document.querySelector('.timer-container');
  if (!timerContainer) {
    timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
      <div class="timer-display">
        <i data-lucide="clock"></i>
        <span id="timer-value">${remaining}</span>
      </div>
    `;
    document.body.appendChild(timerContainer);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  
  const timerValue = document.getElementById('timer-value');
  const timerDisplay = document.querySelector('.timer-display');
  
  timerValue.textContent = remaining;
  timerDisplay.classList.remove('warning');
  
  gameState.timerInterval = setInterval(() => {
    remaining--;
    timerValue.textContent = remaining;
    
    if (remaining <= 5) {
      timerDisplay.classList.add('warning');
    }
    
    if (remaining <= 0) {
      stopTimer();
      if (onComplete) onComplete();
    }
  }, 1000);
}

function stopTimer() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
  
  const timerContainer = document.querySelector('.timer-container');
  if (timerContainer) {
    timerContainer.remove();
  }
}

// ===============================
// KAPIŞMA MODU (DUEL)
// ===============================

function startDuelMode(question) {
  const players = gameState.players;
  
  if (question.type === 'duel') {
    // 2'li kapışma - rastgele 2 oyuncu seç
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    gameState.duelPlayers = shuffled.slice(0, 2);
  } else if (question.type === 'group_duel') {
    // Grup kapışması - tüm oyuncular
    gameState.duelPlayers = [...players];
  }
  
  gameState.duelAnswers = {};
  
  // Duel UI oluştur
  showDuelQuestion(question);
}

function showDuelQuestion(question) {
  const questionWrapper = document.getElementById('question-wrapper');
  questionWrapper.classList.remove('hidden');
  
  let duelHTML = `
    <div class="duel-container">
      ${gameState.duelPlayers.map((player, idx) => `
        <div class="duel-player" data-player-index="${idx}" style="border-color: ${PLAYER_COLORS[player.color]?.bg || '#6366f1'}">
          <div class="duel-player-name" style="color: ${PLAYER_COLORS[player.color]?.bg || '#fff'}">${player.name}</div>
          <div class="duel-status">Bekliyor...</div>
        </div>
      `).join('')}
    </div>
  `;
  
  const cardHTML = `
    <div class="question-card">
      <div class="question-header">
        ${question.image_url ? `<img src="${question.image_url}" alt="Soru görseli" class="question-image">` : ''}
        <div class="question-text">${question.question_text}</div>
      </div>
      <div class="answer-options">
        ${question.options.map((option, idx) => `
          <button class="option-btn duel-option" data-answer="${String.fromCharCode(65 + idx)}">
            <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
            <span class="option-text">${option}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  
  questionWrapper.innerHTML = duelHTML + cardHTML;
  
  // Duel seçeneklerine event listener ekle
  document.querySelectorAll('.duel-option').forEach(btn => {
    btn.addEventListener('click', () => handleDuelAnswer(btn.dataset.answer, question));
  });
  
  // Süre varsa başlat
  if (question.time_limit > 0) {
    startTimer(question.time_limit, () => finishDuel(question));
  }
}

function handleDuelAnswer(answer, question) {
  const currentPlayerIdx = gameState.currentPlayerIndex;
  const player = gameState.players[gameState.playerOrder[currentPlayerIdx]];
  
  // Cevabı kaydet
  gameState.duelAnswers[player.name] = {
    answer,
    time: Date.now(),
    correct: answer === question.correct_answer
  };
  
  // UI güncelle
  const playerCard = document.querySelector(`.duel-player[data-player-index="${gameState.duelPlayers.findIndex(p => p.name === player.name)}"]`);
  if (playerCard) {
    playerCard.querySelector('.duel-status').textContent = 'Cevapladı!';
    playerCard.classList.add('active');
  }
  
  // Tüm oyuncular cevapladı mı kontrol et
  if (Object.keys(gameState.duelAnswers).length >= gameState.duelPlayers.length) {
    finishDuel(question);
  }
}

function finishDuel(question) {
  stopTimer();
  
  // En hızlı doğru cevabı bul
  let winner = null;
  let fastestTime = Infinity;
  
  for (const [playerName, data] of Object.entries(gameState.duelAnswers)) {
    if (data.correct && data.time < fastestTime) {
      fastestTime = data.time;
      winner = playerName;
    }
  }
  
  // Sonuçları göster
  gameState.duelPlayers.forEach(player => {
    const playerCard = document.querySelector(`.duel-player[data-player-index="${gameState.duelPlayers.findIndex(p => p.name === player.name)}"]`);
    if (playerCard) {
      const data = gameState.duelAnswers[player.name];
      if (player.name === winner) {
        playerCard.classList.add('winner');
        playerCard.querySelector('.duel-status').textContent = '🏆 Kazandı!';
        // Puan ekle
        const playerIndex = gameState.players.findIndex(p => p.name === player.name);
        updateScore(playerIndex, true, question.correct_steps);
      } else {
        playerCard.classList.add('loser');
        playerCard.querySelector('.duel-status').textContent = data?.correct ? 'Yavaş kaldı' : 'Yanlış';
      }
    }
  });
  
  // Doğru cevabı göster
  document.querySelectorAll('.duel-option').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.answer === question.correct_answer) {
      btn.classList.add('correct');
    }
  });
  
  setTimeout(() => {
    nextPlayer();
  }, 3000);
}

// ===============================
// EŞLEME OYUNU
// ===============================

function showMatchingQuestion(question) {
  const questionWrapper = document.getElementById('question-wrapper');
  questionWrapper.classList.remove('hidden');
  
  const pairs = question.matching_pairs || [];
  const leftItems = pairs.map(p => p.left);
  const rightItems = [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5);
  
  let selectedLeft = null;
  let matchedPairs = [];
  
  const html = `
    <div class="question-card">
      <div class="question-header">
        <div class="question-text">${question.question_text}</div>
      </div>
      <div class="matching-container">
        <div class="matching-column left-column">
          ${leftItems.map((item, idx) => `
            <div class="matching-item left-item" data-index="${idx}" data-value="${item}">${item}</div>
          `).join('')}
        </div>
        <div class="matching-column right-column">
          ${rightItems.map((item, idx) => `
            <div class="matching-item right-item" data-index="${idx}" data-value="${item}">${item}</div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  questionWrapper.innerHTML = html;
  
  // Event listeners
  document.querySelectorAll('.left-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.left-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedLeft = item.dataset.value;
    });
  });
  
  document.querySelectorAll('.right-item').forEach(item => {
    item.addEventListener('click', () => {
      if (!selectedLeft) return;
      
      const rightValue = item.dataset.value;
      const pair = pairs.find(p => p.left === selectedLeft);
      
      if (pair && pair.right === rightValue) {
        // Doğru eşleşme
        document.querySelector(`.left-item[data-value="${selectedLeft}"]`).classList.add('correct');
        item.classList.add('correct');
        matchedPairs.push(selectedLeft);
      } else {
        // Yanlış eşleşme
        document.querySelector(`.left-item[data-value="${selectedLeft}"]`).classList.add('wrong');
        item.classList.add('wrong');
        setTimeout(() => {
          document.querySelector(`.left-item[data-value="${selectedLeft}"]`).classList.remove('wrong', 'selected');
          item.classList.remove('wrong');
        }, 500);
      }
      
      selectedLeft = null;
      document.querySelectorAll('.left-item').forEach(i => i.classList.remove('selected'));
      
      // Tamamlandı mı kontrol et
      if (matchedPairs.length === pairs.length) {
        setTimeout(() => {
          showQuestionResult(true, question);
        }, 500);
      }
    });
  });
  
  // Süre varsa başlat
  if (question.time_limit > 0) {
    startTimer(question.time_limit, () => showQuestionResult(false, question));
  }
}

// ===============================
// SÜRÜKLE BIRAK
// ===============================

function showDragDropQuestion(question) {
  const questionWrapper = document.getElementById('question-wrapper');
  questionWrapper.classList.remove('hidden');
  
  const dragData = question.drag_drop || {};
  
  if (dragData.type === 'order') {
    showOrderDragDrop(question, dragData);
  } else {
    showCategoryDragDrop(question, dragData);
  }
}

function showOrderDragDrop(question, dragData) {
  const items = [...(dragData.items || [])].sort(() => Math.random() - 0.5);
  
  const html = `
    <div class="question-card">
      <div class="question-header">
        <div class="question-text">${question.question_text}</div>
      </div>
      <div class="drag-drop-container">
        <div class="drag-drop-items" id="drag-source">
          ${items.map((item, idx) => `
            <div class="drag-item" draggable="true" data-value="${item}">${item}</div>
          `).join('')}
        </div>
        <p style="text-align: center; color: var(--text-muted); margin: 15px 0;">↓ Doğru sıraya yerleştirin ↓</p>
        <div class="drop-zone" id="drop-target">
          <div class="drop-zone-label">Öğeleri buraya sürükleyin</div>
        </div>
        <button class="btn-primary submit-answer-btn" id="check-order-btn">Kontrol Et</button>
      </div>
    </div>
  `;
  
  questionWrapper.innerHTML = html;
  setupDragDropHandlers(question, dragData);
}

function setupDragDropHandlers(question, dragData) {
  const items = document.querySelectorAll('.drag-item');
  const dropZone = document.getElementById('drop-target');
  
  if (!dropZone) {
    console.error('Drop zone bulunamadı');
    return;
  }
  
  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.dataset.value);
      item.classList.add('dragging');
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
  });
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const value = e.dataTransfer.getData('text/plain');
    const draggedItem = document.querySelector(`.drag-item[data-value="${value}"]`);
    
    if (draggedItem && !dropZone.contains(draggedItem)) {
      dropZone.appendChild(draggedItem);
    }
  });
  
  // Check button
  document.getElementById('check-order-btn').addEventListener('click', () => {
    const droppedItems = Array.from(dropZone.querySelectorAll('.drag-item')).map(el => el.dataset.value);
    const correctOrder = dragData.items;
    
    const isCorrect = JSON.stringify(droppedItems) === JSON.stringify(correctOrder);
    showQuestionResult(isCorrect, question);
  });
  
  // Süre varsa başlat
  if (question.time_limit > 0) {
    startTimer(question.time_limit, () => showQuestionResult(false, question));
  }
}

// ===============================
// UYGULAMA MODU
// ===============================

function showApplicationQuestion(question) {
  const questionWrapper = document.getElementById('question-wrapper');
  questionWrapper.classList.remove('hidden');
  
  const appData = question.application || {};
  
  const html = `
    <div class="question-card">
      <div class="question-header">
        <div class="question-text">${question.question_text}</div>
      </div>
      <div class="application-container">
        <div class="application-instructions">
          <h4><i data-lucide="flask-conical"></i> Uygulama Görevi</h4>
          <p>${appData.instructions || 'Uygulamayı gerçekleştirin.'}</p>
        </div>
        <div class="application-timer" id="app-timer">${question.time_limit || 60}</div>
        <button class="btn-primary check-button" id="check-application-btn">
          <i data-lucide="check-circle" class="btn-icon-svg"></i>
          Kontrol Et
        </button>
      </div>
    </div>
  `;
  
  questionWrapper.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  // Uygulama süresini başlat
  let remaining = question.time_limit || 60;
  const timerEl = document.getElementById('app-timer');
  
  const appInterval = setInterval(() => {
    remaining--;
    timerEl.textContent = remaining;
    
    if (remaining <= 10) {
      timerEl.classList.add('warning');
    }
    
    if (remaining <= 0) {
      clearInterval(appInterval);
      showApplicationCheck(question, appData);
    }
  }, 1000);
  
  // Kontrol butonu
  document.getElementById('check-application-btn').addEventListener('click', () => {
    clearInterval(appInterval);
    showApplicationCheck(question, appData);
  });
}

function showApplicationCheck(question, appData) {
  // Application butonlarını gizle
  const applicationButtons = document.getElementById('application-buttons');
  const applicationStatus = document.getElementById('application-status');
  if (applicationButtons) applicationButtons.style.display = 'none';
  if (applicationStatus) applicationStatus.style.display = 'none';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content application-check-modal">
      <h3>Uygulama Kontrolü</h3>
      ${appData.checkImage ? `<img src="${appData.checkImage}" alt="Doğru uygulama" class="check-image">` : ''}
      <div class="check-description">${appData.checkText || 'Uygulamanın doğru yapılıp yapılmadığını kontrol edin.'}</div>
      <div class="check-buttons">
        <button class="btn-correct" id="app-correct-btn">
          <i data-lucide="check"></i> Doğru
        </button>
        <button class="btn-wrong" id="app-wrong-btn">
          <i data-lucide="x"></i> Yanlış
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  document.getElementById('app-correct-btn').addEventListener('click', () => {
    modal.remove();
    showQuestionResult(true, question);
  });
  
  document.getElementById('app-wrong-btn').addEventListener('click', () => {
    modal.remove();
    showQuestionResult(false, question);
  });
}

// =========================
// SES YÖNETİMİ FONKSİYONLARI
// =========================

// Ses yöneticisini başlat
async function initSoundManager() {
  try {
    // SoundManager sınıfı kontrol et
    if (typeof SoundManager === 'undefined') {
      console.warn('SoundManager bulunamadı, sound-manager.js yüklenmiş mi?');
      return;
    }
    
    // Ses yöneticisi oluştur
    soundManager = new SoundManager();
    await soundManager.init();
    
    // Ses kontrol UI'sını oluştur
    createSoundControls();
    
    // Arka plan müziği: Otomatik başlaması devre dışı
    // Ses seviyesi ayarlarının yönetimi ve manual başlatma UI'dan yapılacak
    
    console.log('Ses yöneticisi başlatıldı');
  } catch (error) {
    console.error('Ses yöneticisi başlatılamadı:', error);
  }
}

// Ses kontrol UI'sını oluştur
function createSoundControls() {
  // Kontrol paneli zaten varsa çık
  if (document.getElementById('sound-controls')) return;
  
  const controlsHtml = `
    <div id="sound-controls" class="sound-controls">
      <button id="sound-toggle-btn" class="sound-control-btn" title="Sesi Aç/Kapat">
        <i data-lucide="volume-2" id="sound-icon"></i>
      </button>
      <div id="volume-control" class="volume-control hidden" style="position: absolute; top: 60px; right: 3px; flex-direction: column; width: 42px; padding: 10px 0; box-sizing: border-box;">
        <label style="font-size: 9px; font-weight: 600; color: #4a9eff; margin-bottom: 6px; text-align: center;">Efekt</label>
        <input type="range" 
           id="volume-slider" 
           min="0" 
           max="100" 
           value="70" 
           class="volume-slider"
           orient="vertical"
           style="writing-mode: vertical-lr; direction: rtl; width: 6px; height: 70px; margin: 0 auto;">
        <span id="volume-value" style="text-align: center; margin: 6px 0; font-size: 9px; font-weight: 600; color: #4a9eff;">70%</span>
        
        <label style="font-size: 9px; font-weight: 600; color: #4a9eff; margin: 6px 0 6px; text-align: center;">Müzik</label>
        <input type="range" 
           id="music-slider" 
           min="0" 
           max="100" 
           value="50" 
           class="volume-slider"
           orient="vertical"
           style="writing-mode: vertical-lr; direction: rtl; width: 6px; height: 70px; margin: 0 auto;">
        <span id="music-value" style="text-align: center; margin-top: 6px; font-size: 9px; font-weight: 600; color: #4a9eff;">50%</span>
      </div>
    </div>
  `;
  
  // Body'ye ekle
  document.body.insertAdjacentHTML('beforeend', controlsHtml);
  
  // Event listener'ları ekle
  const toggleBtn = document.getElementById('sound-toggle-btn');
  const volumeControl = document.getElementById('volume-control');
  const volumeSlider = document.getElementById('volume-slider');
  const volumeValue = document.getElementById('volume-value');
  const musicSlider = document.getElementById('music-slider');
  const musicValue = document.getElementById('music-value');
  const soundIcon = document.getElementById('sound-icon');

  // Mobilde popover'ı butonun altına aç (aşağı doğru)
  if (window.innerWidth <= 768) {
    volumeControl.style.top = '60px';
    volumeControl.style.bottom = 'unset';
    volumeControl.style.right = '0px';
    volumeControl.style.width = '48px';
  }

  // Her etkileşimde arka plan müziğini ayakta tut
  const resumeBackgroundIfPaused = () => {
    if (!soundManager) return;
    const bgAudio = soundManager.sounds?.background_music;
    if (bgAudio && bgAudio.paused && bgAudio.readyState >= 2) {
      bgAudio.play().catch(() => {});
    }
  };

  // Yönetici paneline de yansıtmak için volume değerini API'ye gönder
  const updateVolumeOnServer = async (type, volume) => {
    try {
      console.log(`📡 Sunucuya gönderiliyor: ${type} = ${volume}%`);
      
      const response = await fetch('/api/update-sound-setting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soundType: type, volume })
      });
      
      if (response.ok) {
        console.log(`✅ ${type} sunucuda kaydedildi`);
        // Socket.IO ile admin paneline bildir
        if (socket !== null && socket !== undefined) {
          socket.emit('sound-setting-updated', { soundType: type, volume });
          console.log(`📢 Socket.IO: sound-setting-updated gönderildi`);
        }
      } else {
        console.error(`❌ Sunucu hatası:`, response.status);
      }
    } catch (e) {
      console.error('❌ Ses güncelleme başarısız:', e.message);
    }
  };
  
  // soundManager'dan ses seviyelerini al ve UI'ya yansıt
  if (soundManager) {
    // ✅ Önce soundTypes değerlerini kontrol et, sonra settings'den oku
    let musicVolume = soundManager.soundTypes?.background_music?.volume;
    let effectVolume = soundManager.soundTypes?.correct_answer?.volume;
    
    // Eğer soundTypes'ta değer yoksa, settings'den hesapla
    if (musicVolume === undefined || musicVolume === null) {
      musicVolume = Math.round(soundManager.settings.musicVolume * 100);
      console.log('⚠️ soundTypes.background_music.volume undefined, settings kullanılıyor:', musicVolume);
    }
    
    if (effectVolume === undefined || effectVolume === null) {
      effectVolume = Math.round(soundManager.settings.effectVolume * 100);
      console.log('⚠️ soundTypes.correct_answer.volume undefined, settings kullanılıyor:', effectVolume);
    }

    console.log('🎚️ Slider değerleri ayarlanıyor:', { musicVolume, effectVolume });

    musicSlider.value = musicVolume;
    musicValue.textContent = musicVolume + '%';

    volumeSlider.value = effectVolume;
    volumeValue.textContent = effectVolume + '%';

    // SoundManager iç ayarlarını da bu değerlere eşitle
    soundManager.setMusicVolume(musicVolume / 100);
    soundManager.setEffectVolume(effectVolume / 100);
    
    // İkonu da başlangıç değerlerine göre ayarla
    if (musicVolume === 0 && effectVolume === 0) {
      soundIcon.setAttribute('data-lucide', 'volume-x');
    } else if (musicVolume < 50 && effectVolume < 50) {
      soundIcon.setAttribute('data-lucide', 'volume-1');
    } else {
      soundIcon.setAttribute('data-lucide', 'volume-2');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  
  // Ses aç/kapat - CLICK event
  let isMuted = false;
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Volume control'ü toggle et
    volumeControl.classList.toggle('hidden');
    resumeBackgroundIfPaused();
  });
  
  // Sayfa başka yerini tıklayınca kapat
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#sound-controls')) {
      volumeControl.classList.add('hidden');
    }
    resumeBackgroundIfPaused();
  });
  
  // Efekt ses seviyesi değiştir
  volumeSlider.addEventListener('input', (e) => {
    const volume = parseInt(e.target.value);
    volumeValue.textContent = volume + '%';
    
    console.log('Efekt ses seviyesi:', volume + '%');
    
    if (soundManager) {
      soundManager.setEffectVolume(volume / 100);
      // Etkiyi soundTypes'a da yaz (admin ile senkron)
      if (soundManager.soundTypes?.correct_answer) {
        soundManager.soundTypes.correct_answer.volume = volume;
      }
      updateVolumeOnServer('correct_answer', volume);
      
      // İkonu güncelle - %0 ise X, değilse normal
      if (volume === 0 && parseInt(musicSlider.value) === 0) {
        soundIcon.setAttribute('data-lucide', 'volume-x');
      } else if (volume < 50 && parseInt(musicSlider.value) < 50) {
        soundIcon.setAttribute('data-lucide', 'volume-1');
      } else {
        soundIcon.setAttribute('data-lucide', 'volume-2');
      }
      resumeBackgroundIfPaused();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });
  
  // Müzik ses seviyesi değiştir
  musicSlider.addEventListener('input', (e) => {
    const volume = parseInt(e.target.value);
    musicValue.textContent = volume + '%';
    
    console.log('Müzik ses seviyesi:', volume + '%');
    
    if (soundManager) {
      soundManager.setMusicVolume(volume / 100);
      // Arkaplan müziği için konfig'i güncelle ve sunucuya ilet
      if (soundManager.soundTypes?.background_music) {
        soundManager.soundTypes.background_music.volume = volume;
      }
      updateVolumeOnServer('background_music', volume);
      resumeBackgroundIfPaused();
      
      // İkonu güncelle
      if (volume === 0 && parseInt(volumeSlider.value) === 0) {
        soundIcon.setAttribute('data-lucide', 'volume-x');
      } else if (volume < 50 && parseInt(volumeSlider.value) < 50) {
        soundIcon.setAttribute('data-lucide', 'volume-1');
      } else {
        soundIcon.setAttribute('data-lucide', 'volume-2');
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });

  // Genel kullanıcı etkileşimlerinde müziği ayakta tut
  document.addEventListener('touchstart', resumeBackgroundIfPaused, { passive: true });
  document.addEventListener('pointerdown', resumeBackgroundIfPaused, { passive: true });
  
  // Lucide ikonlarını oluştur
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Ses çal (yardımcı fonksiyon)
function playSound(soundType, options = {}) {
  if (soundManager) {
    soundManager.play(soundType, options);
  }
}

// Tüm butonlara click ses efekti ekle
document.addEventListener('DOMContentLoaded', () => {
  // Event delegation kullanarak tüm buton tıklamalarını yakala
  document.addEventListener('click', (e) => {
    // Buton veya buton içindeki element tıklandıysa
    const button = e.target.closest('button');
    if (button && !button.disabled) {
      // Ses kontrol butonları için ses çalma (sonsuz döngü önleme)
      if (!button.id.includes('sound-toggle') && 
          !button.classList.contains('sound-control-btn') &&
          !button.classList.contains('btn-play-sound')) {
        playSound('button_click');
      }
    }
  });
});
