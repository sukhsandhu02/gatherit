# Gather — Implementation, Verification & P2P Offline Mesh Plan

## Ground Rules & Security Invariants
1. **Never ship without host password protection:** All `/host/*` frontend routes and `/api/host/*` endpoints require the authenticated host password cookie. Login is rate-limited (5 attempts/min per IP).
2. **Never trust tokens blindly:** Pass middleware (`requirePass`) reads the pass row directly from Postgres on **every request** (not just the JWT) so revokes take effect instantly.
3. **Per-request share checks on media:** Every media view and download evaluates visibility (`all`, `host`, direct pass shares, or target group membership) on every request. Downloads strictly enforce `canDownload`.
4. **Real device verification:** Test steps against the public URL / mobile network.
5. **Commit after each step.**

---

## Progress Checklist

- [x] **Step 0: Funnel Check & Environment Configuration**
  - Database container running (`pg-db`, Postgres 18)
  - `keepsake` database created and validated
  - Local & Tailnet address verified (`omarchy.tailedcbcc.ts.net`, LAN IP `192.168.1.9`)
  - Note on Funnel HTTPS certs: tailnet admin enable link noted if testing over Tailscale Funnel.

- [ ] **Step 1: Skeleton, Database and Dev Loop**
  - Server: Fastify 5 + TypeScript + tsx + Drizzle ORM + pg (`0.0.0.0:8080`)
  - Endpoints: `GET /api/health` (`SELECT 1`), `GET /ws` (WebSocket echo), SPA static serve
  - Drizzle schema: `event`, `passes`, `groups`, `groupMembers`, `media`, `shares`, `rules`
  - Push schema with `drizzle-kit push`
  - Web: Vite + React + Tailwind + QR code + Lucide icons + Proxy `/api` and `/ws`
  - *Done when:* Server boots, `/api/health` reports DB ok, WS echo round-trips.

- [ ] **Step 2: H1 Host Create Event (`/host/setup` & `/host/login`)**
  - Form: event name, date, host password
  - Hashing with `crypto.scrypt`
  - Rate-limited login with `@fastify/rate-limit` (5/min) and `@fastify/cookie` + `@fastify/jwt`
  - Auth preHandler `requireHost` for all `/api/host/*`
  - *Done when:* Wrong password rejected, correct password redirects to `/host`, unauthenticated access blocked.

- [ ] **Step 3: H3 Passes Manager (`/host/passes`)**
  - Table: name, role, device, download toggle, status, actions
  - Drawer: Create pass (`crypto.randomBytes(24)`, SHA-256 hash stored), group assignments
  - QR modal (`qrcode.react`), copy link, WhatsApp share link
  - Revoke pass action
  - *Done when:* Create pass, QR generated, token link valid.

- [ ] **Step 4: G0 Landing and G1 Pass Join (`/`, `/p/:token`)**
  - G0 `/`: Invite-only landing screen
  - G1 `/p/:token`: `POST /api/join { token, deviceId }`
  - Device binding to localStorage deviceId (rejects second device)
  - Revoked check & unknown token handling
  - Guest cookie issuance & role routing (`/cam`, `/album`)
  - *Done when:* Device binding verified, revoked passes blocked, role buttons route properly.

- [ ] **Step 5: G2 Camera (`/cam`)**
  - Camera preview via `getUserMedia` (facingMode: environment) + flip button + Wake Lock
  - Photo capture (canvas max 2048px, JPEG q0.85) + IndexedDB offline upload queue (`idb-keyval`)
  - Video recording (`MediaRecorder`, chunked upload with sequential confirmation)
  - Live low-res WS preview streaming (160px canvas 1 fps)
  - Server `@fastify/multipart` streaming directly to `data/media/<passId>/` + `sharp` 400px thumbnail
  - *Done when:* Photos and chunked videos successfully upload and thumbnails generate.

- [ ] **Step 6: H4 Live Grid (`/host/live`)**
  - WebSocket host bridge forwarding binary guest preview frames (prefixed by 16-byte pass UUID)
  - Host responsive CSS grid of live camera tiles with connection status & reconnecting badges
  - Click-to-focus boost / unboost control message
  - *Done when:* Live tiles update smoothly, boost triggers higher frame rate.

- [ ] **Step 7: H5 Gallery and Sharing (`/host/gallery`)**
  - Paginated media grid with thumbnails, kind filter, visibility badges
  - Multi-select sticky action bar
  - Share drawer: Everyone, Groups, Individual passes
  - Auto-rules execution on new media upload
  - WebSocket `new_media` broadcast
  - *Done when:* Selection shared to group updates permissions in DB.

- [ ] **Step 8: G3 Album and Viewer (`/album`, `/album/:id`)**
  - Media feed: `visibility = 'all'`, explicit shares, group shares, and own shots
  - Tabs: "Shared with me" vs "My shots", full-screen swipe viewer
  - Streaming zip download (`GET /api/zip`) with `archiver` respecting `canDownload`
  - Instant live revoke WebSocket event
  - *Done when:* Guest accesses allowed media, forbidden media returns 403, revoking immediately kicks.

- [ ] **Step 9: H2 Overview (`/host`)**
  - Live metric cards: guests online, photo count, video count, disk storage & free space (`statfs`), Funnel/Health check
  - Activity feed
  - *Done when:* Live metrics update as uploads and joins happen.

- [ ] **Step 10: Rehearsal & Production Polish**
  - Vite production build served through Fastify static
  - End-to-end smoke test through mobile network / public tunnel
# Gather: Offline-First Peer-to-Peer (P2P) Local Mesh Architecture Plan

## Executive Summary
This architectural plan outlines how **Gather** will operate completely offline without internet connectivity, allowing all smartphones at an event or venue to discover each other, form a local peer-to-peer mesh, synchronize media, stream live camera feeds, and replicate curated galleries locally.

---

## 1. Network & Transport Topology (Zero-Internet Connectivity)

When mobile internet or broadband is completely unavailable (e.g., remote weddings, outdoor festivals, underground venues, or emergency zones), Gather operates over two primary offline topologies:

```
                  ┌──────────────────────────────────────────────┐
                  │            OFFLINE EVENT VENUE               │
                  └──────────────────────────────────────────────┘

  Topology A: Local Wi-Fi / Hotspot Router (No WAN)
  ┌────────────────────────────────────────────────────────────────────────┐
  │  Portable Hotspot / Host Phone Wi-Fi Tether (No SIM/Cellular required)  │
  │  ┌──────────────┐       mDNS / UDP Broadcast      ┌──────────────┐     │
  │  │ Phone A      │ ◄─────────────────────────────► │ Phone B      │     │
  │  │ (Guest)      │ ◄─── WebRTC Mesh DataChannel ──►│ (Host/Guest) │     │
  │  └──────────────┘                                 └──────────────┘     │
  │          ▲                                               ▲             │
  │          │                                               │             │
  │          └────────────────► Phone C ◄────────────────────┘             │
  │                             (Guest)                                    │
  └────────────────────────────────────────────────────────────────────────┘

  Topology B: Direct Device-to-Device (Wi-Fi Direct / BLE / WebRTC P2P)
  ┌────────────────────────────────────────────────────────────────────────┐
  │  Phone A ◄── BLE / Multicast DNS Signaling ──► Phone B (Host Node)     │
  │  Phone A ◄── Direct WebRTC DataChannels ──────► Phone C (Guest Relay)   │
  └────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Physical Layer Options
1. **Host-as-Access-Point (Zero Hardware Required)**:
   - The Host turns on their phone's Wi-Fi hotspot (no mobile data required).
   - Guests connect to the Gather Wi-Fi SSID via a standard QR code (Wi-Fi QR standard `WIFI:S:Gather-Event;T:WPA;P:...;;`).
   - The host phone runs the lightweight Gather local server/broker (or P2P coordinator) via PWA Service Worker / Node / Native wrapper, serving the web app directly off LAN (e.g. `http://gather.local` or host LAN IP `192.168.43.1`).
2. **Dedicated Local Travel Router / Pocket AP**:
   - A $20 battery-powered portable router (GL.iNet, TP-Link) running a static local captive portal.
3. **Pure P2P Direct Mesh (App / Native Hybrid)**:
   - Using Wi-Fi Direct / Multicast DNS / BLE discovery for fully decentralized ad-hoc peer mesh when no shared AP exists.

---

## 2. Peer Discovery & Connection Handshake

In browser environments (PWA) and mobile browsers, WebRTC requires signaling to exchange SDP offers/answers and ICE candidates. Offline signaling will be accomplished via:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      OFFLINE SIGNALING MECHANISMS                      │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Local Network Beacon (mDNS / UDP Broadcast / LAN HTTP Broker):     │
│    When devices share a Wi-Fi or tether hotspot, the host or first node│
│    acts as the LAN signaling coordinator at `http://<lan-ip>:8080/ws`. │
│                                                                        │
│ 2. Visual Air-Gapped Pairing (Animated QR Codes):                      │
│    For completely isolated phones without LAN broadcast, WebRTC SDP     │
│    offers and answers are encoded into 2D / animated QR codes scanned  │
│    between phones to establish direct WebRTC DataChannel connections.  │
│                                                                        │
│ 3. P2P Gossip Relay (Epidemic Routing):                                │
│    Once 2+ phones are connected, new peer connection parameters are    │
│    forwarded through existing peers via WebRTC DataChannels.           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Distributed Data Replication & Offline Storage

### 3.1 Client-Side Offline Storage (IndexedDB + OPFS)
- **Origin Private File System (OPFS)**: Stores original raw high-res images and chunked video files directly on each device's sandboxed filesystem without exhausting RAM.
- **IndexedDB (`idb-keyval` / Dexie)**: Stores metadata documents, event permissions, guest profiles, and sync vectors.

### 3.2 Conflict-Free Replicated Data Types (CRDT)
- **State CRDTs (Automerge or Yjs)**:
  - Event metadata, folder hierarchy, share rules, and reaction/favorite states are stored as CRDT documents.
  - When Phone A and Phone B connect, they exchange state vectors and automatically merge additions without central database locks or split-brain conflicts.
  - Cryptographic signatures (`ed25519` keypair per guest generated on first join) verify ownership of photos and permissions offline.

---

## 4. P2P Media Sync Protocol (BitTorrent-style Chunked Swarming)

To prevent mobile phone bandwidth choke when hundreds of photos are taken:

1. **Content-Addressable Media (SHA-256 Hash IDs)**:
   - Every photo and video chunk is identified by its cryptographic SHA-256 hash `hash = sha256(mediaBytes)`.
2. **Swarm Transfer via WebRTC DataChannels**:
   - If Guest A takes Photo X, Phone A advertises `have(hash)`.
   - Host requests `get(hash)`.
   - If Guest B later asks for Photo X, Phone B can download chunks from either Phone A or Host depending on which peer has lower latency/load.
3. **Tiered Quality Fetching**:
   - **Tier 1 (Instant)**: 120px micro-blurhash thumbnail (exchanged in metadata CRDT, <500 bytes).
   - **Tier 2 (Grid Preview)**: 640px compressed preview on demand when scrolling into viewport.
   - **Tier 3 (Archival Full Res)**: Full original binary downloaded in the background or during batch zip export.

---

## 5. Offline P2P Live Camera Wall

The existing Live Camera Wall (canvas-based 1fps preview streaming) adapts to P2P:
- **Direct WebRTC MediaStream / DataChannel Binary Feed**:
  - The guest camera feeds binary compressed WebP/JPEG frames directly across the peer's WebRTC DataChannel to the Host's live wall canvas.
  - Host sends `boost` / `unboost` control messages directly over the DataChannel.
  - Zero server transcoding or proxying needed—CPU load is distributed across edges.

---

## 6. Security, Identity & Trust Offline

1. **Device Identity**:
   - Each phone generates a local public/private keypair (`ed25519` via Web Crypto API) stored in IndexedDB.
   - The guest's phone number or name is bound to their public key.
2. **Host Delegation & Signatures**:
   - Host's device holds the root event key.
   - When host approves a guest or shares a folder, the host creates a signed capability token (`canDownload: true`, `canView: [...]`) stored in the shared CRDT.
   - Any peer can cryptographically verify that a share or permission was authorized by the Host without an internet auth server.

---

## 7. Migration & Phased Rollout Roadmap

- **Phase 1: Zero-Internet LAN Mode (Host Hotspot Server)**
  - Package Fastify/SQLite or embedded Node into single executable or Android/iOS local background service.
  - Host creates hotspot -> Guests scan QR containing Wi-Fi credentials + Host LAN URL -> Everything works offline immediately using existing client codebase.
- **Phase 2: Hybrid WebRTC Mesh (LAN Signaling + P2P DataChannels)**
  - Integrate WebRTC DataChannels for peer-to-peer media binary transfers to offload host phone storage and bandwidth.
  - Implement CRDT (Yjs/Automerge) for decentralized metadata sync.
- **Phase 3: Fully Decentralized Serverless P2P**
  - Implement visual animated QR signaling and local mDNS discovery.
  - Multi-hop gossip routing between nearby phones.
  - Automatic internet synchronization when any phone eventually reconnects to cellular/Wi-Fi (opportunistic cloud backup).
