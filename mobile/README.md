# Gather Mobile (Expo React Native)

A native mobile client for **Gather** — the offline-resilient event media capture, live camera wall streaming, and curated gallery platform.

---

## 1. Architecture & Platform Role

The mobile app provides a dedicated native smartphone experience for event attendees (and companion host monitoring), eliminating browser-specific limitations such as:
- **Zero Viewport Rubber-Banding:** Native full-screen immersive camera experience without address bar jumping or iOS Safari bottom sheet scrolling.
- **Background Upload Queue:** Photos and videos are saved to native sandbox storage (`expo-file-system`) first and uploaded asynchronously in the background. The shutter is never blocked.
- **Hardware-Accelerated Camera & Live Previews:** Native camera hardware controls via `expo-camera` (torch, lens flipping, haptics) with low-latency binary WebSocket streaming to the host live wall.
- **Offline Mesh Resilience:** Retains captured media across device reboots and spotty event Wi-Fi/cellular networks.

---

## 2. Screen & Route Mapping

| Web Route | Mobile Screen | Status | Description |
| :--- | :--- | :--- | :--- |
| `/e/:slug` | `JoinScreen` | ✅ Implemented | Guest joins event by entering event code (or scanning host QR), name, phone, and password. Supports LAN IP config. |
| `/e/:slug/login` | `LoginScreen` | ✅ Implemented | Returning guest login with phone and password. |
| `/waiting` | `WaitingScreen` | ✅ Implemented | Pending approval screen with automated 5s status polling. |
| `/cam` | `CameraScreen` | ✅ Implemented | Full-screen native camera, flip camera, torch/flash, haptic shutter, background upload queue pill, and live preview stream status. |
| `/album` | `GalleryScreen` | ✅ Implemented | 3-tab feed: "Shared with Me", "My Shots", and "Queue". Pull-to-refresh, thumbnail loading, and camera roll saving. |
| `/me` | `ProfileScreen` | ✅ Implemented | Account profile, password change, host server address configuration, and secure sign out. |
| `/host/*` | *Host Companion (Roadmap)* | 📋 Planned | Mobile companion for host live camera monitoring and quick QR code presentation. |

---

## 3. Native Hardware & Mobile Needs

### Camera Engine & Viewfinder
- **Package:** `expo-camera` (`CameraView`)
- **Capabilities:**
  - Zero-latency shutter capture (`takePictureAsync({ quality: 0.85 })`)
  - Front / Rear camera switching (`facing: 'back' | 'front'`)
  - Torch / Flash toggle (`enableTorch`)
  - Haptic shutter feedback (`expo-haptics`)
  - Prevent screen timeout during shooting (`expo-keep-awake`)

### File Storage & Offline Persistence
- **Package:** `expo-file-system` & `@react-native-async-storage/async-storage`
- **Capabilities:**
  - Original media stored in persistent sandbox directory: `FileSystem.documentDirectory + 'gather_media/'`
  - Upload queue state stored in AsyncStorage so pending items survive app restarts
  - Non-blocking queue worker (`uploadQueue`) uploading via multipart HTTP `/api/upload/photo`

### Live Stream WebSocket Pipeline
- **Service:** `LivePreviewStreamer`
- **Capabilities:**
  - Auto-reconnecting WebSocket connection to Host WebSocket endpoint (`/ws`)
  - Binary/ArrayBuffer frame dispatching to Fastify backend and Host 60fps live canvas wall
  - Dynamic boost reception: automatically scales frame rate when host focuses a guest tile

### Permissions
- **iOS (`Info.plist`):**
  - `NSCameraUsageDescription`: Camera access for capturing event memories.
  - `NSMicrophoneUsageDescription`: Audio recording for video clips.
  - `NSPhotoLibraryUsageDescription`: Camera roll access for saving shared event media.
- **Android (`AndroidManifest.xml`):**
  - `CAMERA`, `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`

---

## 4. Running the Mobile App

### Prerequisites
- Node.js 22+
- Expo Go installed on your physical iOS or Android device (or an emulator/simulator)

### Starting the Dev Server
```bash
cd mobile
npm start
```

### Connecting to the Local Gather Server
1. Ensure the Gather backend server is running (`./run.sh` or `cd server && npm run dev`).
2. Make sure your phone is connected to the same Wi-Fi or mobile hotspot as your computer.
3. In the mobile app's **Join** screen or **Me** tab, set the Server URL to your computer's LAN IP:
   ```
   http://<YOUR_LAN_IP>:8080
   ```
   *(e.g., `http://192.168.1.9:8080`)*
