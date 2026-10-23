import { Hourglass, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GuestWaitingPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-[390px] w-full bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-xl shadow-slate-200/50">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center mx-auto shadow-xs">
          <Hourglass className="w-8 h-8 animate-pulse text-slate-700" />
        </div>

        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900">
            Waiting for the host
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            You'll get in as soon as the host approves your join request. Keep this page open.
          </p>
        </div>

        {/* Subtle animated dots row */}
        <div className="flex justify-center space-x-2 py-2">
          <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
