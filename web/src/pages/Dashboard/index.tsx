import { useEffect, useState } from 'react';
import { LogoMark } from '../../components/Logo';
import { SystemCards } from './components/SystemCards';
import { ThemeToggle } from '../../components/ThemeToggle';

export default function Dashboard() {
  const [health, setHealth] = useState<{ status: string; db: string } | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [echoMessage, setEchoMessage] = useState<string>('');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() => setHealth({ status: 'error', db: 'unreachable' }));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setWsStatus('connected');
      socket.send(JSON.stringify({ type: 'ping' }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') {
          setEchoMessage('WS round-trip verified (pong received)');
        }
      } catch {
        setEchoMessage(`Echo: ${event.data}`);
      }
    };

    socket.onclose = () => setWsStatus('disconnected');
    socket.onerror = () => setWsStatus('disconnected');

    return () => socket.close();
  }, []);

  return (
    <div className="min-h-screen bg-[#fbf9f5] dark:bg-[#161412] text-sand-900 dark:text-sand-100 flex flex-col items-center justify-center p-6 selection:bg-terracotta-600 selection:text-white transition-colors duration-200 relative">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full bg-[#fbf9f5] dark:bg-[#1a1715] border border-[#e2dcce] dark:border-[#332b25] rounded-3xl p-8 shadow-xl shadow-[#201a15]/5 space-y-6">
        <div className="text-center space-y-2">
          <LogoMark variant="terracotta" className="w-14 h-14 mx-auto mb-2" />
          <h1 className="text-2xl font-serif font-bold tracking-tight text-sand-900 dark:text-sand-100">Gather Console</h1>
          <p className="text-xs text-sand-500 dark:text-sand-400">Local service connectivity & quick navigation</p>
        </div>

        <SystemCards health={health} wsStatus={wsStatus} echoMessage={echoMessage} />
      </div>
    </div>
  );
}
