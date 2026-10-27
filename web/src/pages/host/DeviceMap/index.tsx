import { useState, useEffect, useMemo, useRef } from 'react';
import { HostLayout } from '../../../layouts/HostLayout';
import { useMesh } from '../../../lib/p2p/MeshContext';
import { useTheme } from '../../../context/ThemeContext';
import { api, getWsUrl } from '../../../lib/api';
import {
  Radio,
  Share2,
  Compass,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Monitor,
  Smartphone,
  MapPin,
} from 'lucide-react';

export interface DeviceInfo {
  deviceId: string;
  name: string;
  role: 'host' | 'guest';
  latitude: number;
  longitude: number;
  accuracy?: number;
  updatedAt: number;
  isOnline: boolean;
}

// 100% offline Haversine distance formula (in meters)
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(meters: number): string {
  if (meters < 1) return '< 1 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

// Calculate compass bearing between two coordinates (0° = North, 90° = East)
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

export function bearingToCardinal(bearing: number): string {
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return cardinals[index];
}

export default function HostDeviceMapPage() {
  const { isDark } = useTheme();
  const [event, setEvent] = useState<any>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showDistancesOnLinks, setShowDistancesOnLinks] = useState(true);
  const [filterRole, setFilterRole] = useState<'all' | 'guest' | 'host'>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [hostPos, setHostPos] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [calibratedHostPos, setCalibratedHostPos] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const saved = localStorage.getItem('gather-calibrated-host-pos');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [serverDevices, setServerDevices] = useState<Map<string, DeviceInfo>>(new Map());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const { peerLocations, connectedCount, broadcastLocation, localId } = useMesh();

  // Fetch active event metadata
  useEffect(() => {
    api('/api/host/event')
      .then((res: any) => setEvent(res.event))
      .catch(() => {});
  }, []);

  const broadcastLocationRef = useRef(broadcastLocation);
  broadcastLocationRef.current = broadcastLocation;

  // Watch Host position via Geolocation API
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    let watchId: number | null = null;
    let lastSent = 0;
    let lastLat: number | null = null;
    let lastLng: number | null = null;

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          const { latitude, longitude, accuracy } = pos.coords;

          // Dead-zone filter: skip broadcast if device hasn't moved more than 4m.
          // Eliminates GPS jitter noise oscillating distance when the device is stationary.
          const MOVE_THRESHOLD_M = 4;
          if (lastLat !== null && lastLng !== null) {
            const dLat = ((latitude - lastLat) * Math.PI) / 180;
            const dLng = ((longitude - lastLng) * Math.PI) / 180;
            const a = Math.sin(dLat / 2) ** 2 +
              Math.cos((lastLat * Math.PI) / 180) * Math.cos((latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
            const moved = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            if (moved < MOVE_THRESHOLD_M && now - lastSent < 10000) return;
          }

          if (now - lastSent < 2000) return;
          lastSent = now;
          lastLat = latitude;
          lastLng = longitude;

          setHostPos({ lat: latitude, lng: longitude, accuracy });
          broadcastLocationRef.current(latitude, longitude, accuracy, 'Host Console', 'host');
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } catch {
      // ignore
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Connect to WebSocket for real-time node telemetry
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: any = null;
    let pollInterval: any = null;

    const connect = () => {
      ws = new WebSocket(getWsUrl('/ws'));

      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'get_locations' }));
        // Poll every 3 seconds as a fallback to catch any missed server pushes
        pollInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'get_locations' }));
          }
        }, 3000);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'device_locations' && Array.isArray(msg.devices)) {
            const next = new Map<string, DeviceInfo>();
            for (const d of msg.devices) {
              next.set(d.deviceId, {
                deviceId: d.deviceId,
                name: d.name || `Device ${d.deviceId.slice(0, 4)}`,
                role: d.role || 'guest',
                latitude: Number(d.latitude),
                longitude: Number(d.longitude),
                accuracy: d.accuracy,
                updatedAt: d.updatedAt || Date.now(),
                isOnline: d.isOnline !== false,
              });
            }
            setServerDevices(next);
          }
        } catch {
          // ignore non-json
        }
      };

      ws.onclose = () => {
        if (pollInterval) clearInterval(pollInterval);
        timer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timer) clearTimeout(timer);
      if (ws) ws.close();
    };
  }, []);

  // Merge server telemetry with direct offline P2P mesh telemetry
  const devices = useMemo(() => {
    const map = new Map<string, DeviceInfo>();

    // 1. Populate from server device telemetry; explicitly drop stale closed-device records
    for (const [id, dev] of serverDevices.entries()) {
      if (dev.isOnline === false) continue;
      map.set(id, dev);
    }

    // 2. Merge offline peerLocations from WebRTC data channels
    // Only include peers that are actively in WebRTC mesh or in serverDevices, and not timed out (> 60s)
    const now = Date.now();
    for (const [id, loc] of Object.entries(peerLocations)) {
      if (id === localId) continue; // Skip local mirror to prevent duplicate host nodes
      // If server explicitly reported this device offline or not present, and WebRTC channel is absent/expired, skip
      if (serverDevices.has(id)) {
        const sDev = serverDevices.get(id);
        if (sDev && sDev.isOnline === false) continue;
      }
      if (loc.timestamp && now - loc.timestamp > 60000 && !serverDevices.has(id)) {
        continue;
      }
      const existing = map.get(id);
      map.set(id, {
        deviceId: id,
        name: loc.name || existing?.name || `Mesh Node ${id.slice(0, 5)}`,
        role: loc.role || existing?.role || 'guest',
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        updatedAt: loc.timestamp || Date.now(),
        isOnline: true,
      });
    }

    // 3. Set Host Console position
    if (hostPos || calibratedHostPos) {
      let hostId = localId || 'host-local';
      for (const [id, d] of map.entries()) {
        if (d.role === 'host') {
          hostId = id;
          break;
        }
      }

      // Check if host position is uncalibrated with coarse accuracy (typical PC browser geolocation from ISP routing hub > 5000m)
      // while a guest phone with precise satellite GPS fix (accuracy < 100m) is active in the same venue/mesh.
      // Auto-anchor host console so distance reflects real-time room/venue proximity instead of 100-200km ISP hub offset.
      let effectiveCalibrated = calibratedHostPos;
      if (!effectiveCalibrated && hostPos) {
        const guestNodes = Array.from(map.values()).filter((d) => d.role === 'guest' && d.isOnline);
        const accurateGuest = guestNodes.find((d) => (d.accuracy || 1000) < 150);
        const hostAccuracy = hostPos.accuracy || 10000;
        if (accurateGuest) {
          const rawDist = haversineDistanceMeters(
            hostPos.lat,
            hostPos.lng,
            accurateGuest.latitude,
            accurateGuest.longitude
          );
          // If PC IP-geolocation placed it far away (> 2000m) or accuracy is low (> 500m), snap to venue
          if (rawDist > 2000 || hostAccuracy > 500) {
            effectiveCalibrated = {
              lat: accurateGuest.latitude,
              lng: accurateGuest.longitude,
            };
          }
        }
      }

      const activeLat = effectiveCalibrated ? effectiveCalibrated.lat : hostPos!.lat;
      const activeLng = effectiveCalibrated ? effectiveCalibrated.lng : hostPos!.lng;
      const activeAcc = effectiveCalibrated ? 5 : hostPos?.accuracy;

      map.set(hostId, {
        deviceId: hostId,
        name: 'Host Console (You)',
        role: 'host',
        latitude: activeLat,
        longitude: activeLng,
        accuracy: activeAcc,
        updatedAt: Date.now(),
        isOnline: true,
      });
    }

    const all = Array.from(map.values()).filter((d) => d.isOnline !== false);
    if (filterRole === 'all') return all;
    return all.filter((d) => d.role === filterRole);
  }, [serverDevices, peerLocations, hostPos, calibratedHostPos, filterRole, localId]);

  // Center reference device (default: Host console or first active node)
  const refDevice = useMemo(() => {
    if (selectedDeviceId) {
      const sel = devices.find((d) => d.deviceId === selectedDeviceId);
      if (sel) return sel;
    }
    return devices.find((d) => d.role === 'host') || devices[0] || null;
  }, [devices, selectedDeviceId]);

  // Calculate Node Coordinates using Spherical Geometry and Spring Balancing
  const nodeGraph = useMemo(() => {
    if (devices.length === 0 || !refDevice) return { nodes: [], links: [], maxDist: 100 };

    // Canvas coordinate space
    const centerCanvasX = 450;
    const centerCanvasY = 320;
    const maxCanvasRadius = 240;

    // Determine max real distance among nodes for adaptive scaling
    let maxDistFound = 10;
    for (const d of devices) {
      const dist = haversineDistanceMeters(
        refDevice.latitude,
        refDevice.longitude,
        d.latitude,
        d.longitude
      );
      if (dist > maxDistFound) maxDistFound = dist;
    }

    // Place nodes
    const nodes = devices.map((d, idx) => {
      const isRef = d.deviceId === refDevice.deviceId;
      const dist = isRef
        ? 0
        : haversineDistanceMeters(
            refDevice.latitude,
            refDevice.longitude,
            d.latitude,
            d.longitude
          );

      // 100% true geometric compass bearing (0° = North, 90° = East, 180° = South, 270° = West)
      const trueBearing = isRef
        ? 0
        : calculateBearing(
            refDevice.latitude,
            refDevice.longitude,
            d.latitude,
            d.longitude
          );

      // Relative Radial Projection
      let r = 0;
      if (!isRef) {
        if (maxDistFound <= 50) {
          // Micro scale (rooms/hallways): linear
          r = Math.min(maxCanvasRadius, Math.max(50, (dist / maxDistFound) * maxCanvasRadius));
        } else {
          // Logarithmic scale so nearby (<30m) and far (>200m) both fit cleanly
          const norm = Math.log10(1 + dist) / Math.log10(1 + maxDistFound);
          r = Math.min(maxCanvasRadius, Math.max(55, norm * maxCanvasRadius));
        }
      }

      // If devices are in same room / co-located (< 5m GPS resolution noise):
      // Disperse non-reference nodes symmetrically in an evenly spaced ring around the host.
      // Filter out refDevice index so peer indices distribute smoothly across 360 degrees.
      let finalBearing = trueBearing;
      if (dist < 5 && !isRef) {
        const otherNodes = devices.filter((x) => x.deviceId !== refDevice.deviceId);
        const peerIdx = otherNodes.findIndex((x) => x.deviceId === d.deviceId);
        const safeIdx = peerIdx >= 0 ? peerIdx : idx;
        finalBearing = (safeIdx * 360) / Math.max(1, otherNodes.length);
        r = 65 + (safeIdx % 3) * 20;
      }

      // Angle in radians (compass 0° is North / -Y axis)
      const rad = ((finalBearing - 90) * Math.PI) / 180;
      const x = isRef ? centerCanvasX : centerCanvasX + r * Math.cos(rad);
      const y = isRef ? centerCanvasY : centerCanvasY + r * Math.sin(rad);

      return {
        ...d,
        distanceFromRef: dist,
        bearing: finalBearing,
        trueBearing,
        isCoLocated: dist < 5 && !isRef,
        x,
        y,
        isRef,
      };
    });

    // Compute inter-node mesh linkages
    const links: {
      source: (typeof nodes)[0];
      target: (typeof nodes)[0];
      dist: number;
      isHighlighted: boolean;
    }[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d1 = nodes[i];
        const d2 = nodes[j];
        const realDistance = haversineDistanceMeters(
          d1.latitude,
          d1.longitude,
          d2.latitude,
          d2.longitude
        );

        // Link if one is the reference or if within 300m
        const isConnectedToSelected =
          selectedDeviceId === d1.deviceId || selectedDeviceId === d2.deviceId;

        links.push({
          source: d1,
          target: d2,
          dist: realDistance,
          isHighlighted: isConnectedToSelected,
        });
      }
    }

    return {
      nodes,
      links,
      maxDist: maxDistFound,
      centerCanvasX,
      centerCanvasY,
    };
  }, [devices, refDevice, selectedDeviceId]);

  // Pan and Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectedDeviceId(null);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Selected device profile (enriched with graph calculations)
  const selectedNode = useMemo(() => {
    if (!selectedDeviceId) return null;
    return nodeGraph.nodes.find((d) => d.deviceId === selectedDeviceId) || null;
  }, [nodeGraph.nodes, selectedDeviceId]);

  return (
    <HostLayout eventName={event?.name}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#faf3f0] dark:bg-[#2d1d17] text-[#a05e44] dark:text-[#deb09d] flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-[#2b2621] dark:text-[#f5f2ec] tracking-tight">
                Device Mesh Graph
              </h2>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center space-x-2">
            <div className="bg-white dark:bg-[#201c19] p-1 rounded-2xl border border-[#e7dfd3] dark:border-[#332b25] flex items-center shadow-xs">
              <button
                onClick={() => setFilterRole('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  filterRole === 'all'
                    ? 'bg-[#a05e44] text-white shadow-xs'
                    : 'text-[#6e6459] dark:text-[#a69c8e] hover:text-[#2b2621] dark:hover:text-white'
                }`}
              >
                All ({devices.length})
              </button>
              <button
                onClick={() => setFilterRole('guest')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  filterRole === 'guest'
                    ? 'bg-[#a05e44] text-white shadow-xs'
                    : 'text-[#6e6459] dark:text-[#a69c8e] hover:text-[#2b2621] dark:hover:text-white'
                }`}
              >
                Cameras
              </button>
              <button
                onClick={() => setFilterRole('host')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  filterRole === 'host'
                    ? 'bg-[#a05e44] text-white shadow-xs'
                    : 'text-[#6e6459] dark:text-[#a69c8e] hover:text-[#2b2621] dark:hover:text-white'
                }`}
              >
                Host
              </button>
            </div>
          </div>
        </div>

        {/* Main Graph Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Visual Canvas Area */}
          <div
            ref={containerRef}
            className={`lg:col-span-3 bg-[#faf7f2] dark:bg-[#161412] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl overflow-hidden shadow-xs relative flex flex-col transition-colors duration-200 ${
              isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-[640px]'
            }`}
          >
            {/* Top Toolbar Overlay */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
              <div className="bg-white/95 dark:bg-[#201c19]/95 backdrop-blur-md px-3.5 py-1.5 rounded-2xl text-xs font-semibold text-[#2b2621] dark:text-[#f5f2ec] border border-[#e7dfd3] dark:border-[#38312a] flex items-center space-x-2 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#53785e]" />
                <span>Reference: {refDevice ? refDevice.name : 'Awaiting Nodes'}</span>
              </div>

              {refDevice && (
                <div className="bg-white/95 dark:bg-[#201c19]/95 backdrop-blur-md px-3 py-1.5 rounded-2xl text-[11px] font-mono text-[#6e6459] dark:text-[#a69c8e] border border-[#e7dfd3] dark:border-[#38312a] hidden sm:flex items-center space-x-1 shadow-xs">
                  <span>GPS: {refDevice.latitude.toFixed(5)}, {refDevice.longitude.toFixed(5)}</span>
                </div>
              )}

              <button
                onClick={() => setShowDistancesOnLinks(!showDistancesOnLinks)}
                className={`px-3 py-1.5 rounded-2xl text-xs font-semibold transition cursor-pointer border shadow-xs ${
                  showDistancesOnLinks
                    ? 'bg-[#faf3f0] dark:bg-[#2d1d17] border-[#deb09d] dark:border-[#583325] text-[#a05e44] dark:text-[#deb09d]'
                    : 'bg-white/95 dark:bg-[#201c19]/95 border-[#e7dfd3] dark:border-[#38312a] text-[#6e6459] dark:text-[#a69c8e] hover:text-[#2b2621] dark:hover:text-white'
                }`}
              >
                {showDistancesOnLinks ? 'Hide Distances' : 'Show Distances'}
              </button>

              {/* One-click Venue GPS calibration: Align Host PC with phone's true GNSS fix */}
              {(() => {
                const phoneNode = devices.find((d) => d.role === 'guest');
                if (!phoneNode) return null;
                const distToPhone = refDevice
                  ? haversineDistanceMeters(refDevice.latitude, refDevice.longitude, phoneNode.latitude, phoneNode.longitude)
                  : 0;
                if (distToPhone <= 100 && !calibratedHostPos) return null;

                return (
                  <button
                    onClick={() => {
                      if (calibratedHostPos) {
                        localStorage.removeItem('gather-calibrated-host-pos');
                        setCalibratedHostPos(null);
                      } else {
                        // Snap host to the phone's exact GPS fix — the canvas dispersion ring
                        // handles visual separation, so no directional offset is needed here.
                        const newPos = {
                          lat: phoneNode.latitude,
                          lng: phoneNode.longitude,
                        };
                        localStorage.setItem('gather-calibrated-host-pos', JSON.stringify(newPos));
                        setCalibratedHostPos(newPos);
                      }
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition cursor-pointer border shadow-xs bg-[#fdf6ec] dark:bg-[#2b2014] text-[#b3732c] dark:text-[#d48d3b] border-[#f5dfb8] dark:border-[#4d361c] hover:bg-[#fbedd6]"
                    title="PC browsers lack hardware GPS and estimate location via ISP routing centers. Click to calibrate Host PC position to your phone's true GPS fix."
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{calibratedHostPos ? 'Reset Host GPS' : 'Calibrate to Phone GPS'}</span>
                  </button>
                );
              })()}
            </div>

            {/* Floating Zoom / Reset Tools */}
            <div className="absolute top-4 right-4 z-20 flex flex-col space-y-1.5 pointer-events-auto">
              <button
                onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.2))}
                className="p-2.5 rounded-xl bg-white/95 dark:bg-[#201c19]/95 hover:bg-[#f0ebe1] dark:hover:bg-[#2b2520] text-[#5c5246] dark:text-[#c7bfb4] backdrop-blur-md border border-[#e7dfd3] dark:border-[#38312a] transition cursor-pointer shadow-xs"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomScale((z) => Math.max(0.5, z - 0.2))}
                className="p-2.5 rounded-xl bg-white/95 dark:bg-[#201c19]/95 hover:bg-[#f0ebe1] dark:hover:bg-[#2b2520] text-[#5c5246] dark:text-[#c7bfb4] backdrop-blur-md border border-[#e7dfd3] dark:border-[#38312a] transition cursor-pointer shadow-xs"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={resetView}
                className="p-2.5 rounded-xl bg-white/95 dark:bg-[#201c19]/95 hover:bg-[#f0ebe1] dark:hover:bg-[#2b2520] text-[#5c5246] dark:text-[#c7bfb4] backdrop-blur-md border border-[#e7dfd3] dark:border-[#38312a] transition cursor-pointer shadow-xs"
                title="Reset View and Recenter"
              >
                <RotateCcw className="w-4 h-4 text-[#53785e] dark:text-[#699777]" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2.5 rounded-xl bg-white/95 dark:bg-[#201c19]/95 hover:bg-[#f0ebe1] dark:hover:bg-[#2b2520] text-[#5c5246] dark:text-[#c7bfb4] backdrop-blur-md border border-[#e7dfd3] dark:border-[#38312a] transition cursor-pointer shadow-xs"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Bottom Legend */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center space-x-3 text-[11px] text-[#6e6459] dark:text-[#a69c8e] bg-white/95 dark:bg-[#201c19]/95 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-[#e7dfd3] dark:border-[#38312a] pointer-events-none shadow-xs">
              <div className="flex items-center space-x-1.5">
                <Monitor className="w-3.5 h-3.5 text-[#b3732c]" />
                <span>Host Console</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#a05e44] dark:text-[#deb09d]" />
                <span>Guest Mobile</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-0.5 bg-[#8c7e6c]" />
                <span>P2P Mesh Link</span>
              </div>
            </div>

            {/* Interactive SVG Mesh Canvas */}
            <div
              className={`w-full h-full relative cursor-${isDragging ? 'grabbing' : 'grab'} select-none overflow-hidden`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <svg
                className="w-full h-full"
                viewBox="0 0 900 640"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Transformed Layer for Smooth Zoom & Pan */}
                <g
                  transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomScale})`}
                  style={{ transformOrigin: '450px 320px', transition: isDragging ? 'none' : 'transform 0.15s ease-out' }}
                >
                  {/* Subtle Cardinal Indicators (N S E W) */}
                  <text x="450" y="28" fill={isDark ? '#64748b' : '#94a3b8'} fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.05em">N</text>
                  <text x="872" y="324" fill={isDark ? '#64748b' : '#94a3b8'} fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.05em">E</text>
                  <text x="450" y="620" fill={isDark ? '#64748b' : '#94a3b8'} fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.05em">S</text>
                  <text x="28" y="324" fill={isDark ? '#64748b' : '#94a3b8'} fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.05em">W</text>

                  {/* Inter-node Mesh Link Lines */}
                  {nodeGraph.links.map((link, idx) => {
                    const isSelected =
                      selectedDeviceId === link.source.deviceId ||
                      selectedDeviceId === link.target.deviceId;
                    const isHovered =
                      hoveredDeviceId === link.source.deviceId ||
                      hoveredDeviceId === link.target.deviceId;
                    const highlight = isSelected || isHovered;

                    return (
                      <g key={`link-${idx}`}>
                        <line
                          x1={link.source.x}
                          y1={link.source.y}
                          x2={link.target.x}
                          y2={link.target.y}
                          stroke={highlight ? (isDark ? '#60a5fa' : '#2563eb') : (isDark ? '#334155' : '#cbd5e1')}
                          strokeWidth={highlight ? '2' : '1.2'}
                          strokeDasharray={highlight ? 'none' : '3 3'}
                          opacity={highlight ? 1 : 0.8}
                        />

                        {/* Distance Tag on Link */}
                        {(showDistancesOnLinks || highlight) && (
                          <g>
                            <rect
                              x={(link.source.x + link.target.x) / 2 - 28}
                              y={(link.source.y + link.target.y) / 2 - 10}
                              width="56"
                              height="20"
                              rx="6"
                              fill={isDark ? '#201c19' : '#ffffff'}
                              stroke={highlight ? (isDark ? '#deb09d' : '#a05e44') : (isDark ? '#38312a' : '#e7dfd3')}
                              strokeWidth="1"
                            />
                            <text
                              x={(link.source.x + link.target.x) / 2}
                              y={(link.source.y + link.target.y) / 2 + 4}
                              fill={highlight ? (isDark ? '#deb09d' : '#a05e44') : (isDark ? '#a69c8e' : '#6e6459')}
                              fontSize="9"
                              fontWeight="bold"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {formatDistance(link.dist)}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Render Graph Nodes */}
                  {nodeGraph.nodes.map((node) => {
                    const isSelected = selectedDeviceId === node.deviceId;
                    const isHovered = hoveredDeviceId === node.deviceId;
                    const isHost = node.role === 'host';

                    return (
                      <g
                        key={node.deviceId}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDeviceId(node.deviceId === selectedDeviceId ? null : node.deviceId);
                        }}
                        onMouseEnter={() => setHoveredDeviceId(node.deviceId)}
                        onMouseLeave={() => setHoveredDeviceId(null)}
                        className="cursor-pointer group"
                        transform={`translate(${node.x}, ${node.y})`}
                      >
                        {/* Device Badge (PC icon for Host, Phone icon for Mobile) */}
                        <rect
                          x={node.isRef ? -20 : -15}
                          y={node.isRef ? -20 : -15}
                          width={node.isRef ? 40 : 30}
                          height={node.isRef ? 40 : 30}
                          rx={node.isRef ? 10 : 8}
                          fill={
                            isSelected
                              ? (isHost ? '#d97706' : '#2563eb')
                              : isHovered
                              ? (isDark ? '#334155' : '#e2e8f0')
                              : (isDark ? '#1e293b' : '#f8fafc')
                          }
                          stroke={
                            isSelected
                              ? (isHost ? '#b45309' : '#1d4ed8')
                              : isHovered
                              ? (isDark ? '#64748b' : '#94a3b8')
                              : (isDark ? '#334155' : '#cbd5e1')
                          }
                          strokeWidth="1"
                        />

                        {/* Embedded Device Icon */}
                        <foreignObject
                          x={node.isRef ? -14 : -10}
                          y={node.isRef ? -14 : -10}
                          width={node.isRef ? 28 : 20}
                          height={node.isRef ? 28 : 20}
                          className="pointer-events-none select-none"
                        >
                          <div className="w-full h-full flex items-center justify-center">
                            {isHost ? (
                              <Monitor
                                className={`${
                                  node.isRef ? 'w-5 h-5' : 'w-4 h-4'
                                } ${
                                  isSelected
                                    ? 'text-white'
                                    : isDark
                                    ? 'text-amber-400'
                                    : 'text-amber-700'
                                }`}
                              />
                            ) : (
                              <Smartphone
                                className={`${
                                  node.isRef ? 'w-5 h-5' : 'w-4 h-4'
                                } ${
                                  isSelected
                                    ? 'text-white'
                                    : isDark
                                    ? 'text-blue-400'
                                    : 'text-blue-600'
                                }`}
                              />
                            )}
                          </div>
                        </foreignObject>

                        {/* Node Label Pill */}
                        <g transform={`translate(0, ${node.isRef ? 32 : 24})`}>
                          <rect
                            x="-48"
                            y="-9"
                            width="96"
                            height="18"
                            rx="5"
                            fill={isDark ? '#12151c' : '#ffffff'}
                            stroke={isSelected ? (isDark ? '#60a5fa' : '#2563eb') : (isDark ? '#334155' : '#e2e8f0')}
                            strokeWidth="1"
                          />
                          <text
                            y="4"
                            textAnchor="middle"
                            fill={isSelected ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#e2e8f0' : '#334155')}
                            fontSize="10"
                            fontWeight="600"
                          >
                            {node.name.length > 13 ? node.name.slice(0, 11) + '..' : node.name}
                          </text>
                        </g>

                        {/* Real Distance Badge underneath */}
                        {!node.isRef && node.distanceFromRef !== undefined && (
                          <text
                            y={node.isRef ? 56 : 50}
                            textAnchor="middle"
                            fill={isDark ? '#60a5fa' : '#2563eb'}
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {formatDistance(node.distanceFromRef)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Zero Devices Waiting Screen */}
              {devices.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 pointer-events-none">
                  <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Radio className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Awaiting Connected Devices</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                    When guests connect to Gather via QR code or direct P2P mesh, their active node cards, bearings, and inter-device geometric distances will materialize here instantly.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Connected Node Inspector & Distance Matrix */}
          <div className="space-y-4">
            {/* Selected Node Details Card */}
            {selectedNode && (
              <div className="bg-white dark:bg-[#201c19] border border-[#a05e44]/40 rounded-3xl p-5 shadow-md relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-[#e7dfd3] dark:border-[#332b25]">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#53785e] animate-pulse" />
                    <h3 className="font-serif font-bold text-sm text-[#2b2621] dark:text-[#f5f2ec] truncate max-w-[150px]">
                      {selectedNode.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedDeviceId(null)}
                    className="text-xs text-[#8c7e6c] hover:text-[#2b2621] dark:hover:text-[#f5f2ec] cursor-pointer"
                  >
                    Clear Focus
                  </button>
                </div>

                <div className="mt-3 space-y-2 text-xs text-[#6e6459] dark:text-[#a69c8e]">
                  <div className="flex justify-between py-1 border-b border-[#f0ebe1] dark:border-[#2d2520]">
                    <span className="text-[#8c7e6c]">Node ID:</span>
                    <span className="font-mono text-[#2b2621] dark:text-[#f5f2ec]">{selectedNode.deviceId.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#f0ebe1] dark:border-[#2d2520]">
                    <span className="text-[#8c7e6c]">Role:</span>
                    <span className="font-semibold capitalize text-[#a05e44] dark:text-[#deb09d]">{selectedNode.role}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#f0ebe1] dark:border-[#2d2520]">
                    <span className="text-[#8c7e6c]">Coordinates:</span>
                    <span className="font-mono">{selectedNode.latitude.toFixed(5)}, {selectedNode.longitude.toFixed(5)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#f0ebe1] dark:border-[#2d2520]">
                    <span className="text-[#8c7e6c]">GPS Accuracy:</span>
                    <span className="font-mono">{selectedNode.accuracy ? `±${Math.round(selectedNode.accuracy)}m` : 'High'}</span>
                  </div>
                  {!selectedNode.isRef && selectedNode.distanceFromRef !== undefined && (
                    <div className="flex justify-between py-1">
                      <span className="text-[#8c7e6c]">Relative Bearing:</span>
                      <span className="font-mono font-semibold text-[#a05e44] dark:text-[#deb09d]">
                        {selectedNode.isCoLocated
                          ? 'Co-located (Room mesh)'
                          : `${Math.round(selectedNode.trueBearing ?? selectedNode.bearing)}° (${bearingToCardinal(selectedNode.trueBearing ?? selectedNode.bearing)})`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Node Directory List */}
            <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-base text-[#2b2621] dark:text-[#f5f2ec]">
                  Active Nodes ({devices.length})
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#f4efe6] dark:bg-[#2b2520] text-[#5c5246] dark:text-[#c7bfb4]">
                  {connectedCount} Mesh P2P
                </span>
              </div>

              {devices.length === 0 ? (
                <div className="py-8 text-center text-[#8c7e6c] dark:text-[#78716c] text-xs">
                  No devices currently reporting telemetry.
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {devices.map((d) => {
                    const isSelected = selectedDeviceId === d.deviceId;
                    const isHost = d.role === 'host';

                    // Distance relative to reference device
                    const dist =
                      refDevice && d.deviceId !== refDevice.deviceId
                        ? haversineDistanceMeters(
                            refDevice.latitude,
                            refDevice.longitude,
                            d.latitude,
                            d.longitude
                          )
                        : null;

                    return (
                      <div
                        key={d.deviceId}
                        onClick={() => setSelectedDeviceId(isSelected ? null : d.deviceId)}
                        onMouseEnter={() => setHoveredDeviceId(d.deviceId)}
                        onMouseLeave={() => setHoveredDeviceId(null)}
                        className={`p-3 rounded-2xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#faf3f0] dark:bg-[#2d1d17] border-[#deb09d] dark:border-[#583325] ring-2 ring-[#a05e44]/30'
                            : 'bg-[#faf7f2] dark:bg-[#161412] border-[#e7dfd3] dark:border-[#38312a] hover:bg-[#f4efe6] dark:hover:bg-[#25201c]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                d.isOnline ? 'bg-[#53785e] animate-pulse' : 'bg-[#8c7e6c]'
                              }`}
                            />
                            <span className="font-semibold text-xs text-[#2b2621] dark:text-[#f5f2ec] truncate max-w-[130px]">
                              {d.name}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              isHost
                                ? 'bg-[#fdf6ec] dark:bg-[#2b2014] text-[#b3732c] dark:text-[#d48d3b]'
                                : 'bg-[#faf3f0] dark:bg-[#2d1d17] text-[#a05e44] dark:text-[#deb09d]'
                            }`}
                          >
                            {isHost ? 'Host' : 'Camera'}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-[#8c7e6c] dark:text-[#a69c8e]">
                          <span className="font-mono text-[10px]">
                            {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                          </span>
                          {dist !== null && (
                            <span className="font-bold text-[#a05e44] dark:text-[#deb09d] font-mono">
                              {formatDistance(dist)} away
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Offline Math & Topology Diagnostics */}
            <div className="bg-white dark:bg-[#201c19] border border-[#e7dfd3] dark:border-[#332b25] rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-[#2b2621] dark:text-[#f5f2ec]">
                <Compass className="w-4 h-4 text-[#a05e44]" />
                <h4 className="font-serif font-bold text-sm">Topology Diagnostics</h4>
              </div>

              <div className="text-xs text-[#6e6459] dark:text-[#a69c8e] space-y-2">
                <div className="flex justify-between py-1 border-b border-[#f0ebe1] dark:border-[#2d2520]">
                  <span>P2P Data Channels:</span>
                  <span className="font-mono font-semibold text-[#53785e] dark:text-[#699777]">
                    {connectedCount} peer connections
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f0ebe1] dark:border-[#2d2520]">
                  <span>Distance Calculation:</span>
                  <span className="font-mono font-semibold text-[#2b2621] dark:text-[#f5f2ec]">
                    Haversine Spherical Formula
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f0ebe1] dark:border-[#2d2520]">
                  <span>Bearing Resolution:</span>
                  <span className="font-mono font-semibold text-[#2b2621] dark:text-[#f5f2ec]">
                    360° Great Circle
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>External Maps API:</span>
                  <span className="font-semibold text-[#53785e] dark:text-[#699777]">
                    0 (Removed / Completely Offline)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HostLayout>
  );
}
