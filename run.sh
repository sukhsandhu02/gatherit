#!/usr/bin/env bash
set -e

# Gather Run Script — Starts Docker Postgres, Fastify Server & Vite Web App
# Features:
# - Auto-starts Postgres container
# - Starts Fastify backend on 0.0.0.0:8080
# - Starts Vite frontend on 0.0.0.0:5173 (HTTPS)
# - Self-healing Tailscale Funnel / Serve background watchdog (auto-restores on disconnect/sleep/reconnect)
# - Dynamic multi-IP detection for all network interfaces (Wi-Fi, Ethernet, Hotspots, USB tethering, Tailscale mesh)
# - Real-time network change announcements

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=========================================="
echo "✨ Starting Gather Services"
echo "=========================================="

# 1. Ensure Postgres Docker container is running
echo "🐘 Checking PostgreSQL container (pg-db)..."
if ! docker ps --format '{{.Names}}' | grep -q '^pg-db$'; then
  if docker ps -a --format '{{.Names}}' | grep -q '^pg-db$'; then
    echo "Starting existing pg-db container..."
    docker start pg-db
  else
    echo "Error: pg-db container not found. Please start Postgres."
    exit 1
  fi
fi

# Ensure database exists
docker exec -i pg-db psql -U rover -d keepsake -c "SELECT 1;" >/dev/null 2>&1 || {
  echo "Creating keepsake database..."
  docker exec -i pg-db psql -U rover -c "CREATE DATABASE keepsake;"
}

# Network and Tailscale helper functions
get_interfaces_and_ips() {
  ip -4 -o addr show scope global 2>/dev/null | awk '$2 !~ /^(docker|br-|veth|lo)/ {split($4, a, "/"); print $2 ":" a[1]}' | sort
}

categorize_iface() {
  case "$1" in
    wl*) echo "Wi-Fi ($1)" ;;
    en*|eth*) echo "Ethernet ($1)" ;;
    tailscale*) echo "Tailscale Mesh ($1)" ;;
    usb*|rndis*) echo "USB Tethering ($1)" ;;
    ap*) echo "Mobile Hotspot ($1)" ;;
    *) echo "Network ($1)" ;;
  esac
}

is_tailscale_running() {
  command -v tailscale >/dev/null 2>&1 || return 1
  local state
  if command -v jq >/dev/null 2>&1; then
    state=$(tailscale status --json 2>/dev/null | jq -r '.BackendState // empty' 2>/dev/null)
    [ "$state" = "Running" ] && return 0
  else
    tailscale status >/dev/null 2>&1 && return 0
  fi
  return 1
}

get_tailscale_url() {
  local url
  url=$(tailscale funnel status 2>/dev/null | grep -o 'https://[^ /]*' | head -n 1)
  if [ -z "$url" ]; then
    url=$(tailscale serve status 2>/dev/null | grep -o 'https://[^ /]*' | head -n 1)
  fi
  echo "$url"
}

local_server_up() {
  curl -s --max-time 2 http://127.0.0.1:8080/api/health 2>/dev/null | grep -q "status"
}

ensure_tailscale_funnel() {
  command -v tailscale >/dev/null 2>&1 || return 1
  if is_tailscale_running; then
    local ts_ip
    ts_ip=$(tailscale ip -4 2>/dev/null || true)
    local ts_fqdn
    ts_fqdn=$(tailscale status --json 2>/dev/null | jq -r '.Self.DNSName // empty' 2>/dev/null | sed 's/\.$//')

    local healthy=false
    if [ -n "$ts_ip" ] && [ -n "$ts_fqdn" ]; then
      if curl -s -k --max-time 2 --resolve "${ts_fqdn}:443:${ts_ip}" "https://${ts_fqdn}/api/health" 2>/dev/null | grep -q "status"; then
        healthy=true
      fi
    fi

    # Never churn the Funnel config while the local API is down (would only mask the real problem)
    if [ "$healthy" = false ] && local_server_up; then
      tailscale funnel --https=443 off >/dev/null 2>&1 || true
      tailscale funnel --https=443 --bg http://127.0.0.1:8080 >/dev/null 2>&1 || \
      tailscale serve --bg http://127.0.0.1:8080 >/dev/null 2>&1 || true
    fi

    if ! tailscale funnel status 2>/dev/null | grep -q ":8443 (Funnel on)"; then
      tailscale funnel --https=8443 --bg http://127.0.0.1:8080 >/dev/null 2>&1 || true
    fi
    return 0
  fi
  return 1
}

# 2. Cleanup background processes on exit
SERVER_PID=""
WEB_PID=""
WATCHDOG_PID=""

cleanup() {
  echo ""
  echo "🛑 Stopping Gather services..."
  [ -n "$WATCHDOG_PID" ] && kill "$WATCHDOG_PID" 2>/dev/null || true
  [ -n "$SERVER_PID" ] && { pkill -P "$SERVER_PID" 2>/dev/null || true; kill "$SERVER_PID" 2>/dev/null || true; }
  pkill -f "tsx.*src/index.ts" 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 2.5 Ensure production web bundle is built for Fastify (serves pre-bundled 111KB payload, instant 0ms transitions)
echo "📦 Building latest web client assets for Fastify..."
npm --prefix "$ROOT_DIR/web" run build

# 3. Start Backend Fastify Server
echo "🚀 Starting Fastify API & WebSocket server on http://0.0.0.0:8080 ..."
cd "$ROOT_DIR/server"
# Supervised: if the server crashes (e.g. mid-edit TS error) it is restarted automatically.
# `tsx watch` alone just sits idle after a crash, so Tailscale Funnel gets "connection refused" -> phones show "connection closed".
# Pass --no-watch to disable file-watch restarts (plain tsx, still supervised).
SERVER_CMD="tsx watch"
for arg in "$@"; do
  [ "$arg" = "--no-watch" ] && SERVER_CMD="tsx"
done
(
  while true; do
    npx $SERVER_CMD src/index.ts || true
    echo "⚠️  [Supervisor] Server exited. Restarting in 2s..."
    sleep 2
  done
) &
SERVER_PID=$!

# Wait until the API actually answers (up to 40s) before touching Tailscale
for _ in $(seq 1 40); do
  local_server_up && break
  sleep 1
done

# 4. Start Frontend Vite Server
FAST_MODE=false
for arg in "$@"; do
  case "$arg" in
    --fast|--prod|--preview) FAST_MODE=true ;;
  esac
done

if [ "$FAST_MODE" = true ]; then
  echo "⚡ Fast Production Mode: Building optimized web bundle..."
  cd "$ROOT_DIR/web"
  npm run build
  echo "🚀 Starting Vite Preview on https://0.0.0.0:5173 (pre-bundled 118KB payload, 0ms latency)..."
  npx vite preview --host 0.0.0.0 --port 5173 &
  WEB_PID=$!
else
  echo "⚡ Starting Vite Frontend on https://0.0.0.0:5173 ..."
  echo "💡 Tip: Run './run.sh --fast' for 30x faster phone load times (118KB bundle vs 3.5MB unbundled dev modules)!"
  cd "$ROOT_DIR/web"
  npm run dev -- --host 0.0.0.0 &
  WEB_PID=$!
fi

# 5. Configure Tailscale Funnel initially
ensure_tailscale_funnel
TS_FUNNEL_URL=$(get_tailscale_url)

# Find primary phone IP for quick tips
PRIMARY_LAN_IP=$(ip -4 -o addr show scope global 2>/dev/null | awk '$2 !~ /^(docker|br-|veth|lo|tailscale)/ {split($4, a, "/"); print a[1]; exit}')

# 6. Start Self-Healing Background Watchdog
tailscale_watchdog() {
  local was_connected=false
  local last_funnel_url=""
  local last_ips

  if is_tailscale_running; then
    was_connected=true
    last_funnel_url=$(get_tailscale_url)
  fi
  last_ips=$(get_interfaces_and_ips)

  while true; do
    sleep 4

    # A. Check network interfaces & IP changes
    current_ips=$(get_interfaces_and_ips)
    if [ "$current_ips" != "$last_ips" ]; then
      echo ""
      echo "📡 [Network Watchdog] Network interface change detected!"
      echo "--------------------------------------------------------"
      for entry in $current_ips; do
        iface="${entry%%:*}"
        ipaddr="${entry##*:}"
        label=$(categorize_iface "$iface")
        printf "  🔹 %-24s https://%s:5173\n" "$label:" "$ipaddr"
      done
      echo "--------------------------------------------------------"
      last_ips="$current_ips"
    fi

    # B. Check Tailscale connection & auto-heal Funnel
    if command -v tailscale >/dev/null 2>&1; then
      if is_tailscale_running; then
        if [ "$was_connected" = false ]; then
          echo ""
          echo "🔄 [Tailscale Watchdog] Tailscale connected! Auto-adjusting and restoring Funnel proxy..."
          was_connected=true
          ensure_tailscale_funnel
          current_url=$(get_tailscale_url)
          if [ -n "$current_url" ]; then
            echo "✨ [Tailscale Watchdog] Funnel active: ${current_url}"
          fi
          last_funnel_url="$current_url"
        else
          # Connected: actively probe health to detect silent socket drops
          local ts_ip
          ts_ip=$(tailscale ip -4 2>/dev/null || true)
          local ts_fqdn
          ts_fqdn=$(tailscale status --json 2>/dev/null | jq -r '.Self.DNSName // empty' 2>/dev/null | sed 's/\.$//')
          if [ -n "$ts_ip" ] && [ -n "$ts_fqdn" ] && local_server_up; then
            if ! curl -s -k --max-time 2 --resolve "${ts_fqdn}:443:${ts_ip}" "https://${ts_fqdn}/api/health" 2>/dev/null | grep -q "status"; then
              echo ""
              echo "🔧 [Tailscale Watchdog] Funnel proxy dropped or unresponsive. Restoring..."
              ensure_tailscale_funnel
              current_url=$(get_tailscale_url)
              if [ -n "$current_url" ]; then
                echo "✨ [Tailscale Watchdog] Funnel restored: ${current_url}"
              fi
              last_funnel_url="$current_url"
            fi
          fi
        fi
      else
        if [ "$was_connected" = true ]; then
          echo ""
          echo "⚠️  [Tailscale Watchdog] Tailscale disconnected. Monitoring for reconnection..."
          was_connected=false
          last_funnel_url=""
        fi
      fi
    fi
  done
}

tailscale_watchdog &
WATCHDOG_PID=$!

# 7. Print Connection Endpoints Banner
echo "=========================================="
echo " ✨ Gather is Live & Ready (HTTPS Enabled)!"
echo " Local (Host PC):   https://localhost:5173"
if [ -n "$TS_FUNNEL_URL" ]; then
  echo " Public / Funnel:   ${TS_FUNNEL_URL}"
elif is_tailscale_running; then
  echo " Tailscale Funnel:  [Configuring / Waiting for SSL...]"
else
  echo " Tailscale:         [Offline / Watchdog will auto-enable when connected]"
fi

# Print all active network interface URLs
for entry in $(get_interfaces_and_ips); do
  iface="${entry%%:*}"
  ipaddr="${entry##*:}"
  label=$(categorize_iface "$iface")
  printf " %-19s https://%s:5173\n" "$label:" "$ipaddr"
done

echo " API Server:        http://localhost:8080"
echo " Health Status:     http://localhost:8080/api/health"
echo " Host Portal:       https://localhost:5173/host/setup"
echo " Passes:            https://localhost:5173/host/passes"
echo "=========================================="
echo "📱 Phone Connection & Speed Tip:"
if [ -n "$PRIMARY_LAN_IP" ]; then
  echo " ⚡ FASTEST (Local Wi-Fi): https://${PRIMARY_LAN_IP}:5173"
  echo "    Direct 1-2ms local speed (no cloud relay lag). On first visit, tap 'Advanced' -> 'Proceed'."
fi
if [ -n "$TS_FUNNEL_URL" ]; then
  echo " 🌍 Public Funnel:       ${TS_FUNNEL_URL}"
  echo "    (Routes via Tailscale cloud relay. Tip: use Local Wi-Fi or run './run.sh --fast' for instant loading!)"
fi
echo " Because it is HTTPS, mobile browsers allow full camera/video permissions!"
echo "=========================================="
echo "Press Ctrl+C to stop all services."

wait
