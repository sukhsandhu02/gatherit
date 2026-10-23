import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  QrCode,
  Smartphone,
  LayoutGrid,
  Share2,
  ShieldCheck,
  Download,
  UserCheck,
  KeyRound,
  UploadCloud,
  Heart,
  Music,
  Building2,
  PartyPopper,
  Check,
  Aperture,
  Siren,
  Radio,
  MapPin,
  Waves,
  Video,
  BellRing,
} from 'lucide-react';
import { PhoneMockup } from './components/PhoneMockup';
import { Reveal } from './components/Reveal';
import { LogoMark } from '../../components/Logo';
import { ThemeToggle } from '../../components/ThemeToggle';

const ACCENT = 'bg-brand-600 text-white';

const features = [
  {
    icon: LayoutGrid,
    title: 'Live camera wall',
    desc: 'Watch every guest camera at once. Tap any feed to boost it to a higher frame rate.',
    span: 'lg:col-span-2',
    tone: 'bg-slate-950 text-white',
    iconTone: 'bg-brand-500 text-white',
    sub: 'text-slate-400',
  },
  {
    icon: Share2,
    title: 'You choose who sees what',
    desc: 'Keep shots host-only, share with specific guests, or publish to everyone.',
    span: '',
    tone: 'bg-brand-600 text-white',
    iconTone: 'bg-white text-brand-600',
    sub: 'text-brand-100',
  },
  {
    icon: UploadCloud,
    title: 'Uploads that survive bad signal',
    desc: 'Photos are shrunk on the phone and sent in the background, so the shutter never freezes.',
    span: '',
    tone: 'bg-white text-slate-900 border border-slate-200',
    iconTone: 'bg-slate-900 text-white',
    sub: 'text-slate-500',
  },
  {
    icon: UserCheck,
    title: 'Approval & guest control',
    desc: 'Close joining, require approval, ban a guest, or delete a photo in one click.',
    span: '',
    tone: 'bg-white text-slate-900 border border-slate-200',
    iconTone: 'bg-slate-900 text-white',
    sub: 'text-slate-500',
  },
  {
    icon: Download,
    title: 'Full-resolution keepsakes',
    desc: 'Guests save what you share in original quality. Hosts export whole folders.',
    span: 'lg:col-span-2',
    tone: 'bg-brand-50 text-slate-900',
    iconTone: 'bg-brand-600 text-white',
    sub: 'text-slate-600',
  },
];

const steps = [
  { n: '01', icon: QrCode, title: 'Create your event', desc: 'Name it, set a host password, and get one QR code for the whole event.' },
  { n: '02', icon: Smartphone, title: 'Guests scan & shoot', desc: 'No app to install. Guests join with their phone number and start capturing.' },
  { n: '03', icon: Aperture, title: 'Curate & share', desc: 'Browse everything by guest folder, pick the best, and release it to who you want.' },
];

const useCases = [
  {
    icon: Heart,
    title: 'Weddings & receptions',
    desc: 'A QR on every table card turns guests into your candid photographers.',
    img: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
  },
  {
    icon: Music,
    title: 'College fests & concerts',
    desc: 'Stream crowd angles into one control wall and moderate in real time.',
    img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
  },
  {
    icon: Building2,
    title: 'Corporate & convocations',
    desc: 'Approval-gated joining and per-request access checks keep media private.',
    img: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80',
  },
  {
    icon: PartyPopper,
    title: 'Parties & reunions',
    desc: 'Everyone shoots, one album. No more chasing photos across group chats.',
    img: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80',
  },
];

const alertSteps = [
  { icon: Video, t: 'Someone on the ground goes live', d: 'A resident, volunteer or officer scans the QR and streams what is happening: water level, blocked roads, damage.' },
  { icon: BellRing, t: 'Everyone nearby is alerted', d: 'Command pushes a warning to every phone that has joined, with the live feed attached.' },
  { icon: MapPin, t: 'Clear guidance to get to safety', d: 'Share an evacuation video, a safe-zone location and instructions that reach people instantly.' },
];

export default function LandingPage() {
  const [joinCode, setJoinCode] = useState('');
  const joinInputRef = useRef<HTMLInputElement | null>(null);

  // Accepts a bare event code/slug or a full invite link (.../e/<slug>)
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = joinCode.trim();
    if (!raw) return;
    const match = raw.match(/\/e\/([^/?#\s]+)/);
    const slug = match ? match[1] : raw.replace(/^\/+|\/+$/g, '');
    if (slug) window.location.href = `/e/${encodeURIComponent(slug)}`;
  };

  // Users redirected here from /cam without a session land on the join box
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('join')) {
      document.getElementById('join')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      joinInputRef.current?.focus();
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f4ee] dark:bg-[#090b0e] text-slate-900 dark:text-slate-100 font-sans selection:bg-brand-600 selection:text-white overflow-x-hidden transition-colors duration-200">
      {/* Nav */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#f6f4ee]/80 dark:bg-[#090b0e]/80 border-b border-transparent dark:border-slate-800/60 g-hero-in">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-4">
          <a href="/" className="flex items-center gap-2">
            <LogoMark className="w-8 h-8" />
            <span className="font-serif font-black text-xl tracking-tight text-slate-900 dark:text-white">gather</span>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-400">
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition">Features</a>
            <a href="#how" className="hover:text-slate-900 dark:hover:text-white transition">How it works</a>
            <a href="#events" className="hover:text-slate-900 dark:hover:text-white transition">Events</a>
            <a href="#emergency" className="hover:text-slate-900 dark:hover:text-white transition">Emergency</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="#join" className="hidden sm:inline-block whitespace-nowrap text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2">
              Join an event
            </a>
            <a href="/dash" className="hidden sm:inline-block text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2">
              Console
            </a>
            <a href="/host/setup" className="text-sm font-semibold bg-slate-900 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-500 text-white px-5 py-2.5 rounded-full transition-colors duration-200 shadow-xs">
              Host an event
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-5 pt-10 pb-20 lg:pt-16 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="g-hero-in inline-flex items-center gap-2 text-xs font-semibold bg-white border border-slate-200 rounded-full pl-1.5 pr-3 py-1" style={{ animationDelay: '100ms' }}>
              <span className={`${ACCENT} rounded-full px-2 py-0.5`}>New</span>
              One QR code. Every guest a camera.
            </span>
            <h1 className="g-hero-in mt-6 text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.02]" style={{ animationDelay: '220ms' }}>
              Every angle of the moment,{' '}
              <span className="font-serif italic font-black relative whitespace-nowrap">
                <span className="absolute inset-x-0 bottom-1 h-4 bg-brand-200 -z-10 -rotate-1" />
                in one place.
              </span>
            </h1>
            <p className="g-hero-in mt-6 text-lg text-slate-600 max-w-lg leading-relaxed" style={{ animationDelay: '340ms' }}>
              Guests scan a QR code and shoot photos and live video from their own phones. For weddings, fests and
              convocations you curate the best. In an emergency, one person's live feed can warn everyone nearby.
            </p>
            <div className="g-hero-in mt-8 flex flex-col sm:flex-row gap-3" style={{ animationDelay: '460ms' }}>
              <a
                href="/host/setup"
                className="group inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-brand-600 text-white font-semibold px-7 py-4 rounded-full transition-colors duration-200"
              >
                Create your event <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#emergency"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 font-semibold px-7 py-4 rounded-full transition"
              >
                <Siren className="w-4 h-4 text-red-500" /> Emergency mode
              </a>
            </div>
            <form
              id="join"
              onSubmit={handleJoin}
              className="g-hero-in mt-4 flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-5 pr-1.5 py-1.5 max-w-md scroll-mt-24"
              style={{ animationDelay: '520ms' }}
            >
              <input
                ref={joinInputRef}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Have an event code or link? Join here"
                aria-label="Event code or invite link"
                className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 bg-slate-900 hover:bg-brand-600 disabled:opacity-40 disabled:hover:bg-slate-900 text-white text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-full transition-colors duration-200 cursor-pointer"
              >
                Join event <ArrowRight className="w-4 h-4" />
              </button>
            </form>
            <ul className="g-hero-in mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600" style={{ animationDelay: '580ms' }}>
              {['No app to install', 'Works on any phone', 'Host-controlled privacy'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-brand-600" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Visual */}
          <div className="relative flex justify-center lg:justify-end g-pop" style={{ animationDelay: '300ms' }}>
            <div className="g-blob absolute -z-0 top-6 right-4 lg:right-10 w-[300px] sm:w-[380px] h-[420px] sm:h-[500px] bg-brand-600" />
            <div className="relative z-10 lg:mr-16 g-float" style={{ ['--r' as string]: '0deg' }}>
              <PhoneMockup />
            </div>

            <div className="g-float absolute z-20 left-0 sm:left-4 top-16 bg-white rounded-2xl shadow-xl border border-slate-100 p-3.5 flex items-center gap-3" style={{ ['--r' as string]: '-3deg', animationDelay: '0.4s' }}>
              <span className="w-9 h-9 rounded-xl bg-slate-900 text-brand-300 flex items-center justify-center">
                <LayoutGrid className="w-4 h-4" />
              </span>
              <div>
                <p className="text-xs font-bold leading-tight">Live camera wall</p>
                <p className="text-[11px] text-slate-500">24 guests streaming</p>
              </div>
            </div>

            <div className="g-float absolute z-20 right-0 sm:right-2 top-1/2 bg-slate-900 text-white rounded-2xl shadow-xl p-3.5 flex items-center gap-3" style={{ ['--r' as string]: '3deg', animationDelay: '1.2s' }}>
              <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Share2 className="w-4 h-4 text-brand-300" />
              </span>
              <div>
                <p className="text-xs font-bold leading-tight">Shared with Everyone</p>
                <p className="text-[11px] text-slate-400">12 photos just released</p>
              </div>
            </div>

            <div className="g-float absolute z-20 left-2 sm:left-10 bottom-10 bg-white rounded-full shadow-xl border border-slate-100 pl-3 pr-4 py-2 flex items-center gap-2 text-xs font-semibold" style={{ animationDelay: '2s' }}>
              <UploadCloud className="w-4 h-4 text-brand-600" /> Uploading 3 photos…
            </div>
          </div>
        </section>

        {/* Event marquee */}
        <section className="border-y border-slate-200 bg-white/60 overflow-hidden">
          <div className="flex w-max g-marquee py-5 text-sm font-semibold text-slate-500">
            {[0, 1].map((k) => (
              <div key={k} className="flex items-center gap-12 pr-12" aria-hidden={k === 1}>
                {['Weddings', 'College fests', 'Concerts', 'Convocations', 'Corporate galas', 'Reunions', 'Flood response', 'Tsunami alerts', 'Relief camps'].map((e) => (
                  <span key={e} className="flex items-center gap-12 whitespace-nowrap">
                    {e}
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Features bento */}
        <section id="features" className="max-w-6xl mx-auto px-5 py-24">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-bold text-brand-600">Features</p>
            <h2 className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Everything the host needs. <span className="font-serif italic">Nothing</span> the guests have to learn.
            </h2>
          </Reveal>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 90} className={f.span}>
                <div className={`h-full rounded-[2rem] p-7 flex flex-col justify-between min-h-[240px] hover:-translate-y-1 hover:shadow-xl transition duration-300 ${f.tone}`}>
                  <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${f.iconTone}`}>
                    <f.icon className="w-5 h-5" />
                  </span>
                  <div className="mt-10">
                    <h3 className="text-xl font-bold tracking-tight">{f.title}</h3>
                    <p className={`mt-2 text-sm leading-relaxed max-w-md ${f.sub}`}>{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-slate-950 text-white">
          <div className="max-w-6xl mx-auto px-5 py-24">
            <Reveal>
              <p className="text-sm font-bold text-brand-300">How it works</p>
              <h2 className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-tight max-w-2xl leading-tight">
                From setup to full album in <span className="font-serif italic text-brand-300">three steps</span>.
              </h2>
            </Reveal>
            <div className="mt-14 grid md:grid-cols-3 gap-5">
              {steps.map((s, i) => (
                <Reveal key={s.n} delay={i * 120}>
                  <div className="h-full rounded-[2rem] border border-white/10 bg-white/5 p-7 hover:bg-white/10 hover:border-brand-400/40 transition duration-300">
                    <div className="flex items-center justify-between">
                      <span className="w-11 h-11 rounded-2xl bg-brand-500 text-white flex items-center justify-center">
                        <s.icon className="w-5 h-5" />
                      </span>
                      <span className="font-serif text-4xl font-black text-white/15">{s.n}</span>
                    </div>
                    <h3 className="mt-8 text-xl font-bold">{s.title}</h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section id="events" className="max-w-6xl mx-auto px-5 py-24">
          <Reveal className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-sm font-bold text-brand-600">Events</p>
              <h2 className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                Built for the moments you can't redo.
              </h2>
            </div>
            <a href="/host/setup" className="group inline-flex items-center gap-2 font-semibold text-sm">
              Start your event <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </Reveal>
          <div className="mt-12 grid sm:grid-cols-2 gap-5">
            {useCases.map((u, i) => (
              <Reveal key={u.title} delay={(i % 2) * 120}>
                <article className="group relative rounded-[2rem] overflow-hidden min-h-[320px] flex">
                  <img
                    src={u.img}
                    alt={u.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
                  <div className="relative mt-auto p-7 text-white">
                    <span className={`inline-flex w-10 h-10 rounded-xl ${ACCENT} items-center justify-center`}>
                      <u.icon className="w-5 h-5" />
                    </span>
                    <h3 className="mt-4 text-2xl font-bold tracking-tight">{u.title}</h3>
                    <p className="mt-1 text-sm text-slate-200 max-w-sm">{u.desc}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Emergency */}
        <section id="emergency" className="px-3 sm:px-5 pb-24">
          <div className="max-w-6xl mx-auto rounded-[2.5rem] bg-slate-950 text-white overflow-hidden relative">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-red-500/20 blur-3xl pointer-events-none" />
            <div className="relative grid lg:grid-cols-2 gap-12 p-8 sm:p-14 items-center">
              <div>
                <Reveal>
                  <span className="inline-flex items-center gap-2 text-xs font-bold bg-red-500/15 text-red-300 border border-red-400/30 rounded-full px-3 py-1">
                    <span className="relative flex w-2 h-2">
                      <span className="g-ping absolute inset-0 rounded-full bg-red-400" />
                      <span className="relative w-2 h-2 rounded-full bg-red-400" />
                    </span>
                    Emergency mode · coming soon
                  </span>
                  <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
                    When a <span className="font-serif italic text-red-300">tsunami</span> hits, the first phone to go live can save the rest.
                  </h2>
                  <p className="mt-5 text-slate-400 leading-relaxed max-w-lg">
                    The same QR-and-browser setup works for floods, cyclones and coastal warnings. People on the ground
                    stream what they see, and command gets one live wall. Alerts and evacuation videos go straight to
                    every phone in the area.
                  </p>
                </Reveal>
                <div className="mt-8 space-y-4">
                  {alertSteps.map((a, i) => (
                    <Reveal key={a.t} delay={i * 110}>
                      <div className="flex gap-4">
                        <span className="shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-red-300">
                          <a.icon className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="font-bold">{a.t}</h3>
                          <p className="text-sm text-slate-400 leading-relaxed">{a.d}</p>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>

              {/* Alert mock */}
              <Reveal delay={150} className="flex justify-center">
                <div className="w-full max-w-sm rounded-[2rem] bg-slate-900 border border-white/10 p-4 shadow-2xl">
                  <div className="rounded-2xl bg-red-500 p-4 flex items-start gap-3 animate-pulse">
                    <Siren className="w-6 h-6 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold tracking-wider opacity-90">TSUNAMI WARNING</p>
                      <p className="font-bold leading-tight">Move to higher ground now</p>
                    </div>
                  </div>

                  <div className="mt-3 relative rounded-2xl overflow-hidden aspect-video">
                    <img
                      src="https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80"
                      alt="Live footage of rising coastal water"
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-bold">
                      <Radio className="w-3 h-3 text-red-400" /> LIVE · Beach Road
                    </span>
                    <span className="absolute bottom-2.5 left-2.5 text-xs font-semibold flex items-center gap-1.5">
                      <Waves className="w-3.5 h-3.5 text-brand-300" /> Water rising fast
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                      <p className="text-slate-400">Nearest safe zone</p>
                      <p className="mt-0.5 font-bold flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-brand-300" /> 1.2 km NE</p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                      <p className="text-slate-400">Evacuation video</p>
                      <p className="mt-0.5 font-bold flex items-center gap-1"><Video className="w-3.5 h-3.5 text-brand-300" /> Watch route</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="max-w-6xl mx-auto px-5 pb-24">
          <div className="rounded-[2.5rem] bg-white border border-slate-200 p-8 sm:p-12 grid md:grid-cols-3 gap-8">
            {[
              { icon: ShieldCheck, t: 'Checked on every request', d: 'Access to each photo is verified server-side every time, so revoking a guest takes effect instantly.' },
              { icon: KeyRound, t: 'Host-only password', d: 'Your dashboard, gallery and live wall sit behind a host password with rate-limited sign-in.' },
              { icon: UserCheck, t: 'Temporary guest codes', d: 'A guest forgot their password? Issue a one-time code instead of resetting anything.' },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 100}>
                <span className="w-11 h-11 rounded-2xl bg-slate-900 text-brand-300 flex items-center justify-center">
                  <x.icon className="w-5 h-5" />
                </span>
                <h3 className="mt-5 font-bold text-lg">{x.t}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{x.d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-5 pb-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-600 text-white px-8 py-16 sm:py-20 text-center">
              <div className="g-blob absolute -left-16 -bottom-24 w-72 h-72 bg-brand-500/60" />
              <div className="g-blob absolute -right-10 -top-20 w-60 h-60 bg-brand-400/40" />
              <h2 className="relative text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] max-w-3xl mx-auto">
                Your people are already there. <span className="font-serif italic">Let them gather.</span>
              </h2>
              <p className="relative mt-5 text-brand-100 max-w-md mx-auto">Set up your event in a minute and print the QR code.</p>
              <a
                href="/host/setup"
                className="group relative mt-8 inline-flex items-center gap-2 bg-white hover:bg-slate-900 hover:text-white text-slate-900 font-semibold px-8 py-4 rounded-full transition-colors duration-200"
              >
                Create your event <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <span className="flex items-center gap-2 font-serif font-black text-slate-900">
            <LogoMark className="w-6 h-6" /> gather
          </span>
          <div className="flex items-center gap-6 font-medium">
            <a href="/host/setup" className="hover:text-slate-900">Host setup</a>
            <a href="/host/live" className="hover:text-slate-900">Live wall</a>
            <a href="/dash" className="hover:text-slate-900">Console</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
