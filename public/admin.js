// State
let questions = [];
let editingQuestionId = null;
let deleteQuestionId = null;
let currentType = 'multiple';
let currentMode = 'normal';
let currentTrueFalseAnswer = 'true';
let currentImageData = null;
let qrLogoData = null;
let qrCodesCache = {};
let currentQuestionFilter = '';

// Login State
let isLoggedIn = false;
const SESSION_KEY = 'adminSession';
const PASSWORD_KEY = 'adminPassword';

// DOM Elements (will be initialized after login)
let navItems;
let sections;
let questionsList;
let qrList;
let questionForm;
let deleteModal;

// Login Elements
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password-input');
const togglePasswordBtn = document.getElementById('toggle-password');
const rememberCheckbox = document.getElementById('remember-password');
const loginError = document.getElementById('login-error');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  // Check login state
  setupLoginSystem();
  
  // Eğer giriş yapıldıysa admin panelini yükle
  if (isLoggedIn) {
    setupAdminPanel();
  }
});

// Login System
function setupLoginSystem() {
  // Session'dan giriş bilgilerini kontrol et
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session === 'true') {
    isLoggedIn = true;
    hideLoginScreen();
    return;
  }
  
  // localStorage'dan hatırlanmış şifreyi kontrol et
  const rememberedPassword = localStorage.getItem(PASSWORD_KEY);
  if (rememberedPassword) {
    passwordInput.value = rememberedPassword;
    rememberCheckbox.checked = true;
    // Otomatik login denemesi
    autoLogin(rememberedPassword);
  }
  
  // Login form event listeners
  loginForm.addEventListener('submit', handleLogin);
  togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
}

function togglePasswordVisibility() {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  
  // Icon değiştir
  const icon = togglePasswordBtn.querySelector('.eye-icon');
  if (isPassword) {
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    icon.setAttribute('data-lucide', 'eye');
  }
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function handleLogin(e) {
  e.preventDefault();
  
  const password = passwordInput.value.trim();
  if (!password) {
    showLoginError('Lütfen şifre girin');
    return;
  }
  
  // Server'a login request gönder
  const button = loginForm.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Kontrol ediliyor...';
  
  fetch('/api/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      isLoggedIn = true;
      sessionStorage.setItem(SESSION_KEY, 'true');
      
      // Remember password if checked
      if (rememberCheckbox.checked) {
        localStorage.setItem(PASSWORD_KEY, password);
      } else {
        localStorage.removeItem(PASSWORD_KEY);
      }
      
      hideLoginScreen();
      setupAdminPanel();
    } else {
      showLoginError(data.error || 'Şifre hatalı');
      passwordInput.focus();
    }
  })
  .catch(error => {
    console.error('Login hatası:', error);
    showLoginError('Bağlantı hatası. Lütfen tekrar deneyin.');
  })
  .finally(() => {
    button.disabled = false;
    button.textContent = originalText;
  });
}

function autoLogin(password) {
  fetch('/api/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      isLoggedIn = true;
      sessionStorage.setItem(SESSION_KEY, 'true');
      hideLoginScreen();
      setupAdminPanel();
    } else {
      // Hatırlanmış şifre hatalıysa temizle
      localStorage.removeItem(PASSWORD_KEY);
      passwordInput.value = '';
      rememberCheckbox.checked = false;
      showLoginScreen();
    }
  })
  .catch(error => {
    console.error('Auto login hatası:', error);
    showLoginScreen();
  });
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
  loginError.classList.add('show');
}

function hideLoginError() {
  loginError.classList.add('hidden');
  loginError.classList.remove('show');
}

function hideLoginScreen() {
  loginScreen.classList.add('hidden');
}

function showLoginScreen() {
  loginScreen.classList.remove('hidden');
}

// Setup Admin Panel
function setupAdminPanel() {
  // Initialize DOM Elements
  navItems = document.querySelectorAll('.nav-item[data-section]');
  sections = document.querySelectorAll('.section');
  questionsList = document.getElementById('questions-list');
  qrList = document.getElementById('qr-list');
  questionForm = document.getElementById('question-form');
  deleteModal = document.getElementById('delete-modal');
  
  // Setup fullscreen
  setupFullscreen();
  
  // Otomatik tam ekran aç (ilk kullanıcı etkileşiminde)
  autoEnterFullscreen();
  
  // Sidebar'a logout butonu ekle
  addLogoutButton();
  
  loadQuestions();
  loadSettings();
  loadQRSettings();
  setupEventListeners();
}

function addLogoutButton() {
  const sidebar = document.querySelector('.sidebar');
  const navMenu = sidebar.querySelector('.nav-menu');
  
  // Eğer zaten varsa kaldır
  const existingLogout = sidebar.querySelector('.logout-btn');
  if (existingLogout) {
    existingLogout.remove();
  }
  
  // Logout butonu ekle
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'logout-btn';
  logoutBtn.innerHTML = '<i data-lucide="log-out" class="logout-icon"></i> Çıkış Yap';
  logoutBtn.addEventListener('click', handleLogout);
  
  sidebar.appendChild(logoutBtn);
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function handleLogout() {
  isLoggedIn = false;
  sessionStorage.removeItem(SESSION_KEY);
  
  // Şifreyi hatırlamıyorsa temizle
  if (!rememberCheckbox.checked) {
    localStorage.removeItem(PASSWORD_KEY);
  }
  
  // Sayfayı yenile
  location.reload();
}

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
    // Enter fullscreen
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
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

// Setup Event Listeners
function setupEventListeners() {
  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = item.dataset.section;
      if (!sectionId) return;
      showSection(sectionId);
      
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
  
  // Type selector
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      updateFormForType();
    });
  });

  // Mode selector
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      updateModeHint();
    });
  });
  
  // True/False selector
  document.querySelectorAll('.tf-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tf-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTrueFalseAnswer = btn.dataset.value;
    });
  });
  
  // Add blank
  document.getElementById('add-blank').addEventListener('click', addBlankInput);
  
  // Add distractor
  document.getElementById('add-distractor').addEventListener('click', addDistractorInput);
  
  // Form submit
  questionForm.addEventListener('submit', handleSubmit);
  
  // Cancel edit
  document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
  
  // Delete modal
  document.getElementById('confirm-delete').addEventListener('click', confirmDelete);
  document.getElementById('cancel-delete').addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    deleteQuestionId = null;
  });
  
  // Image upload
  document.getElementById('upload-image-btn').addEventListener('click', () => {
    document.getElementById('image-file').click();
  });
  
  document.getElementById('image-file').addEventListener('change', handleImageUpload);
  
  document.getElementById('remove-image-btn').addEventListener('click', removeImage);
  
  // Import/Export
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importData);
  document.getElementById('clear-all-btn').addEventListener('click', clearAllData);
  document.getElementById('migrate-images-btn').addEventListener('click', migrateImages);
  
  // QR Code Settings
  document.getElementById('upload-qr-logo-btn').addEventListener('click', () => {
    document.getElementById('qr-logo').click();
  });
  document.getElementById('qr-logo').addEventListener('change', handleQRLogoUpload);
  document.getElementById('remove-qr-logo-btn').addEventListener('click', removeQRLogo);
  document.getElementById('refresh-qr-btn').addEventListener('click', loadQRCodes);
  document.getElementById('download-all-qr-btn').addEventListener('click', downloadAllQRCodes);
  document.getElementById('download-pdf-btn').addEventListener('click', downloadQRCodesPDF);
  
  // Matching pairs
  document.getElementById('add-matching-pair').addEventListener('click', addMatchingPair);
  document.querySelectorAll('.btn-remove-pair').forEach(btn => {
    btn.addEventListener('click', (e) => e.target.closest('.matching-pair').remove());
  });
  
  // Drag drop
  document.getElementById('add-drag-item').addEventListener('click', addDragItem);
  document.querySelectorAll('.btn-remove-drag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.drag-item-input').remove();
      updateDragOrder();
    });
  });
  document.querySelectorAll('.drag-type-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleDragType(btn.dataset.dragType));
  });
  document.getElementById('add-category').addEventListener('click', addCategory);
  document.querySelectorAll('.btn-add-category-item').forEach(btn => {
    btn.addEventListener('click', (e) => addCategoryItem(e.target.closest('.category-group')));
  });
  
  // Application image
  document.getElementById('upload-application-image-btn').addEventListener('click', () => {
    document.getElementById('application-image-file').click();
  });
  document.getElementById('application-image-file').addEventListener('change', handleApplicationImageUpload);
  document.getElementById('remove-application-image-btn').addEventListener('click', removeApplicationImage);
  
  // Info section toggle
  document.getElementById('info-enabled').addEventListener('change', (e) => {
    document.getElementById('info-content').classList.toggle('hidden', !e.target.checked);
  });
  
  // Info image upload
  document.getElementById('info-image-file').addEventListener('change', handleInfoImageUpload);
  document.getElementById('info-image-url').addEventListener('input', handleInfoImageUrl);
  document.getElementById('remove-info-image').addEventListener('click', removeInfoImage);
  
  // AR animation type change
  document.getElementById('ar-animation-type').addEventListener('change', (e) => {
    const customModel = document.getElementById('custom-ar-model');
    const customAframe = document.getElementById('custom-aframe-code');
    const arPreview = document.getElementById('ar-preview');
    
    // Tüm özel alanları gizle
    customModel.classList.add('hidden');
    customAframe.classList.add('hidden');
    
    if (e.target.value === 'custom') {
      customModel.classList.remove('hidden');
    } else if (e.target.value === 'custom-aframe') {
      customAframe.classList.remove('hidden');
    }
    
    if (e.target.value) {
      arPreview.classList.remove('hidden');
    } else {
      arPreview.classList.add('hidden');
    }
    
    // Lucide icons güncelle
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });
  
  // AR Marker type change
  document.querySelectorAll('input[name="ar-marker-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const customMarkerUpload = document.getElementById('custom-marker-upload');
      if (e.target.value === 'custom') {
        customMarkerUpload.classList.remove('hidden');
      } else {
        customMarkerUpload.classList.add('hidden');
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  });
  
  // AR Marker file upload
  document.getElementById('ar-marker-file').addEventListener('change', handleARMarkerUpload);
  document.getElementById('remove-ar-marker').addEventListener('click', removeARMarker);
  
  // AR 3D Model file upload
  document.getElementById('ar-model-file').addEventListener('change', handleARModelUpload);
  
  // AR Preview button
  document.getElementById('ar-preview-btn').addEventListener('click', openARPreview);
  
  // Settings
  const saveBtn = document.getElementById('save-settings-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSettings);
  }
  
  // Password Change Form
  const passwordForm = document.getElementById('password-form');
  if (passwordForm) {
    // Toggle password visibility buttons
    document.querySelectorAll('.toggle-password-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        const eyeIcon = btn.querySelector('.eye-icon');
        
        if (input.type === 'password') {
          input.type = 'text';
          eyeIcon.setAttribute('data-lucide', 'eye-off');
        } else {
          input.type = 'password';
          eyeIcon.setAttribute('data-lucide', 'eye');
        }
        
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      });
    });
    
    // Password form submit
    passwordForm.addEventListener('submit', handlePasswordChange);
  }
}

// Show Section
function showSection(sectionId, options = {}) {
  sections.forEach(section => section.classList.remove('active'));
  document.getElementById(`${sectionId}-section`).classList.add('active');
  
  if (sectionId === 'qr-codes') {
    loadQRCodes();
  } else if (sectionId === 'add-question') {
    // Reset form when switching to add question section (skip when editing)
    if (!options.skipReset) {
      resetForm();
    }
  }
}

// Update Form for Type
function updateFormForType() {
  // Tüm tip-specific alanları gizle
  document.getElementById('multiple-options').classList.add('hidden');
  document.getElementById('truefalse-options').classList.add('hidden');
  document.getElementById('fillblank-options').classList.add('hidden');
  document.getElementById('matching-options').classList.add('hidden');
  document.getElementById('drag-drop-options').classList.add('hidden');
  document.getElementById('application-options').classList.add('hidden');
  document.querySelector('.fillblank-hint').classList.add('hidden');
  
  // Seçilen tipe göre alanları göster
  if (currentType === 'multiple') {
    document.getElementById('multiple-options').classList.remove('hidden');
  } else if (currentType === 'truefalse') {
    document.getElementById('truefalse-options').classList.remove('hidden');
  } else if (currentType === 'fillblank') {
    document.getElementById('fillblank-options').classList.remove('hidden');
    document.querySelector('.fillblank-hint').classList.remove('hidden');
  } else if (currentType === 'matching') {
    document.getElementById('matching-options').classList.remove('hidden');
  } else if (currentType === 'drag_drop') {
    document.getElementById('drag-drop-options').classList.remove('hidden');
  } else if (currentType === 'application') {
    document.getElementById('application-options').classList.remove('hidden');
  }
}

function updateModeHint() {
  const hint = document.getElementById('mode-hint');
  if (!hint) return;
  const hints = {
    normal: 'Normal modda soru tipine göre standart akış kullanılır.',
    duel: 'Kapışma 2\'li modunda seçtiğiniz soru tipi kullanılacaktır.',
    group_duel: 'Kapışma Hep Birlikte modunda seçtiğiniz soru tipi kullanılacaktır.'
  };
  hint.textContent = hints[currentMode] || hints.normal;
}

// Add Blank Input
function addBlankInput() {
  const container = document.getElementById('blank-answers');
  const count = container.children.length + 1;
  
  const div = document.createElement('div');
  div.className = 'blank-input';
  div.innerHTML = `
    <span>${count}. Boşluk:</span>
    <input type="text" class="blank-answer" placeholder="Doğru cevap">
  `;
  container.appendChild(div);
}

// Add Distractor Input
function addDistractorInput() {
  const container = document.getElementById('distractor-options');
  const count = container.children.length + 1;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'distractor';
  input.placeholder = `Yanlış seçenek ${count}`;
  container.appendChild(input);
}

// Add Matching Pair
function addMatchingPair() {
  const container = document.getElementById('matching-pairs');
  const div = document.createElement('div');
  div.className = 'matching-pair';
  div.innerHTML = `
    <input type="text" class="match-left" placeholder="Sol öğe">
    <span class="match-arrow">↔</span>
    <input type="text" class="match-right" placeholder="Sağ eşi">
    <button type="button" class="btn-remove-pair">✕</button>
  `;
  container.appendChild(div);
  
  div.querySelector('.btn-remove-pair').addEventListener('click', () => div.remove());
}

// Add Drag Item
function addDragItem() {
  const container = document.getElementById('drag-items');
  const count = container.children.length + 1;
  
  const div = document.createElement('div');
  div.className = 'drag-item-input';
  div.innerHTML = `
    <span class="drag-order">${count}.</span>
    <input type="text" class="drag-item" placeholder="${count}. sıradaki öğe">
    <button type="button" class="btn-remove-drag">✕</button>
  `;
  container.appendChild(div);
  
  div.querySelector('.btn-remove-drag').addEventListener('click', () => {
    div.remove();
    updateDragOrder();
  });
}

// Update Drag Order Numbers
function updateDragOrder() {
  const items = document.querySelectorAll('#drag-items .drag-item-input');
  items.forEach((item, index) => {
    item.querySelector('.drag-order').textContent = `${index + 1}.`;
    item.querySelector('.drag-item').placeholder = `${index + 1}. sıradaki öğe`;
  });
}

// Add Category
function addCategory() {
  const container = document.getElementById('drag-categories');
  const div = document.createElement('div');
  div.className = 'category-group';
  div.innerHTML = `
    <input type="text" class="category-name" placeholder="Kategori Adı">
    <div class="category-items">
      <input type="text" class="category-item" placeholder="Öğe 1">
      <input type="text" class="category-item" placeholder="Öğe 2">
    </div>
    <button type="button" class="btn-add-category-item btn-small">+ Öğe</button>
    <button type="button" class="btn-remove-category btn-small btn-danger">Kategoriyi Sil</button>
  `;
  container.appendChild(div);
  
  div.querySelector('.btn-add-category-item').addEventListener('click', () => addCategoryItem(div));
  div.querySelector('.btn-remove-category').addEventListener('click', () => div.remove());
}

// Add Category Item
function addCategoryItem(categoryGroup) {
  const itemsContainer = categoryGroup.querySelector('.category-items');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'category-item';
  input.placeholder = `Öğe ${itemsContainer.children.length + 1}`;
  itemsContainer.appendChild(input);
}

// Toggle Drag Type
function toggleDragType(type) {
  document.querySelectorAll('.drag-type-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.drag-type-btn[data-drag-type="${type}"]`).classList.add('active');
  
  if (type === 'order') {
    document.getElementById('drag-order-options').classList.remove('hidden');
    document.getElementById('drag-category-options').classList.add('hidden');
  } else {
    document.getElementById('drag-order-options').classList.add('hidden');
    document.getElementById('drag-category-options').classList.remove('hidden');
  }
}

// Application Image Upload
let applicationImageData = null;

function handleApplicationImageUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      applicationImageData = event.target.result;
      document.getElementById('application-preview-img').src = applicationImageData;
      document.getElementById('application-image-preview').classList.remove('hidden');
      document.getElementById('application-image-data').value = applicationImageData;
    };
    reader.readAsDataURL(file);
  }
}

function removeApplicationImage() {
  applicationImageData = null;
  document.getElementById('application-image-file').value = '';
  document.getElementById('application-image-preview').classList.add('hidden');
  document.getElementById('application-image-data').value = '';
}

// Info Image Upload
function handleInfoImageUpload(e) {
  const file = e.target.files[0];
  if (file) {
    // Max 2MB for info image
    if (file.size > 2 * 1024 * 1024) {
      alert('Resim boyutu 2MB\'dan küçük olmalıdır!');
      return;
    }
    const reader = new FileReader();
    reader.onload = function(event) {
      document.getElementById('info-image-url').value = event.target.result;
      document.getElementById('info-preview-img').src = event.target.result;
      document.getElementById('info-image-preview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
}

function handleInfoImageUrl(e) {
  const url = e.target.value.trim();
  if (url) {
    document.getElementById('info-preview-img').src = url;
    document.getElementById('info-image-preview').classList.remove('hidden');
  } else {
    document.getElementById('info-image-preview').classList.add('hidden');
  }
}

function removeInfoImage() {
  document.getElementById('info-image-file').value = '';
  document.getElementById('info-image-url').value = '';
  document.getElementById('info-image-preview').classList.add('hidden');
}

// AR Marker Upload
function handleARMarkerUpload(e) {
  const file = e.target.files[0];
  if (file) {
    // Max 1MB for marker
    if (file.size > 1024 * 1024) {
      alert('Marker dosyası 1MB\'dan küçük olmalıdır!');
      return;
    }
    
    const fileName = file.name.toLowerCase();
    const isPattFile = fileName.endsWith('.patt');
    
    if (!isPattFile) {
      // Resim yüklendi - uyarı göster
      alert('⚠️ Dikkat: AR.js sadece .patt (pattern) dosyalarını destekler.\n\nÖzel marker kullanmak için:\n1. "Marker oluşturmak için tıklayın" linkine gidin\n2. Resminizi yükleyin\n3. "Download Marker" ile .patt dosyasını indirin\n4. Bu .patt dosyasını buraya yükleyin\n\nŞimdilik varsayılan Hiro marker kullanılacak.');
      
      // Önizleme için resmi göster ama marker olarak kullanma
      const reader = new FileReader();
      reader.onload = function(event) {
        document.getElementById('ar-marker-preview-img').src = event.target.result;
        document.getElementById('ar-marker-preview').classList.remove('hidden');
        // URL'yi temizle - resim marker olarak kullanılamaz
        document.getElementById('ar-marker-url').value = '';
      };
      reader.readAsDataURL(file);
      return;
    }
    
    // .patt dosyası - içeriğini oku
    const reader = new FileReader();
    reader.onload = function(event) {
      const pattContent = event.target.result;
      
      // .patt dosyasını data URL olarak kaydet
      const pattDataUrl = 'data:text/plain;base64,' + btoa(pattContent);
      document.getElementById('ar-marker-url').value = pattDataUrl;
      
      // Önizleme göster (pattern ikonu)
      document.getElementById('ar-marker-preview-img').src = 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#1a1a2e"/>
          <rect x="10" y="10" width="30" height="30" fill="#00d4ff"/>
          <rect x="60" y="10" width="30" height="30" fill="#00d4ff"/>
          <rect x="10" y="60" width="30" height="30" fill="#00d4ff"/>
          <rect x="60" y="60" width="30" height="30" fill="#333"/>
          <text x="50" y="55" font-size="10" fill="white" text-anchor="middle">.patt</text>
        </svg>
      `);
      document.getElementById('ar-marker-preview').classList.remove('hidden');
      
      alert('✅ Pattern dosyası başarıyla yüklendi! Bu marker\'ı taratarak AR animasyonu görebilirsiniz.');
    };
    reader.readAsText(file);
  }
}

function removeARMarker() {
  document.getElementById('ar-marker-file').value = '';
  document.getElementById('ar-marker-url').value = '';
  document.getElementById('ar-marker-preview').classList.add('hidden');
  // Varsayılan Hiro'ya geri dön
  document.querySelector('input[name="ar-marker-type"][value="hiro"]').checked = true;
  document.getElementById('custom-marker-upload').classList.add('hidden');
}

// AR 3D Model Upload
async function handleARModelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const fileName = file.name.toLowerCase();
  const isValidFormat = fileName.endsWith('.glb') || fileName.endsWith('.gltf');
  
  if (!isValidFormat) {
    alert('Sadece .glb veya .gltf dosyaları desteklenir!');
    return;
  }
  
  // Max 50MB for 3D models
  if (file.size > 50 * 1024 * 1024) {
    alert('Model dosyası 50MB\'dan küçük olmalıdır!');
    return;
  }
  
  // Dosya adını göster
  document.getElementById('model-filename').textContent = '⏳ Yükleniyor...';
  
  try {
    // Dosyayı base64'e çevir
    const reader = new FileReader();
    const modelData = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    // Sunucuya yükle
    const response = await fetch('/api/upload-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelData: modelData,
        filename: `model-${Date.now()}-${file.name}`
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // URL'yi input'a yaz
      document.getElementById('ar-model-url').value = result.url;
      document.getElementById('model-filename').textContent = `✅ ${file.name}`;
      
      // Otomatik olarak animasyon tipini "custom" yap
      document.getElementById('ar-animation-type').value = 'custom';
    } else {
      throw new Error(result.error || 'Yükleme başarısız');
    }
  } catch (error) {
    console.error('Model yükleme hatası:', error);
    document.getElementById('model-filename').textContent = '❌ Yükleme başarısız';
    alert('Model yüklenirken hata oluştu: ' + error.message);
  }
}

// AR Preview - Önizleme için AR viewer'ı aç
function openARPreview() {
  const arType = document.getElementById('ar-animation-type').value || 'circuit';
  const markerType = document.querySelector('input[name="ar-marker-type"]:checked')?.value || 'hiro';
  const aframeCode = document.getElementById('ar-aframe-code').value || '';
  const modelUrl = document.getElementById('ar-model-url')?.value || '';
  const modelTitle = document.getElementById('ar-model-title')?.value || '';
  const modelDescription = document.getElementById('ar-model-description')?.value || '';
  
  // Marker URL'sini al - pattern dosyası için ar-marker-url input'unu kullan
  let markerUrl = '';
  if (markerType === 'custom') {
    const markerUrlInput = document.getElementById('ar-marker-url');
    if (markerUrlInput && markerUrlInput.value) {
      markerUrl = markerUrlInput.value;
      console.log('Custom marker URL loaded:', markerUrl.substring(0, 50) + '...');
    } else {
      alert('Özel marker kullanmak için önce .patt dosyası yüklemelisiniz!');
      return;
    }
  }
  
  // AR verisini localStorage'a kaydet
  const arData = {
    type: arType,
    title: modelTitle || 'AR Önizleme',
    modelUrl: modelUrl,
    modelTitle: modelTitle,
    modelDescription: modelDescription,
    aframeCode: aframeCode,
    markerType: markerType,
    markerUrl: markerUrl
  };
  console.log('Saving AR data:', { ...arData, markerUrl: markerUrl ? markerUrl.substring(0, 50) + '...' : 'none' });
  localStorage.setItem('ar-animation-data', JSON.stringify(arData));
  
  // Marker tipine göre uygun sayfayı aç
  if (markerType === 'custom') {
    // Özel marker - pattern'ı sunucuya yükle ve direkt AR aç
    uploadPatternAndOpenARPreview(markerUrl, arType, modelUrl, modelTitle, modelDescription);
  } else {
    // Hiro marker için normal sayfa
    openAROverlay(`/ar-viewer.html?type=${arType}`);
  }
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

// Özel marker için pattern yükle ve AR önizleme aç
async function uploadPatternAndOpenARPreview(patternData, animationType, modelUrl = '', modelTitle = '', modelDescription = '') {
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
      // Sunucu tarafında dinamik sayfa ile direkt aç
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

// Load Questions
async function loadQuestions() {
  try {
    const response = await fetch('/api/questions');
    questions = await response.json();
    renderQuestions();
  } catch (error) {
    console.error('Sorular yüklenirken hata:', error);
  }
}

// Render Question Statistics
function renderQuestionStats() {
  const statsContainer = document.getElementById('question-stats');
  if (!statsContainer) return;
  
  const typeLabels = {
    multiple: 'Çoktan Seçmeli',
    truefalse: 'Doğru/Yanlış',
    fillblank: 'Boşluk Doldurma',
    duel: 'Kapışma 2\'li',
    group_duel: 'Kapışma Hep Birlikte',
    matching: 'Eşleme',
    drag_drop: 'Sürükle Bırak',
    application: 'Uygulama'
  };

  const modeLabels = {
    normal: 'Normal',
    duel: 'Kapışma 2\'li',
    group_duel: 'Kapışma Hep Birlikte'
  };
  
  const typeIcons = {
    multiple: 'list',
    truefalse: 'check-circle',
    fillblank: 'text-cursor-input',
    duel: 'swords',
    group_duel: 'users',
    matching: 'link',
    drag_drop: 'move',
    application: 'cpu'
  };
  
  const typeColors = {
    multiple: '#3b82f6',
    truefalse: '#10b981',
    fillblank: '#f59e0b',
    duel: '#ef4444',
    group_duel: '#8b5cf6',
    matching: '#06b6d4',
    drag_drop: '#ec4899',
    application: '#6366f1'
  };
  
  // Count questions by type
  const typeCounts = {};
  questions.forEach(q => {
    const normalizedType = q.type === 'battle' ? 'group_duel' : q.type;
    typeCounts[normalizedType] = (typeCounts[normalizedType] || 0) + 1;
  });
  
  const totalCount = questions.length;
  
  // Generate stats HTML
  let statsHTML = `
    <div class="stats-summary">
      <div class="stats-total">
        <i data-lucide="file-question"></i>
        <span class="stats-number">${totalCount}</span>
        <span class="stats-label">Toplam Soru</span>
      </div>
      <div class="stats-breakdown">
        <div class="stat-item ${currentQuestionFilter === '' ? 'active' : ''}" data-type="all" style="--stat-color: #4cc9f0; ${currentQuestionFilter === '' ? 'box-shadow: 0 0 0 2px var(--stat-color);' : ''}">
          <i data-lucide="layers"></i>
          <span class="stat-count">${totalCount}</span>
          <span class="stat-name">Tüm Sorular</span>
          <span class="stat-percent">100%</span>
        </div>
  `;
  
  // Add each type with count
  Object.keys(typeLabels).forEach(type => {
    const count = typeCounts[type] || 0;
    const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
    const isActive = currentQuestionFilter === type;
    statsHTML += `
      <div class="stat-item ${isActive ? 'active' : ''}" data-type="${type}" style="--stat-color: ${typeColors[type]}; ${isActive ? 'box-shadow: 0 0 0 2px var(--stat-color);' : ''}">
        <i data-lucide="${typeIcons[type]}"></i>
        <span class="stat-count">${count}</span>
        <span class="stat-name">${typeLabels[type]}</span>
        <span class="stat-percent">${percentage}%</span>
      </div>
    `;
  });
  
  statsHTML += `
      </div>
    </div>
  `;
  
  statsContainer.innerHTML = statsHTML;
  
  // Click to filter
  statsContainer.querySelectorAll('.stat-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.dataset.type;
      currentQuestionFilter = type === 'all' ? '' : type;
      renderQuestions();
    });
  });
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Render Questions
function renderQuestions() {
  // First render the stats
  renderQuestionStats();
  
  let filtered = questions;
  
  if (currentQuestionFilter) {
    filtered = filtered.filter(q => {
      const normalizedType = q.type === 'battle' ? 'group_duel' : q.type;
      return normalizedType === currentQuestionFilter;
    });
  }
  
  if (filtered.length === 0) {
    questionsList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="file-question" class="empty-icon-svg"></i>
        <h3>Henüz soru eklenmemiş</h3>
        <p>Yeni soru eklemek için "Soru Ekle" menüsünü kullanın</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }
  
  const typeLabels = {
    multiple: 'Çoktan Seçmeli',
    truefalse: 'Doğru/Yanlış',
    fillblank: 'Boşluk Doldurma',
    duel: 'Kapışma 2\'li',
    group_duel: 'Kapışma Hep Birlikte',
    matching: 'Eşleme',
    drag_drop: 'Sürükle Bırak',
    application: 'Uygulama'
  };

  const modeLabels = {
    normal: 'Normal',
    duel: 'Kapışma 2\'li',
    group_duel: 'Kapışma Hep Birlikte'
  };
  
  questionsList.innerHTML = filtered.map(q => {
    const normalizedType = q.type === 'battle' ? 'group_duel' : q.type;
    const mode = q.mode || (normalizedType === 'duel' || normalizedType === 'group_duel' ? normalizedType : 'normal');
    const baseType = q.base_type || (mode !== 'normal' ? 'application' : q.type);
    const modeBadge = mode !== 'normal'
      ? `<span class="meta-badge badge-type">${modeLabels[mode] || mode}</span>`
      : '';
    const typeBadge = `<span class="meta-badge badge-type">${typeLabels[baseType] || baseType}</span>`;

    return `
    <div class="question-item" data-id="${q.id}">
      <div class="question-qr">QR: ${q.qr_code}</div>
      <div class="question-info">
        <h4>${q.question_text.substring(0, 100)}${q.question_text.length > 100 ? '...' : ''}</h4>
        <div class="question-meta">
          ${modeBadge}
          ${typeBadge}
          <span class="meta-badge badge-easy">+${q.correct_steps || 3} adım</span>
          <span class="meta-badge badge-hard">-${q.wrong_steps || 1} adım</span>
          ${q.time_limit ? `<span class="meta-badge badge-time">⏱ ${q.time_limit}sn</span>` : ''}
        </div>
      </div>
      <div class="question-actions">
        <button class="action-btn edit" onclick="editQuestion('${q.id}')"><i data-lucide="pencil"></i></button>
        ${q.type !== 'duel' && q.type !== 'group_duel' ? `
          <button class="action-btn copy copy-duel" onclick="copyToDuel('${q.id}')" title="Kapışma 2'li olarak kopyala"><i data-lucide="copy"></i></button>
          <button class="action-btn copy copy-group-duel" onclick="copyToGroupDuel('${q.id}')" title="Kapışma Hep Birlikte olarak kopyala"><i data-lucide="users"></i></button>
        ` : ''}
        <button class="action-btn delete" onclick="deleteQuestion('${q.id}')"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
  `;
  }).join('');
  
  // Re-initialize Lucide icons for dynamically added content
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Filter Questions (legacy noop)
function filterQuestions() {
  renderQuestions();
}

// Handle Form Submit
async function handleSubmit(e) {
  e.preventDefault();
  
  const qrCode = document.getElementById('qr-code').value.trim();
  const correctSteps = parseInt(document.getElementById('correct-steps').value) || 3;
  const wrongSteps = parseInt(document.getElementById('wrong-steps').value) || 1;
  const timeLimit = parseInt(document.getElementById('time-limit').value) || 0;
  const questionText = document.getElementById('question-text').value.trim();
  
  // Handle image - save base64 directly to database
  let imageUrl = null;
  if (currentImageData) {
    imageUrl = currentImageData; // Store base64 directly
  }
  
  let options = null;
  let correctAnswer = '';
  let fillBlanks = null;
  let matchingPairs = null;
  let dragDropData = null;
  let applicationData = null;
  
  if (currentType === 'multiple') {
    options = [
      document.getElementById('option-a').value.trim(),
      document.getElementById('option-b').value.trim(),
      document.getElementById('option-c').value.trim(),
      document.getElementById('option-d').value.trim()
    ];
    correctAnswer = document.querySelector('input[name="correct"]:checked').value;
  } else if (currentType === 'truefalse') {
    correctAnswer = currentTrueFalseAnswer;
  } else if (currentType === 'fillblank') {
    const blankAnswers = Array.from(document.querySelectorAll('.blank-answer'))
      .map(input => input.value.trim())
      .filter(v => v);
    
    const distractors = Array.from(document.querySelectorAll('.distractor'))
      .map(input => input.value.trim())
      .filter(v => v);
    
    fillBlanks = {
      answers: blankAnswers,
      options: [...blankAnswers, ...distractors]
    };
    correctAnswer = blankAnswers.join(',');
  } else if (currentType === 'matching') {
    matchingPairs = Array.from(document.querySelectorAll('.matching-pair')).map(pair => ({
      left: pair.querySelector('.match-left').value.trim(),
      right: pair.querySelector('.match-right').value.trim()
    })).filter(p => p.left && p.right);
  } else if (currentType === 'drag_drop') {
    const dragType = document.querySelector('.drag-type-btn.active').dataset.dragType;
    
    if (dragType === 'order') {
      const items = Array.from(document.querySelectorAll('.drag-item'))
        .map(input => input.value.trim())
        .filter(v => v);
      dragDropData = { type: 'order', items };
    } else {
      const categories = Array.from(document.querySelectorAll('.category-group')).map(group => ({
        name: group.querySelector('.category-name').value.trim(),
        items: Array.from(group.querySelectorAll('.category-item'))
          .map(input => input.value.trim())
          .filter(v => v)
      })).filter(c => c.name && c.items.length > 0);
      dragDropData = { type: 'category', categories };
    }
  } else if (currentType === 'application') {
    applicationData = {
      instructions: document.getElementById('application-instructions').value.trim(),
      checkImage: applicationImageData || null,
      checkText: document.getElementById('application-check-text').value.trim()
    };
  }

  const normalizedMode = currentMode === 'battle' ? 'group_duel' : currentMode;
  const dataType = normalizedMode === 'normal' ? currentType : normalizedMode;
  const baseType = normalizedMode === 'normal' ? null : currentType;
  
  const data = {
    type: dataType,
    mode: normalizedMode,
    base_type: baseType,
    correct_steps: correctSteps,
    wrong_steps: wrongSteps,
    time_limit: timeLimit,
    qr_code: qrCode,
    question_text: questionText,
    image_url: imageUrl,
    options,
    correct_answer: correctAnswer,
    fill_blanks: fillBlanks,
    matching_pairs: matchingPairs,
    drag_drop: dragDropData,
    application: applicationData,
    info: document.getElementById('info-enabled').checked ? {
      enabled: true,
      title: document.getElementById('info-title').value.trim(),
      text: document.getElementById('info-text').value.trim(),
      image: document.getElementById('info-image-url').value.trim() || null,
      ar_animation: document.getElementById('ar-animation-type').value ? {
        type: document.getElementById('ar-animation-type').value,
        model_url: document.getElementById('ar-animation-type').value === 'custom' 
          ? document.getElementById('ar-model-url').value.trim() 
          : null,
        model_title: document.getElementById('ar-animation-type').value === 'custom'
          ? document.getElementById('ar-model-title').value.trim()
          : null,
        model_description: document.getElementById('ar-animation-type').value === 'custom'
          ? document.getElementById('ar-model-description').value.trim()
          : null,
        aframe_code: document.getElementById('ar-animation-type').value === 'custom-aframe'
          ? document.getElementById('ar-aframe-code').value.trim()
          : null,
        marker_type: document.querySelector('input[name="ar-marker-type"]:checked').value,
        marker_url: document.querySelector('input[name="ar-marker-type"]:checked').value === 'custom'
          ? document.getElementById('ar-marker-url').value.trim()
          : null
      } : null
    } : null
  };
  
  try {
    let response;
    if (editingQuestionId) {
      response = await fetch(`/api/questions/${editingQuestionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }
    
    const result = await response.json();
    
    if (response.ok) {
      alert(editingQuestionId ? 'Soru güncellendi!' : 'Soru eklendi!');
      resetForm();
      loadQuestions();
      showSection('questions');
      
      document.querySelector('.nav-item[data-section="questions"]').classList.add('active');
      document.querySelector('.nav-item[data-section="add-question"]').classList.remove('active');
    } else {
      alert(result.error || 'Bir hata oluştu');
    }
  } catch (error) {
    console.error('Hata:', error);
    alert('Bir hata oluştu');
  }
}

// Edit Question
function editQuestion(id) {
  const question = questions.find(q => q.id === id);
  if (!question) return;
  
  editingQuestionId = id;
  
  // Show add question section
  showSection('add-question', { skipReset: true });
  document.querySelector('.nav-item[data-section="add-question"]').classList.add('active');
  document.querySelector('.nav-item[data-section="questions"]').classList.remove('active');
  
  // Update form title
  document.getElementById('form-title').textContent = 'Soru Düzenle';
  document.getElementById('submit-btn-text').textContent = 'Güncelle';
  document.getElementById('cancel-edit').classList.remove('hidden');
  
  // Set type
  const storedMode = question.mode || (question.type === 'duel' || question.type === 'group_duel' || question.type === 'battle'
    ? (question.type === 'battle' ? 'group_duel' : question.type)
    : 'normal');
  currentMode = storedMode;
  currentType = question.base_type || (storedMode !== 'normal' ? 'application' : question.type);

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });
  updateModeHint();

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === currentType);
  });
  updateFormForType();
  
  // Fill form
  document.getElementById('qr-code').value = question.qr_code;
  document.getElementById('correct-steps').value = question.correct_steps || 2;
  document.getElementById('wrong-steps').value = question.wrong_steps || 1;
  document.getElementById('question-text').value = question.question_text;
  document.getElementById('time-limit').value = question.time_limit || 0;
  
  // Load image if exists
  if (question.image_url) {
    let imageData = question.image_url;
    
    // Legacy support: check if it's a localStorage key
    if (question.image_url.startsWith('quiz_image_')) {
      imageData = localStorage.getItem(question.image_url);
    }
    
    if (imageData && imageData.startsWith('data:')) {
      currentImageData = imageData;
      document.getElementById('preview-img').src = imageData;
      document.getElementById('image-preview').classList.remove('hidden');
      document.getElementById('upload-image-btn').textContent = '📷 Görseli Değiştir';
    } else {
      currentImageData = null;
      document.getElementById('image-preview').classList.add('hidden');
    }
  } else {
    currentImageData = null;
    document.getElementById('image-preview').classList.add('hidden');
  }
  
  if (question.type === 'multiple') {
    document.getElementById('option-a').value = question.options[0] || '';
    document.getElementById('option-b').value = question.options[1] || '';
    document.getElementById('option-c').value = question.options[2] || '';
    document.getElementById('option-d').value = question.options[3] || '';
    
    document.querySelector(`input[name="correct"][value="${question.correct_answer}"]`).checked = true;
  } else if (question.type === 'truefalse') {
    currentTrueFalseAnswer = question.correct_answer;
    document.querySelectorAll('.tf-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === currentTrueFalseAnswer);
    });
  } else if (question.type === 'fillblank') {
    const container = document.getElementById('blank-answers');
    container.innerHTML = '';
    
    question.fill_blanks.answers.forEach((answer, index) => {
      const div = document.createElement('div');
      div.className = 'blank-input';
      div.innerHTML = `
        <span>${index + 1}. Boşluk:</span>
        <input type="text" class="blank-answer" value="${answer}" placeholder="Doğru cevap">
      `;
      container.appendChild(div);
    });
    
    const distractorContainer = document.getElementById('distractor-options');
    distractorContainer.innerHTML = '';
    
    const distractors = question.fill_blanks.options.filter(
      opt => !question.fill_blanks.answers.includes(opt)
    );
    
    distractors.forEach((distractor, index) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'distractor';
      input.value = distractor;
      input.placeholder = `Yanlış seçenek ${index + 1}`;
      distractorContainer.appendChild(input);
    });
    
    // Clear matching pairs if editing from different type
    const matchingClear = document.getElementById('matching-pairs');
    if (matchingClear) matchingClear.innerHTML = '';
  } else if (question.type === 'matching') {
    // Load matching pairs data
    const pairsContainer = document.getElementById('matching-pairs');
    pairsContainer.innerHTML = '';
    
    if (question.matching_pairs && Array.isArray(question.matching_pairs)) {
      question.matching_pairs.forEach((pair) => {
        const div = document.createElement('div');
        div.className = 'matching-pair';
        div.innerHTML = `
          <input type="text" class="match-left" value="${pair.left || ''}" placeholder="Sol öğe">
          <span class="match-arrow">↔</span>
          <input type="text" class="match-right" value="${pair.right || ''}" placeholder="Sağ eşi">
          <button type="button" class="btn-remove-pair">✕</button>
        `;
        pairsContainer.appendChild(div);
      });
    }
    
    // Attach event listeners to remove buttons
    document.querySelectorAll('.btn-remove-pair').forEach(btn => {
      btn.addEventListener('click', (e) => e.target.closest('.matching-pair').remove());
    });
  } else {
    // Clear matching pairs if editing from different type
    const matchingClear = document.getElementById('matching-pairs');
    if (matchingClear) matchingClear.innerHTML = '';
  }
  
  // Load application data
  if (question.type === 'application' && question.application) {
    document.getElementById('application-instructions').value = question.application.instructions || '';
    document.getElementById('application-check-text').value = question.application.checkText || '';
    
    // Load application check image
    if (question.application.checkImage) {
      applicationImageData = question.application.checkImage;
      document.getElementById('application-preview-img').src = question.application.checkImage;
      document.getElementById('application-image-preview').classList.remove('hidden');
    } else {
      applicationImageData = null;
      document.getElementById('application-image-preview').classList.add('hidden');
    }
  } else {
    // Clear application fields
    document.getElementById('application-instructions').value = '';
    document.getElementById('application-check-text').value = '';
    applicationImageData = null;
    document.getElementById('application-image-preview').classList.add('hidden');
  }
  
  // Load info section
  if (question.info && question.info.enabled) {
    document.getElementById('info-enabled').checked = true;
    document.getElementById('info-content').classList.remove('hidden');
    document.getElementById('info-title').value = question.info.title || '';
    document.getElementById('info-text').value = question.info.text || '';
    // Load info image
    if (question.info.image) {
      document.getElementById('info-image-url').value = question.info.image;
      document.getElementById('info-preview-img').src = question.info.image;
      document.getElementById('info-image-preview').classList.remove('hidden');
    } else {
      document.getElementById('info-image-url').value = '';
      document.getElementById('info-image-preview').classList.add('hidden');
    }
    // Load AR animation
    if (question.info.ar_animation) {
      document.getElementById('ar-animation-type').value = question.info.ar_animation.type || '';
      if (question.info.ar_animation.type === 'custom') {
        document.getElementById('custom-ar-model').classList.remove('hidden');
        document.getElementById('custom-aframe-code').classList.add('hidden');
        document.getElementById('ar-model-url').value = question.info.ar_animation.model_url || '';
        document.getElementById('ar-model-title').value = question.info.ar_animation.model_title || '';
        document.getElementById('ar-model-description').value = question.info.ar_animation.model_description || '';
      } else if (question.info.ar_animation.type === 'custom-aframe') {
        document.getElementById('custom-ar-model').classList.add('hidden');
        document.getElementById('custom-aframe-code').classList.remove('hidden');
        document.getElementById('ar-aframe-code').value = question.info.ar_animation.aframe_code || '';
      } else {
        document.getElementById('custom-ar-model').classList.add('hidden');
        document.getElementById('custom-aframe-code').classList.add('hidden');
        document.getElementById('ar-model-url').value = '';
        document.getElementById('ar-model-title').value = '';
        document.getElementById('ar-model-description').value = '';
      }
      // Load marker settings
      if (question.info.ar_animation.marker_type === 'custom') {
        document.querySelector('input[name="ar-marker-type"][value="custom"]').checked = true;
        document.getElementById('custom-marker-upload').classList.remove('hidden');
        if (question.info.ar_animation.marker_url) {
          document.getElementById('ar-marker-url').value = question.info.ar_animation.marker_url;
          if (question.info.ar_animation.marker_url.startsWith('data:image')) {
            document.getElementById('ar-marker-preview-img').src = question.info.ar_animation.marker_url;
            document.getElementById('ar-marker-preview').classList.remove('hidden');
          }
        }
      } else {
        document.querySelector('input[name="ar-marker-type"][value="hiro"]').checked = true;
        document.getElementById('custom-marker-upload').classList.add('hidden');
      }
      if (question.info.ar_animation.type) {
        document.getElementById('ar-preview').classList.remove('hidden');
      }
    } else {
      document.getElementById('ar-animation-type').value = '';
      document.getElementById('custom-ar-model').classList.add('hidden');
      document.getElementById('custom-aframe-code').classList.add('hidden');
      document.getElementById('ar-model-url').value = '';
      document.getElementById('ar-aframe-code').value = '';
      document.getElementById('ar-preview').classList.add('hidden');
      document.querySelector('input[name="ar-marker-type"][value="hiro"]').checked = true;
      document.getElementById('custom-marker-upload').classList.add('hidden');
    }
  } else {
    document.getElementById('info-enabled').checked = false;
    document.getElementById('info-content').classList.add('hidden');
    document.getElementById('info-title').value = '';
    document.getElementById('info-text').value = '';
    document.getElementById('info-image-url').value = '';
    document.getElementById('info-image-preview').classList.add('hidden');
    document.getElementById('ar-animation-type').value = '';
    document.getElementById('custom-ar-model').classList.add('hidden');
    document.getElementById('custom-aframe-code').classList.add('hidden');
    document.getElementById('ar-model-url').value = '';
    document.getElementById('ar-aframe-code').value = '';
    document.getElementById('ar-preview').classList.add('hidden');
    document.querySelector('input[name="ar-marker-type"][value="hiro"]').checked = true;
    document.getElementById('custom-marker-upload').classList.add('hidden');
  }
}

// Duel olarak kopyala (4000-4999 arası)
async function copyToDuel(sourceId) {
  try {
    const sourceQuestion = questions.find(q => q.id === sourceId);
    if (!sourceQuestion) return;
    
    // Yeni QR kodu hesapla (4000-4999 arası)
    const sourceQR = parseInt(sourceQuestion.qr_code);
    let newQR = 4000 + (sourceQR % 1000);
    
    // QR'ın zaten kullanılıp kullanılmadığını kontrol et
    while (questions.some(q => q.qr_code === newQR.toString())) {
      newQR++;
      if (newQR > 4999) newQR = 4000;
    }
    
    // Yeni soru oluştur
    const baseType = sourceQuestion.base_type || (sourceQuestion.type === 'duel' || sourceQuestion.type === 'group_duel' || sourceQuestion.type === 'battle'
      ? 'application'
      : sourceQuestion.type);

    const newQuestion = {
      ...sourceQuestion,
      id: undefined, // Yeni ID oluşturulacak
      type: 'duel',
      mode: 'duel',
      base_type: baseType,
      qr_code: newQR.toString(),
      created_at: new Date().toISOString()
    };
    
    const response = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQuestion)
    });
    
    if (response.ok) {
      alert(`Kapışma 2'li olarak kopyalandı! QR: ${newQR}`);
      loadQuestions();
    }
  } catch (error) {
    console.error('Kopyalama hatası:', error);
    alert('Kopyalama başarısız oldu!');
  }
}

// Group Duel olarak kopyala (5000-5999 arası)
async function copyToGroupDuel(sourceId) {
  try {
    const sourceQuestion = questions.find(q => q.id === sourceId);
    if (!sourceQuestion) {
      console.error('Kaynak soru bulunamadı:', sourceId);
      alert('Soru bulunamadı!');
      return;
    }
    
    console.log('Kaynak soru:', sourceQuestion);
    
    // Yeni QR kodu hesapla (5000-5999 arası)
    const sourceQR = parseInt(sourceQuestion.qr_code);
    let newQR = 5000 + (sourceQR % 1000);
    
    console.log('QR hesaplamasi:', sourceQR, '->', newQR);
    
    // QR'ın zaten kullanılıp kullanılmadığını kontrol et
    while (questions.some(q => q.qr_code === newQR.toString())) {
      newQR++;
      if (newQR > 5999) newQR = 5000;
    }
    
    // Yeni soru oluştur
    const baseType = sourceQuestion.base_type || (sourceQuestion.type === 'duel' || sourceQuestion.type === 'group_duel' || sourceQuestion.type === 'battle'
      ? 'application'
      : sourceQuestion.type);

    const newQuestion = {
      ...sourceQuestion,
      id: undefined,
      type: 'group_duel',
      mode: 'group_duel',
      base_type: baseType,
      qr_code: newQR.toString(),
      created_at: new Date().toISOString()
    };
    
    console.log('Yeni soru gönderiliyor:', newQuestion);
    
    const response = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQuestion)
    });
    
    console.log('API yanıtı durumu:', response.status, response.ok);
    
    if (response.ok) {
      const result = await response.json();
      console.log('API başarılı yanıtı:', result);
      alert(`Kapışma Hep Birlikte olarak kopyalandı! QR: ${newQR}`);
      
      // Soruları yenile
      await loadQuestions();
      console.log('Sorular yenilendi');
    } else {
      const errorText = await response.text();
      console.error('API hatası:', response.status, errorText);
      alert(`Kopyalama başarısız oldu! Hata: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('Kopyalama hatası:', error);
    alert('Kopyalama başarısız oldu: ' + error.message);
  }
}

// Delete Question
function deleteQuestion(id) {
  deleteQuestionId = id;
  deleteModal.classList.remove('hidden');
}

// Confirm Delete
async function confirmDelete() {
  if (!deleteQuestionId) return;
  
  try {
    await fetch(`/api/questions/${deleteQuestionId}`, {
      method: 'DELETE'
    });
    
    deleteModal.classList.add('hidden');
    deleteQuestionId = null;
    loadQuestions();
  } catch (error) {
    console.error('Silme hatası:', error);
    alert('Soru silinirken bir hata oluştu');
  }
}

// Cancel Edit
function cancelEdit() {
  resetForm();
  showSection('questions');
  
  document.querySelector('.nav-item[data-section="questions"]').classList.add('active');
  document.querySelector('.nav-item[data-section="add-question"]').classList.remove('active');
}

// Reset Form
function resetForm() {
  editingQuestionId = null;
  questionForm.reset();
  
  document.getElementById('form-title').textContent = 'Yeni Soru Ekle';
  document.getElementById('submit-btn-text').textContent = 'Soru Ekle';
  document.getElementById('cancel-edit').classList.add('hidden');
  
  currentType = 'multiple';
  currentMode = 'normal';
  currentTrueFalseAnswer = 'true';
  currentImageData = null;
  
  // Reset step inputs
  document.getElementById('correct-steps').value = 2;
  document.getElementById('wrong-steps').value = 1;
  
  // Reset image preview
  document.getElementById('image-file').value = '';
  document.getElementById('image-preview').classList.add('hidden');
  document.getElementById('upload-image-btn').innerHTML = '<span>📷</span> Görsel Yükle';
  
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === 'multiple');
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === 'normal');
  });
  updateModeHint();
  
  document.querySelectorAll('.tf-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === 'true');
  });
  
  updateFormForType();
  
  // Reset blank answers
  const blankContainer = document.getElementById('blank-answers');
  blankContainer.innerHTML = `
    <div class="blank-input">
      <span>1. Boşluk:</span>
      <input type="text" class="blank-answer" placeholder="Doğru cevap">
    </div>
  `;
  
  // Reset distractors
  const distractorContainer = document.getElementById('distractor-options');
  distractorContainer.innerHTML = `
    <input type="text" class="distractor" placeholder="Yanlış seçenek 1">
    <input type="text" class="distractor" placeholder="Yanlış seçenek 2">
  `;
  
  // Reset matching pairs
  const matchingPairsContainer = document.getElementById('matching-pairs');
  if (matchingPairsContainer) {
    matchingPairsContainer.innerHTML = '';
    // Add one empty pair as starting point
    const emptyPair = document.createElement('div');
    emptyPair.className = 'matching-pair';
    emptyPair.innerHTML = `
      <input type="text" class="match-left" placeholder="Sol öğe">
      <span class="match-arrow">↔</span>
      <input type="text" class="match-right" placeholder="Sağ eşi">
      <button type="button" class="btn-remove-pair">✕</button>
    `;
    matchingPairsContainer.appendChild(emptyPair);
    
    // Attach event listener
    emptyPair.querySelector('.btn-remove-pair').addEventListener('click', (e) => e.target.closest('.matching-pair').remove());
  }
  
  // Reset info section
  document.getElementById('info-enabled').checked = false;
  document.getElementById('info-content').classList.add('hidden');
  document.getElementById('info-title').value = '';
  document.getElementById('info-text').value = '';
  document.getElementById('info-image-url').value = '';
  document.getElementById('info-image-preview').classList.add('hidden');
  // Reset AR section
  document.getElementById('ar-animation-type').value = '';
  document.getElementById('custom-ar-model').classList.add('hidden');
  document.getElementById('custom-aframe-code').classList.add('hidden');
  document.getElementById('ar-model-url').value = '';
  document.getElementById('ar-aframe-code').value = '';
  document.getElementById('ar-preview').classList.add('hidden');
  // Reset AR marker
  document.querySelector('input[name="ar-marker-type"][value="hiro"]').checked = true;
  document.getElementById('custom-marker-upload').classList.add('hidden');
  document.getElementById('ar-marker-url').value = '';
  document.getElementById('ar-marker-preview').classList.add('hidden');
}

// QR Logo Upload Handler
function handleQRLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // Max 500KB for logo
  if (file.size > 500 * 1024) {
    alert('Logo boyutu 500KB\'dan küçük olmalıdır!');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(event) {
    qrLogoData = event.target.result;
    
    // Show preview
    document.getElementById('qr-logo-img').src = qrLogoData;
    document.getElementById('qr-logo-preview').classList.remove('hidden');
    document.getElementById('remove-qr-logo-btn').classList.remove('hidden');
    
    // Save to localStorage
    saveQRSettings();
  };
  reader.readAsDataURL(file);
}

// Remove QR Logo
function removeQRLogo() {
  qrLogoData = null;
  document.getElementById('qr-logo').value = '';
  document.getElementById('qr-logo-preview').classList.add('hidden');
  document.getElementById('remove-qr-logo-btn').classList.add('hidden');
  
  // Save to localStorage
  saveQRSettings();
}

// Generate QR with custom settings
async function generateCustomQR(text, size = 200) {
  const qrColor = document.getElementById('qr-color').value;
  const qrBgColor = document.getElementById('qr-bg-color').value;
  const logoSizePercent = parseInt(document.getElementById('qr-logo-size')?.value || 25);
  
  return new Promise((resolve, reject) => {
    // Create a temporary div for QRCode
    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);
    
    try {
      // Use QRCode library
      const qr = new QRCode(tempDiv, {
        text: text,
        width: size,
        height: size,
        colorDark: qrColor,
        colorLight: qrBgColor,
        correctLevel: QRCode.CorrectLevel.H // High error correction for logo
      });
      
      // Wait for QR code to be generated
      setTimeout(() => {
        const canvas = tempDiv.querySelector('canvas');
        if (canvas) {
          // Add logo if exists
          if (qrLogoData) {
            const ctx = canvas.getContext('2d');
            const logo = new Image();
            logo.onload = function() {
              // Calculate logo size while maintaining aspect ratio
              const maxLogoSize = size * (logoSizePercent / 100);
              let logoWidth, logoHeight;
              
              if (logo.width > logo.height) {
                logoWidth = maxLogoSize;
                logoHeight = (logo.height / logo.width) * maxLogoSize;
              } else {
                logoHeight = maxLogoSize;
                logoWidth = (logo.width / logo.height) * maxLogoSize;
              }
              
              const x = (size - logoWidth) / 2;
              const y = (size - logoHeight) / 2;
              
              // White background for logo with padding
              const padding = 5;
              ctx.fillStyle = qrBgColor;
              ctx.fillRect(x - padding, y - padding, logoWidth + padding * 2, logoHeight + padding * 2);
              
              // Draw logo maintaining aspect ratio
              ctx.drawImage(logo, x, y, logoWidth, logoHeight);
              
              const dataUrl = canvas.toDataURL('image/png');
              document.body.removeChild(tempDiv);
              resolve(dataUrl);
            };
            logo.onerror = function() {
              const dataUrl = canvas.toDataURL('image/png');
              document.body.removeChild(tempDiv);
              resolve(dataUrl);
            };
            logo.src = qrLogoData;
          } else {
            const dataUrl = canvas.toDataURL('image/png');
            document.body.removeChild(tempDiv);
            resolve(dataUrl);
          }
        } else {
          // Fallback to img element
          const img = tempDiv.querySelector('img');
          if (img) {
            document.body.removeChild(tempDiv);
            resolve(img.src);
          } else {
            document.body.removeChild(tempDiv);
            reject(new Error('QR oluşturulamadı'));
          }
        }
      }, 150);
    } catch (error) {
      document.body.removeChild(tempDiv);
      reject(error);
    }
  });
}

// Load QR Codes
async function loadQRCodes() {
  if (questions.length === 0) {
    await loadQuestions();
  }
  
  if (questions.length === 0) {
    qrList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="qr-code" class="empty-icon-svg"></i>
        <h3>Henüz QR kodu yok</h3>
        <p>Soru ekledikten sonra QR kodları burada görünecek</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }
  
  const size = parseInt(document.getElementById('qr-size').value);
  qrList.innerHTML = '<p style="text-align: center; color: #666;">QR kodları oluşturuluyor...</p>';
  qrCodesCache = {};
  
  let html = '';
  
  for (const question of questions) {
    try {
      const qrDataUrl = await generateCustomQR(question.qr_code, size);
      qrCodesCache[question.qr_code] = qrDataUrl;
      
      html += `
        <div class="qr-item">
          <img src="${qrDataUrl}" alt="QR Code">
          <h4>QR: ${question.qr_code}</h4>
          <p>${question.question_text.substring(0, 50)}...</p>
          <button class="download-btn" onclick="downloadQR('${question.qr_code}')">
            <i data-lucide="download"></i> İndir
          </button>
        </div>
      `;
    } catch (error) {
      html += `
        <div class="qr-item">
          <h4>QR: ${question.qr_code}</h4>
          <p>QR oluşturulamadı</p>
        </div>
      `;
    }
  }
  
  qrList.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Download QR
function downloadQR(code) {
  const dataUrl = qrCodesCache[code];
  if (!dataUrl) {
    alert('QR kodu bulunamadı!');
    return;
  }
  
  const link = document.createElement('a');
  link.download = `qr-${code}.png`;
  link.href = dataUrl;
  link.click();
}

// Download All QR Codes as ZIP
async function downloadAllQRCodes() {
  if (Object.keys(qrCodesCache).length === 0) {
    alert('Önce QR kodlarını oluşturun!');
    return;
  }
  
  const downloadBtn = document.getElementById('download-all-qr-btn');
  const originalText = downloadBtn.innerHTML;
  downloadBtn.innerHTML = '⏳ Hazırlanıyor...';
  downloadBtn.disabled = true;
  
  try {
    const zip = new JSZip();
    
    for (const [code, dataUrl] of Object.entries(qrCodesCache)) {
      // Convert data URL to blob
      const base64 = dataUrl.split(',')[1];
      zip.file(`qr-${code}.png`, base64, { base64: true });
    }
    
    const blob = await zip.generateAsync({ type: 'blob' });
    
    const link = document.createElement('a');
    link.download = 'qr-kodlari.zip';
    link.href = URL.createObjectURL(blob);
    link.click();
    
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('ZIP oluşturma hatası:', error);
    alert('ZIP dosyası oluşturulamadı!');
  } finally {
    downloadBtn.innerHTML = originalText;
    downloadBtn.disabled = false;
  }
}

// Download QR Codes as PDF (A4 - 65mm x 65mm, 12 per page)
async function downloadQRCodesPDF() {
  if (Object.keys(qrCodesCache).length === 0) {
    alert('Önce QR kodlarını oluşturun!');
    return;
  }
  
  const downloadBtn = document.getElementById('download-pdf-btn');
  const originalText = downloadBtn.innerHTML;
  downloadBtn.innerHTML = '⏳ PDF Hazırlanıyor...';
  downloadBtn.disabled = true;
  
  try {
    const { jsPDF } = window.jspdf;
    
    // A4 boyutları (mm)
    const pageWidth = 210;
    const pageHeight = 297;
    
    // QR kod boyutu: 65mm x 65mm
    const qrSize = 65;
    
    // QR kodlar arası boşluk: 1mm
    const gap = 1;
    
    // 3 sütun x 4 satır = 12 QR kod per sayfa
    const cols = 3;
    const rows = 4;
    
    // Toplam içerik boyutu
    const totalWidth = cols * qrSize + (cols - 1) * gap;
    const totalHeight = rows * qrSize + (rows - 1) * gap;
    
    // Ortalamak için marjlar
    const marginLeft = (pageWidth - totalWidth) / 2;
    const marginTop = (pageHeight - totalHeight) / 2;
    
    // PDF oluştur
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const qrCodes = Object.entries(qrCodesCache);
    const totalPages = Math.ceil(qrCodes.length / 12);
    
    for (let i = 0; i < qrCodes.length; i++) {
      const [code, dataUrl] = qrCodes[i];
      
      // Yeni sayfa gerekli mi?
      if (i > 0 && i % 12 === 0) {
        pdf.addPage();
      }
      
      // Sayfa içindeki pozisyon
      const posInPage = i % 12;
      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);
      
      // X ve Y koordinatları (1mm boşluk dahil)
      const x = marginLeft + col * (qrSize + gap);
      const y = marginTop + row * (qrSize + gap);
      
      // Çerçeve çiz (QR kodun tam sınırında)
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);
      pdf.rect(x, y, qrSize, qrSize);
      
      // QR kodu ekle
      pdf.addImage(dataUrl, 'PNG', x, y, qrSize, qrSize);
    }
    
    // PDF'i indir
    pdf.save('qr-kodlari-a4.pdf');
    
  } catch (error) {
    console.error('PDF oluşturma hatası:', error);
    alert('PDF dosyası oluşturulamadı!');
  } finally {
    downloadBtn.innerHTML = originalText;
    downloadBtn.disabled = false;
  }
}

// Image Upload Handler
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // Max 2MB
  if (file.size > 2 * 1024 * 1024) {
    alert('Görsel boyutu 2MB\'dan küçük olmalıdır!');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(event) {
    currentImageData = event.target.result;
    
    // Show preview
    document.getElementById('preview-img').src = currentImageData;
    document.getElementById('image-preview').classList.remove('hidden');
    document.getElementById('upload-image-btn').textContent = '📷 Görseli Değiştir';
  };
  reader.readAsDataURL(file);
}

// Remove Image
function removeImage() {
  currentImageData = null;
  document.getElementById('image-file').value = '';
  document.getElementById('image-preview').classList.add('hidden');
  document.getElementById('upload-image-btn').innerHTML = '<span>📷</span> Görsel Yükle';
}

// Export Data
async function exportData() {
  try {
    const response = await fetch('/api/questions');
    const questions = await response.json();
    
    // Get images from localStorage
    const images = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('quiz_image_')) {
        images[key] = localStorage.getItem(key);
      }
    }
    
    const exportObj = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      questions: questions,
      images: images
    };
    
    const dataStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `quiz-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
    alert('Veriler başarıyla dışa aktarıldı!');
  } catch (error) {
    console.error('Dışa aktarma hatası:', error);
    alert('Dışa aktarma sırasında bir hata oluştu!');
  }
}

// Import Data
async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const statusDiv = document.getElementById('import-status');
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error('Geçersiz dosya formatı');
    }
    
    // Import questions
    let successCount = 0;
    let errorCount = 0;
    
    for (const question of data.questions) {
      try {
        // Check if question already exists
        const existingResponse = await fetch(`/api/questions/qr/${encodeURIComponent(question.qr_code)}`);
        
        if (existingResponse.ok) {
          // Update existing
          await fetch(`/api/questions/${question.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(question)
          });
        } else {
          // Create new
          await fetch('/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(question)
          });
        }
        successCount++;
      } catch (err) {
        errorCount++;
        console.error('Soru içe aktarma hatası:', err);
      }
    }
    
    // Import images to localStorage
    if (data.images) {
      for (const [key, value] of Object.entries(data.images)) {
        localStorage.setItem(key, value);
      }
    }
    
    statusDiv.classList.remove('hidden', 'error');
    statusDiv.classList.add('success');
    statusDiv.textContent = `✓ ${successCount} soru başarıyla içe aktarıldı${errorCount > 0 ? `, ${errorCount} hata` : ''}`;
    
    // Reload questions
    await loadQuestions();
    
  } catch (error) {
    console.error('İçe aktarma hatası:', error);
    statusDiv.classList.remove('hidden', 'success');
    statusDiv.classList.add('error');
    statusDiv.textContent = '✗ Dosya okunamadı veya geçersiz format!';
  }
  
  // Clear file input
  e.target.value = '';
}

// Migrate Images from localStorage to database
async function migrateImages() {
  const statusEl = document.getElementById('migrate-status');
  
  try {
    statusEl.textContent = 'Resimler taşınıyor...';
    statusEl.className = 'import-status';
    statusEl.classList.remove('hidden');
    
    const response = await fetch('/api/questions');
    const allQuestions = await response.json();
    
    let migratedCount = 0;
    let totalWithImages = 0;
    
    for (const question of allQuestions) {
      if (question.image_url && question.image_url.startsWith('quiz_image_')) {
        totalWithImages++;
        const imageData = localStorage.getItem(question.image_url);
        
        if (imageData) {
          // Update question with base64 image
          const updateResponse = await fetch(`/api/questions/${question.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...question,
              image_url: imageData
            })
          });
          
          if (updateResponse.ok) {
            migratedCount++;
          }
        }
      }
    }
    
    if (totalWithImages === 0) {
      statusEl.textContent = 'Taşınacak resim bulunamadı.';
      statusEl.className = 'import-status warning';
    } else if (migratedCount === totalWithImages) {
      statusEl.textContent = `✓ ${migratedCount} resim başarıyla taşındı!`;
      statusEl.className = 'import-status success';
    } else {
      statusEl.textContent = `${migratedCount}/${totalWithImages} resim taşındı. Bazı resimler bulunamadı.`;
      statusEl.className = 'import-status warning';
    }
    
    await loadQuestions();
    
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 5000);
    
  } catch (error) {
    console.error('Migration hatası:', error);
    statusEl.textContent = 'Taşıma sırasında bir hata oluştu!';
    statusEl.className = 'import-status error';
  }
}

// Clear All Data
async function clearAllData() {
  if (!confirm('TÜM SORULAR VE GÖRSELLER SİLİNECEK!\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?')) {
    return;
  }
  
  if (!confirm('EMIN MİSİNİZ?\n\nBu işlem geri alınamaz!')) {
    return;
  }
  
  try {
    // Delete all questions
    const response = await fetch('/api/questions');
    const questions = await response.json();
    
    for (const question of questions) {
      await fetch(`/api/questions/${question.id}`, { method: 'DELETE' });
    }
    
    // Clear images from localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('quiz_image_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    alert('Tüm veriler silindi!');
    await loadQuestions();
    
  } catch (error) {
    console.error('Silme hatası:', error);
    alert('Silme sırasında bir hata oluştu!');
  }
}

// Settings Functions
async function loadSettings() {
  try {
    const response = await fetch('/api/settings');
    const settings = await response.json();
    document.getElementById('total-steps').value = settings.totalSteps || 24;
  } catch (error) {
    console.log('Ayarlar yüklenemedi, varsayılan değerler kullanılıyor');
  }
}

async function saveSettings() {
  const totalStepsEl = document.getElementById('total-steps');
  const totalSteps = parseInt(totalStepsEl.value);
  const statusEl = document.getElementById('settings-status');
  
  if (totalSteps < 5 || totalSteps > 100) {
    statusEl.textContent = 'Adım sayısı 5 ile 100 arasında olmalı!';
    statusEl.className = 'settings-status error';
    statusEl.classList.remove('hidden');
    return;
  }
  
  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalSteps })
    });
    
    if (response.ok) {
      statusEl.textContent = '✓ Ayarlar başarıyla kaydedildi!';
      statusEl.className = 'settings-status success';
      statusEl.classList.remove('hidden');
      
      setTimeout(() => {
        statusEl.classList.add('hidden');
      }, 3000);
    } else {
      throw new Error('Kayıt başarısız');
    }
  } catch (error) {
    console.error('Ayar kaydetme hatası:', error);
    statusEl.textContent = 'Kaydetme sırasında bir hata oluştu!';
    statusEl.className = 'settings-status error';
    statusEl.classList.remove('hidden');
  }
}

// QR Settings - Save to server
async function saveQRSettings() {
  const settings = {
    qrColor: document.getElementById('qr-color').value,
    qrBgColor: document.getElementById('qr-bg-color').value,
    qrLogoSize: document.getElementById('qr-logo-size').value,
    qrSize: document.getElementById('qr-size').value,
    qrLogoData: qrLogoData
  };
  
  // Sunucuya kaydet
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrSettings: settings })
    });
  } catch (e) {
    console.log('QR ayarları sunucuya kaydedilemedi');
  }
}

// QR Settings - Load from server
async function loadQRSettings() {
  try {
    const response = await fetch('/api/settings');
    const serverSettings = await response.json();
    
    if (serverSettings.qrSettings) {
      const settings = serverSettings.qrSettings;
      
      // Apply colors
      if (settings.qrColor) {
        document.getElementById('qr-color').value = settings.qrColor;
      }
      if (settings.qrBgColor) {
        document.getElementById('qr-bg-color').value = settings.qrBgColor;
      }
      if (settings.qrLogoSize) {
        document.getElementById('qr-logo-size').value = settings.qrLogoSize;
      }
      if (settings.qrSize) {
        document.getElementById('qr-size').value = settings.qrSize;
      }
      
      // Apply logo
      if (settings.qrLogoData) {
        qrLogoData = settings.qrLogoData;
        document.getElementById('qr-logo-img').src = qrLogoData;
        document.getElementById('qr-logo-preview').classList.remove('hidden');
        document.getElementById('remove-qr-logo-btn').classList.remove('hidden');
      }
    }
  } catch (e) {
    console.log('QR ayarları yüklenemedi');
  }
  
  // Add change listeners for colors and selects
  document.getElementById('qr-color').addEventListener('change', saveQRSettings);
  document.getElementById('qr-bg-color').addEventListener('change', saveQRSettings);
  document.getElementById('qr-logo-size').addEventListener('change', saveQRSettings);
  document.getElementById('qr-size').addEventListener('change', saveQRSettings);
}

// =========================
// SES YÖNETİMİ FONKSİYONLARI
// =========================

// Ses tiplerinin tanımları
const SOUND_TYPES = {
  background_music: { name: 'Arka Fon Müziği', description: 'Oyun boyunca çalan müzik', icon: '🎵' },
  correct_answer: { name: 'Doğru Cevap', description: 'Doğru cevap verildiğinde', icon: '✅' },
  wrong_answer: { name: 'Yanlış Cevap', description: 'Yanlış cevap verildiğinde', icon: '❌' },
  timer_tick: { name: 'Süre Tik', description: 'Süre sayarken her saniye', icon: '⏱️' },
  timer_warning: { name: 'Süre Uyarısı', description: 'Son 10 saniye uyarısı', icon: '⚠️' },
  timer_end: { name: 'Süre Bitti', description: 'Süre dolduğunda', icon: '⏰' },
  next_player: { name: 'Sıradaki Oyuncu', description: 'Sıra değişiminde', icon: '👤' },
  qr_scan: { name: 'QR Tarama', description: 'QR kod tarandığında', icon: '📱' },
  game_start: { name: 'Oyun Başlangıç', description: 'Oyun başladığında', icon: '🎮' },
  game_end: { name: 'Oyun Bitiş', description: 'Oyun bittiğinde', icon: '🏁' },
  victory: { name: 'Zafer', description: 'Oyuncu kazandığında', icon: '🏆' },
  button_click: { name: 'Buton Tıklama', description: 'Butona tıklandığında', icon: '🔘' },
  question_appear: { name: 'Soru Belirir', description: 'Yeni soru gösterildiğinde', icon: '❓' }
};

// Bildirim göster
function showNotification(message, type = 'info') {
  // Varolan bildirimi kaldır
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Animasyon için küçük gecikme
  setTimeout(() => toast.classList.add('show'), 10);
  
  // 3 saniye sonra kaldır
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Tek bir ses kartını güncelle
async function updateSoundCard(type) {
  try {
    const response = await fetch('/api/sound-settings');
    const soundSettings = await response.json();
    const setting = soundSettings[type] || { enabled: true, customFile: null, volume: 50 };
    const info = SOUND_TYPES[type];
    
    const oldCard = document.getElementById(`sound-card-${type}`);
    if (oldCard) {
      const newCard = createSoundCard(type, info, setting);
      oldCard.replaceWith(newCard);
      setupSingleCardListeners(newCard, type);
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  } catch (error) {
    console.error('Ses kartı güncelleme hatası:', error);
  }
}

// Aktif ses ve buton
let currentAudio = null;
let currentPlayButton = null;

// Ses kartlarını yükle ve oluştur
async function loadSounds() {
  try {
    const response = await fetch('/api/sound-settings');
    const soundSettings = await response.json();
    
    const soundsGrid = document.getElementById('sounds-grid');
    if (!soundsGrid) return;
    
    soundsGrid.innerHTML = '';
    
    for (const [type, info] of Object.entries(SOUND_TYPES)) {
      const setting = soundSettings[type] || { enabled: true, customFile: null, volume: 50 };
      const card = createSoundCard(type, info, setting);
      soundsGrid.appendChild(card);
    }
    
    // Tüm kartlar eklendikten sonra listener'ları kur
    setupSoundCardListeners();
    
    // Lucide iconları oluştur
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } catch (error) {
    console.error('Sesler yüklenirken hata:', error);
  }
}

// Ses kartı oluştur
function createSoundCard(type, info, setting) {
  const card = document.createElement('div');
  card.className = 'sound-card';
  card.id = `sound-card-${type}`;
  card.setAttribute('data-sound-type', type);  // ✅ Socket.IO için ekle
  
  const isCustom = setting.customFile ? true : false;
  const statusClass = isCustom ? 'custom' : 'default';
  const statusText = isCustom ? 'Özel' : 'Varsayılan';
  const isEnabled = setting.enabled !== false;
  const volume = setting.volume || 50;
  
  card.innerHTML = `
    <div class="sound-card-header">
      <div class="sound-title">
        <h4>${info.name}</h4>
        <p>${info.description}</p>
      </div>
      <label class="sound-toggle">
        <input type="checkbox" 
               class="sound-enabled-toggle" 
               data-type="${type}"
               ${isEnabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    
    <div style="margin: 15px 0; text-align: center;">
      <span class="sound-status ${statusClass}">
        <span class="sound-status-dot"></span>
        ${statusText}
      </span>
      ${isCustom ? `<div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">${setting.customFile.split('/').pop()}</div>` : ''}
    </div>
    
    <div class="sound-volume-control">
      <label>
        Ses Seviyesi: <span class="volume-value">${volume}%</span>
      </label>
      <input type="range" 
             class="sound-volume-slider" 
             data-type="${type}"
             min="0" 
             max="100" 
             value="${volume}">
    </div>
    
    <div class="sound-actions">
      <input type="file" 
             class="sound-file-input" 
             id="file-${type}" 
             accept="audio/mp3,audio/wav,audio/ogg"
             data-sound-type="${type}">
      <button class="btn-upload-sound" data-upload-for="${type}">
        <i data-lucide="upload"></i>
        Ses Yükle
      </button>
      <button class="btn-play-sound" data-play-for="${type}">
        <i data-lucide="play"></i>
        Dinle
      </button>
      <button class="btn-reset-sound" 
              data-reset-for="${type}"
              ${!isCustom ? 'disabled' : ''}>
        <i data-lucide="rotate-ccw"></i>
        Sıfırla
      </button>
    </div>
  `;
  
  return card;
}

// Tek bir kartın listener'larını kur
function setupSingleCardListeners(card, type) {
  // Yükleme butonu
  const uploadBtn = card.querySelector('.btn-upload-sound');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      const fileInput = document.getElementById(`file-${type}`);
      if (fileInput) fileInput.click();
    });
  }
  
  // Dosya input
  const fileInput = card.querySelector('.sound-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      console.log('Dosya seçildi:', e.target.files[0]);
      handleSoundUpload(type, fileInput);
    });
  }
  
  // Dinle butonu
  const playBtn = card.querySelector('.btn-play-sound');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      playSound(type, playBtn);
    });
  }
  
  // Sıfırla butonu
  const resetBtn = card.querySelector('.btn-reset-sound');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!resetBtn.disabled) resetSound(type);
    });
  }
  
  // Toggle
  const toggle = card.querySelector('.sound-enabled-toggle');
  if (toggle) {
    toggle.addEventListener('change', async (e) => {
      console.log('Toggle değişti:', type, e.target.checked);
      const enabled = e.target.checked;
      await updateSoundSetting(type, { enabled });
      showNotification(`${SOUND_TYPES[type].name} ${enabled ? 'aktif' : 'pasif'} edildi`, 'success');
    });
  }
  
  // Volume slider
  const volumeSlider = card.querySelector('.sound-volume-slider');
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      const volumeValue = card.querySelector('.volume-value');
      const volume = parseInt(e.target.value);
      volumeValue.textContent = `${volume}%`;
      
      // Eğer ses çalıyorsa anlık olarak volume'u güncelle
      if (currentAudio && currentPlayButton && currentPlayButton.closest(`#sound-card-${type}`)) {
        currentAudio.volume = volume / 100;
        console.log(`${type} ses seviyesi anlık güncellendi:`, volume + '%');
      }
    });
    
    volumeSlider.addEventListener('change', async (e) => {
      const volume = parseInt(e.target.value);
      console.log('Volume değişti:', type, volume);
      await updateSoundSetting(type, { volume });
      showNotification(`${SOUND_TYPES[type].name} ses seviyesi ${volume}% olarak ayarlandı`, 'success');
    });
  }
}

// Tüm ses kartlarının event listener'larını kur
function setupSoundCardListeners() {
  console.log('Ses kartı event listener\'ları kuruluyor...');
  
  document.querySelectorAll('.sound-card').forEach(card => {
    const type = card.id.replace('sound-card-', '');
    setupSingleCardListeners(card, type);
  });
  
  // Lucide iconlarını yeniden oluştur
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Ses dosyası yükleme
async function handleSoundUpload(type, input) {
  const file = input.files[0];
    lucide.createIcons();
  }


// Ses dosyası yükleme
async function handleSoundUpload(type, input) {
  const file = input.files[0];
  console.log('Ses yükleme başladı:', type, file);
  if (!file) return;
  
  // Dosya boyutu kontrolü (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showNotification('Dosya boyutu 5MB\'dan küçük olmalıdır!', 'error');
    input.value = '';
    return;
  }
  
  // Dosya tipi kontrolü
  const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
  if (!validTypes.includes(file.type)) {
    showNotification('Sadece MP3, WAV veya OGG formatları desteklenir!', 'error');
    input.value = '';
    return;
  }
  
  const card = document.getElementById(`sound-card-${type}`);
  card.classList.add('sound-uploading');
  
  try {
    // Dosyayı base64'e çevir
    const base64 = await fileToBase64(file);
    
    // Sunucuya gönder
    const response = await fetch('/api/upload-sound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        soundType: type,
        soundData: base64,
        filename: file.name
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification(`${SOUND_TYPES[type].name} başarıyla yüklendi!`, 'success');
      // Sadece bu kartı güncelle
      updateSoundCard(type);
    } else {
      throw new Error(result.error || 'Yükleme başarısız');
    }
  } catch (error) {
    console.error('Ses yükleme hatası:', error);
    showNotification('Ses yüklenirken hata oluştu!', 'error');
  } finally {
    card.classList.remove('sound-uploading');
    input.value = '';
  }
}

// Dosyayı base64'e çevir
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Ses çal (önizleme)
async function playSound(type, button) {
  const card = document.getElementById(`sound-card-${type}`);
  
  // Aynı butona basıldıysa sesi durdur
  if (currentAudio && currentPlayButton === button) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
    currentPlayButton = null;
    card.classList.remove('sound-playing');
    
    // İkonu play yap
    const icon = button.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', 'play');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }
  
  // Önceki sesi durdur
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
    
    // Önceki butonun ikonunu play yap
    if (currentPlayButton) {
      const oldIcon = currentPlayButton.querySelector('i');
      if (oldIcon) oldIcon.setAttribute('data-lucide', 'play');
    }
  }
  
  // Tüm kartlardan playing sınıfını kaldır
  document.querySelectorAll('.sound-card').forEach(c => c.classList.remove('sound-playing'));
  
  card.classList.add('sound-playing');
  currentPlayButton = button;
  
  // İkonu pause yap
  const icon = button.querySelector('i');
  if (icon) icon.setAttribute('data-lucide', 'pause');
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  try {
    // Ses ayarlarını al
    const response = await fetch('/api/sound-settings');
    const settings = await response.json();
    const soundSetting = settings[type] || { enabled: true, volume: 50 };
    
    let audio;
    
    if (soundSetting && soundSetting.customFile) {
      // Özel ses dosyası varsa onu çal
      audio = new Audio(soundSetting.customFile);
      currentAudio = audio;
    } else {
      // Varsayılan ses (Web Audio API ile oluşturulmuş)
      audio = await generateDefaultSound(type);
    }
    
    if (audio) {
      // Volume ayarını uygula
      const volume = (soundSetting.volume || 50) / 100;
      audio.volume = volume;
      await audio.play();
      
      // Ses bitince animasyonu kaldır
      audio.onended = () => {
        card.classList.remove('sound-playing');
        currentAudio = null;
        currentPlayButton = null;
        
        // İkonu play yap
        if (icon) icon.setAttribute('data-lucide', 'play');
        if (typeof lucide !== 'undefined') lucide.createIcons();
      };
    }
  } catch (error) {
    console.error('Ses çalma hatası:', error);
    showNotification('Ses çalınamadı!', 'error');
    card.classList.remove('sound-playing');
    currentAudio = null;
    currentPlayButton = null;
    
    // İkonu play yap
    if (icon) icon.setAttribute('data-lucide', 'play');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// Varsayılan ses oluştur (basit tonlar)
async function generateDefaultSound(type) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Ses tipine göre farklı tonlar
  const soundConfigs = {
    correct_answer: { freq: 523.25, duration: 0.3 },
    wrong_answer: { freq: 196.00, duration: 0.4 },
    timer_tick: { freq: 440.00, duration: 0.1 },
    timer_warning: { freq: 587.33, duration: 0.2 },
    timer_end: { freq: 261.63, duration: 0.5 },
    next_player: { freq: 659.25, duration: 0.3 },
    qr_scan: { freq: 880.00, duration: 0.2 },
    game_start: { freq: 523.25, duration: 0.4 },
    game_end: { freq: 392.00, duration: 0.5 },
    victory: { freq: 783.99, duration: 0.6 },
    button_click: { freq: 440.00, duration: 0.1 },
    question_appear: { freq: 523.25, duration: 0.2 }
  };
  
  const config = soundConfigs[type] || { freq: 440, duration: 0.3 };
  
  oscillator.frequency.value = config.freq;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + config.duration);
  
  // Audio nesnesi döndür (uyumluluk için)
  return new Promise((resolve) => {
    const audio = { play: () => Promise.resolve(), onended: null };
    setTimeout(() => {
      if (audio.onended) audio.onended();
      resolve(audio);
    }, config.duration * 1000);
    resolve(audio);
  });
}

// Sesi sıfırla (özel dosyayı kaldır)
async function resetSound(type) {
  if (!confirm(`${SOUND_TYPES[type].name} sesini varsayılana döndürmek istediğinize emin misiniz?`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/reset-sound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soundType: type })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification(`${SOUND_TYPES[type].name} varsayılana döndürüldü!`, 'success');
      updateSoundCard(type); // Sadece bu kartı güncelle
    } else {
      throw new Error(result.error || 'Sıfırlama başarısız');
    }
  } catch (error) {
    console.error('Ses sıfırlama hatası:', error);
    showNotification('Ses sıfırlanırken hata oluştu!', 'error');
  }
}

// Ses ayarını güncelle (enabled, volume vb.)
async function updateSoundSetting(type, updates) {
  try {
    const response = await fetch('/api/update-sound-setting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soundType: type, ...updates })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Güncelleme başarısız');
    }
  } catch (error) {
    console.error('Ses ayarı güncelleme hatası:', error);
    showNotification('Ayar güncellenirken hata oluştu!', 'error');
  }
}

// Sayfa yüklendiğinde sesleri yükle
document.addEventListener('DOMContentLoaded', () => {
  // Ses sekmesi açıldığında sesleri yükle
  const soundsNavItem = document.querySelector('[data-section="sounds"]');
  if (soundsNavItem) {
    soundsNavItem.addEventListener('click', () => {
      loadSounds();
    });
  }
  
  // Tüm butonlara click ses efekti ekle (admin paneli için)
  document.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (button && !button.disabled) {
      // Ses yönetimi play butonları için ses çalma (sonsuz döngü önleme)
      if (!button.classList.contains('btn-play-sound')) {
        // Admin panelinde ses efektleri için basit bir ses çalabiliriz
        // veya soundManager varsa kullanabiliriz
        try {
          // Kısa bir click sesi
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
          // Ses çalma hatası, sessizce devam et
        }
      }
    }
  });
});

// Handle Password Change
async function handlePasswordChange(e) {
  e.preventDefault();
  
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const errorDiv = document.getElementById('password-error');
  const successDiv = document.getElementById('password-success');
  const submitBtn = document.getElementById('change-password-btn');
  
  // Clear messages
  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';
  
  // Validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    errorDiv.textContent = '❌ Tüm alanlar gereklidir';
    errorDiv.style.display = 'block';
    return;
  }
  
  if (newPassword.length < 6) {
    errorDiv.textContent = '❌ Yeni şifre en az 6 karakter olmalıdır';
    errorDiv.style.display = 'block';
    return;
  }
  
  if (newPassword !== confirmPassword) {
    errorDiv.textContent = '❌ Yeni şifreler uyuşmuyor';
    errorDiv.style.display = 'block';
    return;
  }
  
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Gönderiliyor...';
    
    const response = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      successDiv.textContent = '✅ Şifre başarıyla değiştirildi! Yeni şifrenizle giriş yapabilirsiniz.';
      successDiv.style.display = 'block';
      
      // Clear form
      document.getElementById('password-form').reset();
      
      // Save the new password if remember was checked in login
      if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem(PASSWORD_KEY, newPassword);
      }
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        handleLogout();
      }, 2000);
    } else {
      errorDiv.textContent = `❌ ${data.error || 'Şifre değiştirme başarısız'}`;
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    console.error('Şifre değiştirme hatası:', error);
    errorDiv.textContent = '❌ Sunucu hatası: ' + error.message;
    errorDiv.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Şifre Değiştir';
  }
}

// ✅ Socket.IO - Oyun ekranından ses değişikliğini dinle
if (typeof socket !== 'undefined') {
  socket.on('sound-setting-updated', (data) => {
    const { soundType, volume } = data;
    console.log(`🔊 Socket.IO: Oyun ekranından ses değişikliği alındı: ${soundType} = ${volume}%`);
    
    // Ses kartını bul ve güncelle
    const soundCard = document.querySelector(`[data-sound-type="${soundType}"]`);
    if (soundCard) {
      const slider = soundCard.querySelector('input[type="range"]');
      const volumeDisplay = soundCard.querySelector('.volume-value');
      
      if (slider) {
        slider.value = volume;
        console.log(`✅ Slider güncellendi: ${soundType}`);
      }
      if (volumeDisplay) {
        volumeDisplay.textContent = `${volume}%`;
        console.log(`✅ Yüzde güncellendi: ${volume}%`);
      }
    }
  });
}
