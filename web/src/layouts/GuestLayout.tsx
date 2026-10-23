import { NavLink } from 'react-router-dom';
import { Camera, Radio, Image, User } from 'lucide-react';
import { GuestTalkButton } from '../components/GuestTalkButton';

interface GuestLayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  fullScreen?: boolean;
}

export function GuestLayout({ children, hideNav = false, fullScreen = false }: GuestLayoutProps) {
  return (
    <div className={`bg-slate-900 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden ${
      fullScreen ? 'h-[100dvh] max-h-[100dvh] overflow-hidden fixed inset-0' : 'min-h-screen'
    }`}>
      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col relative w-full max-w-md mx-auto ${
        fullScreen ? 'h-full max-h-full pb-16 overflow-hidden' : 'pb-16'
      }`}>
        {children}
      </main>

      {/* Mobile Bottom Tab Bar */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-md border-t border-slate-800">
          <div className="max-w-md mx-auto h-16 flex items-center justify-around px-2">
            <NavLink
              to="/cam"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center space-y-1 transition px-2 ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`
              }
            >
              <Camera className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-wide">Camera</span>
            </NavLink>

            <NavLink
              to="/live"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center space-y-1 transition px-2 ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`
              }
            >
              <div className="relative">
                <Radio className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              </div>
              <span className="text-[10px] font-medium tracking-wide">Live</span>
            </NavLink>

            <NavLink
              to="/album"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center space-y-1 transition px-2 ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`
              }
            >
              <Image className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-wide">Gallery</span>
            </NavLink>

            <NavLink
              to="/me"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center space-y-1 transition ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`
              }
            >
              <User className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-wide">Me</span>
            </NavLink>
          </div>
        </nav>
      )}

      {!hideNav && <GuestTalkButton />}
    </div>
  );
}
