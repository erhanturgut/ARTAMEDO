# ARTAMEDO

ARTAMEDO, sınıf ve grup etkinlikleri için tasarlanmış, artırılmış gerçeklik (AR) destekli bir eğitim oyunu platformudur.

Sistem; 
- **oyuncu oyun ekranı** (QR tabanlı soru akışı),
- **yönetici paneli** (soru ve içerik yönetimi),
- **AR içerikler** (özel marker + 3D model desteği)
- ve **Socket.IO ile gerçek zamanlı güncellemeleri** bir araya getirir.

## Temel Özellikler

- 1–6 oyuncu ile oyun kurma ve rastgele sıra belirleme
- QR kod ile soru çağırma ve oyun akışı yönetimi
- Farklı oyun modları ve soru tipleri:
  - Normal
  - Kapışma (2'li)
  - Hep Birlikte Kapışma
  - Çoktan Seçmeli
  - Doğru/Yanlış
  - Boşluk Doldurma
  - Eşleştirme
  - Sürükle Bırak
  - Uygulama
- Soru bazlı adım puanlama:
  - `correct_steps`
  - `wrong_steps`
- Soru bazlı opsiyonel süre limiti (`time_limit`)
- Admin girişi ve şifre değiştirme
- QR kod üretim endpoint’i
- AR marker pattern yükleme (`.patt`)
- 3D model yükleme (`.glb/.gltf`)
- Dinamik AR sayfası (`/ar-custom`) ve model kontrol paneli
- Ses yönetimi:
  - özel ses yükleme
  - varsayılana sıfırlama
  - ses bazlı aktiflik/seviye ayarı
- JSON tabanlı kalıcılık (`database.json`)

## Teknoloji Yığını

- Node.js
- Express
- Socket.IO
- UUID
- QRCode
- A-Frame + AR.js (AR görselleştirme)
- Vanilla HTML/CSS/JavaScript frontend

## Proje Yapısı

- `server.js` — API sunucusu, statik dosya sunumu, Socket.IO, dinamik AR sayfası
- `database.json` — yerel JSON veritabanı (sorular, oyunlar, ayarlar, admin, ses)
- `public/index.html` — oyuncu oyun arayüzü
- `public/admin.html` + `public/admin.js` — yönetici paneli
- `public/patterns/` — yüklenen marker pattern dosyaları
- `public/models/` — yüklenen 3D modeller
- `public/sounds/default/` ve `public/sounds/custom/` — ses dosyaları

## Gereksinimler

- Node.js 18+ (önerilir)
- npm

## Kurulum

```bash
npm install
```

## Çalıştırma

### Production

```bash
npm start
```

### Development

```bash
npm run dev
```

Varsayılan sunucu davranışı:
- HTTP: `3000`
- HTTPS: `3443` (yalnızca aşağıdaki sertifika dosyaları varsa)
  - `cert/cloudflare-origin-cert.pem`
  - `cert/cloudflare-origin-key.pem`

## Ortam Değişkenleri

- `ADMIN_PASSWORD` (opsiyonel)
  - Varsayılan fallback değer: `1234`
  - İlk kurulum/şifre değişiminden sonra admin şifresi `database.json` içinde de tutulur.

## Erişim URL’leri

- Oyun: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin`

HTTPS sertifikaları varsa:
- Oyun: `https://localhost:3443/`
- Admin: `https://localhost:3443/admin`

## Ana API Endpoint’leri

### Admin
- `POST /api/admin/login`
- `POST /api/admin/change-password`

### Sorular
- `GET /api/questions`
- `GET /api/questions/:id`
- `GET /api/questions/qr/:qrCode`
- `POST /api/questions`
- `PUT /api/questions/:id`
- `DELETE /api/questions/:id`

### Ayarlar
- `GET /api/settings`
- `PUT /api/settings`

### QR
- `GET /api/qr/:code`

### Oyun Oturumları
- `POST /api/games`
- `GET /api/games/:id`
- `PUT /api/games/:id`

### AR / Medya
- `POST /api/upload-pattern`
- `POST /api/upload-model`
- `GET /ar-custom`

### Ses
- `GET /api/sound-settings`
- `POST /api/sound-settings`
- `POST /api/update-sound-setting`
- `POST /api/upload-sound`
- `POST /api/reset-sound`
- `GET /api/sounds`

## Socket.IO Olayları

İstemciden gönderilen:
- `join-game`
- `answer-submitted`
- `next-player`
- `game-ended`

Sunucudan yayımlanan:
- `update-scores`
- `player-changed`
- `show-results`
- `sound-setting-updated`

## Veri Kalıcılığı

Çalışma verileri `database.json` içinde tutulur:
- sorular
- oyunlar
- ayarlar
- admin bilgileri
- ses ayarları

Bu yaklaşım yerel/küçük ölçekli kurulumlar için uygundur. Daha büyük ölçek için bir veritabanı servisine geçiş önerilir.

## Güvenlik Notları

- Varsayılan admin şifresini (`1234`) mutlaka değiştirin.
- Paylaşımlı ağlarda admin panel erişimini sınırlandırın.
- Mobil tarayıcılarda kamera erişimi için HTTPS önerilir.

## Lisans

Bu proje MIT Lisansı ile lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.
