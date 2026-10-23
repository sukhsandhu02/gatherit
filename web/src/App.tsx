import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { MeshProvider } from './lib/p2p/MeshContext';
import { MeshModal } from './components/p2p/MeshModal';
import { EmergencyBroadcastBanner } from './components/EmergencyBroadcastBanner';
import { ThemeProvider } from './context/ThemeContext';

// Lazy load remaining pages
const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const HostSetup = lazy(() => import('./pages/HostSetup'));
const HostOverviewPage = lazy(() => import('./pages/host/Overview'));
const HostEventPage = lazy(() => import('./pages/host/Event'));
const HostSettingsPage = lazy(() => import('./pages/host/Settings'));
const HostSharingPage = lazy(() => import('./pages/host/Sharing'));
const HostAnalyticsPage = lazy(() => import('./pages/host/Analytics'));
const HostGuestsPage = lazy(() => import('./pages/host/Guests'));
const HostLivePage = lazy(() => import('./pages/host/Live'));
const HostWalkieTalkiePage = lazy(() => import('./pages/host/WalkieTalkie'));
const HostDeviceMapPage = lazy(() => import('./pages/host/DeviceMap'));
const HostGalleryPage = lazy(() => import('./pages/host/Gallery'));
const PublicEventPage = lazy(() => import('./pages/PublicEvent'));
const StatusPage = lazy(() => import('./pages/Status'));
import GuestCameraPage from './pages/guest/Camera';
import GuestLivePage from './pages/guest/Live';
import GuestGalleryPage from './pages/guest/Gallery';
import GuestMePage from './pages/guest/Me';

const GuestJoinPage = lazy(() => import('./pages/guest/Join'));
const GuestLoginPage = lazy(() => import('./pages/guest/Login'));
const GuestWaitingPage = lazy(() => import('./pages/guest/Waiting'));
const GuestViewerPage = lazy(() => import('./pages/guest/Gallery/components/Viewer'));
const GuestSharedViewPage = lazy(() => import('./pages/guest/SharedView'));

function RouteLoading() {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090b0e] flex items-center justify-center p-6 text-slate-400 text-xs">
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <MeshProvider>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Landing Page */}
            <Route path="/" element={<Landing />} />
            <Route path="/dash" element={<Dashboard />} />
            <Route path="/status" element={<StatusPage />} />

            {/* Public event page */}
            <Route path="/e/:slug" element={<PublicEventPage />} />

            {/* Host Pages */}
            <Route path="/host/setup" element={<HostSetup />} />
            <Route path="/host" element={<HostOverviewPage />} />
            <Route path="/host/event" element={<HostEventPage />} />
            <Route path="/host/settings" element={<HostSettingsPage />} />
            <Route path="/host/sharing" element={<HostSharingPage />} />
            <Route path="/host/analytics" element={<HostAnalyticsPage />} />
            <Route path="/host/guests" element={<HostGuestsPage />} />
            <Route path="/host/live" element={<HostLivePage />} />
            <Route path="/host/walkie-talkie" element={<HostWalkieTalkiePage />} />
            <Route path="/host/map" element={<HostDeviceMapPage />} />
            <Route path="/host/gallery" element={<HostGalleryPage />} />

            {/* Guest Pages */}
            <Route path="/e/:slug/join" element={<GuestJoinPage />} />
            <Route path="/e/:slug/login" element={<GuestLoginPage />} />
            <Route path="/waiting" element={<GuestWaitingPage />} />
            <Route path="/cam" element={<GuestCameraPage />} />
            <Route path="/live" element={<GuestLivePage />} />
            <Route path="/album" element={<GuestGalleryPage />} />
            <Route path="/album/:id" element={<GuestViewerPage />} />
            <Route path="/me" element={<GuestMePage />} />

            {/* Public Guest Share Links */}
            <Route path="/s/:shareSlug" element={<GuestSharedViewPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <MeshModal />
        <EmergencyBroadcastBanner />
      </MeshProvider>
    </BrowserRouter>
  </ThemeProvider>
  );
}
