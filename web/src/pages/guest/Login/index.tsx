import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { LogoMark } from '../../../components/Logo';
import { LoginForm } from './components/LoginForm';
import { api, setGuestToken } from '../../../lib/api';

export default function GuestLoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setError(null);
    setLoading(true);

    try {
      const data = await api(`/api/events/${slug}/login`, {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      });

      if (data.token) {
        setGuestToken(data.token);
      }

      if (data.guest.status === 'pending') {
        navigate('/waiting');
      } else {
        window.location.href = '/cam';
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-4 selection:bg-brand-600 selection:text-white">
      <div className="max-w-[390px] w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
        <div className="text-center space-y-1.5">
          <LogoMark className="w-12 h-12 mx-auto mb-1" />
          <h1 className="text-2xl font-serif font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="text-xs text-slate-500">Sign in to view photos shared with you</p>
        </div>

        {error && (
          <div className="flex items-center space-x-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <LoginForm
          phone={phone}
          setPhone={setPhone}
          password={password}
          setPassword={setPassword}
          loading={loading}
          onSubmit={handleSubmit}
          slug={slug || ''}
        />
      </div>
    </div>
  );
}
