# Gather 📸

**Decentralized event media capture & live streaming — built for crowds, no installs required.**

Gather is a platform for collecting event photography and live multi-camera streams in real time. Guests join with a QR code and start shooting instantly from their browser; hosts watch every camera live and curate the gallery as the event unfolds.

---

## ✨ Features

| Feature | Description |
| --- | --- |
| 📷 **Zero-install capture** | Guests scan an event QR code, register with a name, and immediately access the camera and shared gallery — no app store, no download. |
| ⚡ **Background upload pipeline** | Shots save locally the instant the shutter fires, get compressed on-device, and upload asynchronously without interrupting shooting. |
| 🖥️ **Live camera wall** | Host-side real-time multi-camera grid rendered on a hardware-accelerated HTML5 Canvas with sub-8ms frame scaling. |
| 🕸️ **Offline mesh networking** | WebRTC peer discovery with automatic signaling fallback so venues with broken or missing Wi-Fi still sync media over local hotspots. |
| 📱 **Companion mobile app** | React Native (Expo) client with QR scanning, one-tap join, and automatic session recovery. |

---

## 🧩 Project Layout

```
Gather
├── server/        # Fastify backend (Node 22 + TypeScript)
│   └── src/       # Drizzle ORM schema, REST routes, WebSocket signaling
│
├── web/           # Vite + React 18 + Tailwind web client
│   └── src/       # Host console, guest camera, gallery, P2P mesh lib
│
└── mobile/        # Expo (React Native) companion app
    └── src/       # Scan / Camera / Gallery screens, upload queue service
```

---

## 🚦 Getting Started

### Requirements

- Node.js 20+ (22 recommended)
- Docker (local PostgreSQL)
- Optional: Tailscale for remote HTTPS funneling

### One-Command Launch

Run the all-in-one script — it boots PostgreSQL, builds the backend, starts Vite over HTTPS, and auto-detects your LAN / hotspot IP:

```bash
./run.sh
```

URLs printed by the runner:

- **Host dashboard** → `https://localhost:5173/dash`
- **Guest camera (LAN)** → `https://<YOUR_LAN_IP>:5173/cam`

### Manual Setup

**Backend:**

```bash
cd server
npm install
npm run db:push
npm run dev
```

**Web client:**

```bash
cd web
npm install
npm run dev
```

**Mobile app:**

```bash
cd mobile
bun install   # or npm install
npm start
```

---

## 🔐 Security Model

- Host routes are gated by a cryptographically signed session cookie.
- Every media request (HTTP **and** WebSocket) is authorized per-event at the database layer.
- Local HTTPS via `@vitejs/plugin-basic-ssl` keeps `getUserMedia` camera access valid on LAN subnets.

---

## 📄 License

Released under the MIT License.