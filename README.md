# ARTAMEDO

ARTAMEDO is an augmented reality (AR) supported educational game platform designed for classroom and group activities.

It combines:
- a **player game screen** (QR-driven question flow),
- an **admin panel** (question and content management),
- **AR content** (custom marker + 3D model support),
- and **real-time updates** via Socket.IO.

## Key Features

- 1–6 player game setup with randomized turn order
- QR-based question lookup and flow control
- Multiple question modes and types:
  - Normal
  - Duel (2 players)
  - Group Duel (all players)
  - Multiple Choice
  - True/False
  - Fill in the Blank
  - Matching
  - Drag & Drop
  - Application tasks
- Per-question step scoring:
  - `correct_steps`
  - `wrong_steps`
- Optional timer per question (`time_limit`)
- Admin login and password change
- QR code generation endpoint
- AR marker pattern upload (`.patt`)
- 3D model upload (`.glb/.gltf`)
- Dynamic AR page (`/ar-custom`) with model controls
- Sound management:
  - custom sound upload
  - reset to default sounds
  - per-sound enable/volume settings
- Import/export-ready JSON persistence (`database.json`)

## Tech Stack

- Node.js
- Express
- Socket.IO
- UUID
- QRCode
- A-Frame + AR.js (frontend AR rendering)
- Vanilla HTML/CSS/JavaScript frontend

## Project Structure

- `server.js` — API server, static hosting, Socket.IO, AR dynamic page
- `database.json` — local JSON database (questions, games, settings, admin, sounds)
- `public/index.html` — player game UI
- `public/admin.html` + `public/admin.js` — admin panel UI/logic
- `public/patterns/` — uploaded marker pattern files
- `public/models/` — uploaded 3D models
- `public/sounds/default/` and `public/sounds/custom/` — sound assets

## Requirements

- Node.js 18+ (recommended)
- npm

## Installation

```bash
npm install
```

## Run

### Production

```bash
npm start
```

### Development

```bash
npm run dev
```

Default server behavior:
- HTTP starts on `3000`
- HTTPS starts on `3443` **if** cert files exist:
  - `cert/cloudflare-origin-cert.pem`
  - `cert/cloudflare-origin-key.pem`

## Environment Variables

- `ADMIN_PASSWORD` (optional)
  - Fallback default is `1234`
  - Admin password is also persisted in `database.json` after initialization/change.

## URLs

- Game: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin`

If HTTPS certificates are configured:
- Game: `https://localhost:3443/`
- Admin: `https://localhost:3443/admin`

## Main API Endpoints

### Admin
- `POST /api/admin/login`
- `POST /api/admin/change-password`

### Questions
- `GET /api/questions`
- `GET /api/questions/:id`
- `GET /api/questions/qr/:qrCode`
- `POST /api/questions`
- `PUT /api/questions/:id`
- `DELETE /api/questions/:id`

### Settings
- `GET /api/settings`
- `PUT /api/settings`

### QR
- `GET /api/qr/:code`

### Game Sessions
- `POST /api/games`
- `GET /api/games/:id`
- `PUT /api/games/:id`

### AR / Media
- `POST /api/upload-pattern`
- `POST /api/upload-model`
- `GET /ar-custom`

### Sounds
- `GET /api/sound-settings`
- `POST /api/sound-settings`
- `POST /api/update-sound-setting`
- `POST /api/upload-sound`
- `POST /api/reset-sound`
- `GET /api/sounds`

## Socket.IO Events

Client emits:
- `join-game`
- `answer-submitted`
- `next-player`
- `game-ended`

Server emits:
- `update-scores`
- `player-changed`
- `show-results`
- `sound-setting-updated`

## Data Persistence

All runtime data is stored in `database.json`:
- questions
- games
- settings
- admin credentials
- sound settings

This setup is practical for local/small deployments. For production-grade scale, migrate to a database service.

## Security Notes

- Change the default admin password (`1234`) immediately.
- Restrict admin panel/network access in shared environments.
- If using camera on mobile browsers, HTTPS is strongly recommended.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
