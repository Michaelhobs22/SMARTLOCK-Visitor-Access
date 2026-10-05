import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Copy, DoorOpen, ExternalLink, LayoutDashboard, LockKeyhole, Plus, QrCode, ShieldCheck, UserRoundPlus, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

type AccessType = 'standard' | 'premium';
type PassStatus = 'active' | 'used' | 'revoked';
type DisplayPassStatus = PassStatus | 'expired';
type AccessPass = {
  id: string;
  visitorName: string;
  unit: string;
  accessType: AccessType;
  token: string;
  createdAt: string;
  expiresAt: string;
  status: PassStatus;
};

const STORAGE_KEY = 'smartlock-access-passes';
const queryClient = new QueryClient();

function makeToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function createPass(visitorName: string, unit: string, accessType: AccessType): AccessPass {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + (accessType === 'premium' ? 48 : 12) * 60 * 60 * 1000);
  return {
    id: `pass-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    visitorName: visitorName.trim(),
    unit: unit.trim().toUpperCase(),
    accessType,
    token: makeToken(),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'active',
  };
}

function seedPasses(): AccessPass[] {
  const now = Date.now();
  return [
    { ...createPass('Maya Chen', '4B', 'premium'), id: 'seed-maya', token: 'MAYA4B8A21D4', createdAt: new Date(now - 1000 * 60 * 42).toISOString(), expiresAt: new Date(now + 1000 * 60 * 60 * 26).toISOString() },
    { ...createPass('Jon Bell', '4B', 'standard'), id: 'seed-jon', token: 'JON4B2F901A', createdAt: new Date(now - 1000 * 60 * 60 * 19).toISOString(), expiresAt: new Date(now - 1000 * 60 * 60 * 7).toISOString(), status: 'used' },
    { ...createPass('Ari Patel', '4B', 'standard'), id: 'seed-ari', token: 'ARI4B91C0EF', createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(), expiresAt: new Date(now + 1000 * 60 * 60 * 8).toISOString(), status: 'revoked' },
  ];
}

function loadPasses(): AccessPass[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as AccessPass[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  const seeded = seedPasses();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function formatExpiry(value: string) {
  const date = new Date(value);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatToday() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

function statusFor(pass: AccessPass): DisplayPassStatus {
  if (pass.status === 'active' && new Date(pass.expiresAt).getTime() <= Date.now()) return 'expired';
  return pass.status;
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function AppShell({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  const navItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/guest', label: 'Guest pass', icon: UserRoundPlus },
    { href: '/lock', label: 'Verify access', icon: LockKeyhole },
  ];
  return (
    <div className="app-shell">
      <aside className="side-rail" data-testid="navigation-sidebar">
        <Link href="/" className="brand" data-testid="link-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">SMARTLOCK</span>
        </Link>
        <div className="rail-label">Resident console</div>
        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-link ${currentPath === href ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`}>
              <Icon className="nav-icon" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="rail-status"><span className="status-dot" /><span><strong>Demo mode</strong><br />Passes stay on this device</span></div>
        </div>
      </aside>
      <div className="main-area">
        <header className="mobile-head">
          <Link href="/" className="brand" data-testid="link-mobile-brand">
            <span className="brand-mark" aria-hidden="true" /><span className="brand-name">SMARTLOCK</span>
          </Link>
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={currentPath === href ? 'active' : ''} aria-label={label} data-testid={`link-mobile-${label.toLowerCase().replace(' ', '-')}`}><Icon className="icon" /></Link>)}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

function Overview({ passes, onRevoke }: { passes: AccessPass[]; onRevoke: (id: string) => void }) {
  const [, setLocation] = useLocation();
  const active = passes.filter((pass) => statusFor(pass) === 'active');
  const used = passes.filter((pass) => statusFor(pass) === 'used');
  const recent = [...passes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  return (
    <main className="main-content">
      <div className="top-row reveal">
        <div><div className="eyebrow">{formatToday()} · Unit 4B</div><h1 className="page-title">Your access, at a glance.</h1><p className="page-subtitle">Issue a temporary pass in seconds. Your keys stay yours, and every entry leaves a clear trail.</p></div>
        <button className="button button-accent" onClick={() => setLocation('/guest')} data-testid="button-create-pass"><Plus className="icon" /> Create guest pass</button>
      </div>
      <div className="stat-strip reveal delay-1">
        <div className="stat-card" data-testid="stat-active-passes"><div className="stat-value">{active.length}</div><div className="stat-label">Active passes</div></div>
        <div className="stat-card" data-testid="stat-used-passes"><div className="stat-value">{used.length}</div><div className="stat-label">Used this month</div></div>
        <div className="stat-card" data-testid="stat-entries"><div className="stat-value">{used.length}</div><div className="stat-label">Used passes</div></div>
      </div>
      <div className="overview-grid">
        <section className="panel panel-pad detail-info reveal delay-1">
          <div className="top-row" style={{ marginBottom: 0, alignItems: 'flex-start' }}><div><h2 className="panel-title">Guest passes</h2><p className="panel-kicker">Temporary keys for people you trust.</p></div><Link href="/passes" className="button button-soft" data-testid="link-manage-passes">View all passes <ExternalLink className="icon" /></Link></div>
          <div className="pass-list">
            {recent.length === 0 ? <div className="empty" data-testid="empty-passes"><strong>No guest passes yet</strong>Create one when someone is on their way.</div> : recent.map((pass) => {
              const currentStatus = statusFor(pass);
              return <div className="pass-row" key={pass.id} data-testid={`card-pass-${pass.id}`}>
                <div className="pass-info"><div className="pass-avatar" aria-hidden="true">{initials(pass.visitorName)}</div><div><div className="pass-name" data-testid={`text-visitor-${pass.id}`}>{pass.visitorName}</div><div className="pass-meta">{pass.unit} · Expires {formatExpiry(pass.expiresAt)}</div></div></div>
                <div className="pass-actions"><span className={`badge badge-${currentStatus}`} data-testid={`status-pass-${pass.id}`}>{currentStatus}</span><Link href={`/passes/${pass.id}`} className="button button-quiet" data-testid={`link-manage-pass-${pass.id}`}>Manage <ExternalLink className="icon" /></Link>{currentStatus === 'active' && <button className="button button-quiet" onClick={() => onRevoke(pass.id)} data-testid={`button-revoke-${pass.id}`}><X className="icon" /> Revoke</button>}</div>
              </div>;
              })}
          </div>
        </section>
        <div className="grid" style={{ gap: 20 }}>
          <section className="panel side-card panel-pad reveal delay-2"><div className="eyebrow" style={{ color: 'hsl(76 83% 69%)' }}>The promise</div><h2 className="panel-title" style={{ marginTop: 12, fontSize: 25 }}>Scan. Verify. Enter.</h2><p className="panel-kicker">No keys to copy. No codes to remember. Just a clear, temporary way in.</p><Link href="/lock" className="button button-accent" data-testid="link-open-lock">Open lock verifier <DoorOpen className="icon" /></Link></section>
          <section className="panel panel-pad reveal delay-2"><h2 className="panel-title">Recent activity</h2><div className="activity-list">{recent.slice(0, 3).map((pass) => <div className="activity" key={`activity-${pass.id}`} data-testid={`activity-${pass.id}`}><span className="activity-line" /><div className="activity-copy"><strong>{pass.visitorName}</strong> pass was {statusFor(pass) === 'used' ? 'verified at the entry' : statusFor(pass) === 'revoked' ? 'revoked by you' : statusFor(pass) === 'expired' ? 'expired' : 'issued'}<div className="activity-time">{formatExpiry(pass.createdAt)}</div></div></div>)}</div></section>
        </div>
      </div>
    </main>
  );
}

function PassesPage({ passes, onRevoke }: { passes: AccessPass[]; onRevoke: (id: string) => void }) {
  const sortedPasses = [...passes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return (
    <main className="main-content">
      <div className="top-row reveal">
        <div><div className="eyebrow">Resident console · Pass management</div><h1 className="page-title">Every guest, individually.</h1><p className="page-subtitle">Open a pass to see that visitor’s own QR code, access code, expiry, and controls.</p></div>
        <Link href="/guest" className="button button-accent" data-testid="button-create-pass-from-list"><Plus className="icon" /> Create guest pass</Link>
      </div>
      <section className="panel panel-pad reveal delay-1">
        <div className="pass-list all-passes-list">
          {sortedPasses.length === 0 ? <div className="empty" data-testid="empty-all-passes"><strong>No guest passes yet</strong>Create a pass to generate a visitor-specific QR code.</div> : sortedPasses.map((pass) => {
            const currentStatus = statusFor(pass);
            return <div className="pass-row" key={pass.id} data-testid={`managed-pass-${pass.id}`}>
              <div className="pass-info"><div className="pass-avatar" aria-hidden="true">{initials(pass.visitorName)}</div><div><div className="pass-name">{pass.visitorName}</div><div className="pass-meta">Unit {pass.unit} · {pass.accessType} · Expires {formatExpiry(pass.expiresAt)}</div></div></div>
              <div className="pass-actions"><span className={`badge badge-${currentStatus}`} data-testid={`managed-status-${pass.id}`}>{currentStatus}</span><Link href={`/passes/${pass.id}`} className="button button-quiet" data-testid={`manage-pass-${pass.id}`}>Manage <ExternalLink className="icon" /></Link>{currentStatus === 'active' && <button className="button button-quiet" onClick={() => onRevoke(pass.id)} data-testid={`revoke-pass-${pass.id}`}><X className="icon" /> Revoke</button>}</div>
            </div>;
          })}
        </div>
      </section>
    </main>
  );
}

function PassDetails({ pass, onRevoke, onCopy }: { pass: AccessPass; onRevoke: (id: string) => void; onCopy: (token: string) => void }) {
  const currentStatus = statusFor(pass);
  return (
    <main className="main-content">
      <div className="top-row reveal">
        <div>
          <div className="eyebrow">Individual guest pass · Unit {pass.unit}</div>
          <h1 className="page-title">{pass.visitorName}</h1>
          <p className="page-subtitle">This is the QR code and management page for this visitor’s pass.</p>
        </div>
        <Link href="/passes" className="button button-soft" data-testid="link-back-to-passes">Back to all passes</Link>
      </div>
      <div className="pass-detail-grid">
        <section className="panel panel-pad reveal delay-1">
          <div className="detail-heading">
            <div>
              <div className="eyebrow">Pass status</div>
              <h2 className="panel-title" style={{ marginTop: 8 }}>{pass.visitorName}’s access</h2>
            </div>
            <span className={`badge badge-${currentStatus}`} data-testid={`detail-status-${pass.id}`}>{currentStatus}</span>
          </div>
          <div className="detail-list">
            <div className="detail-row"><span>Visitor</span><strong data-testid={`detail-visitor-${pass.id}`}>{pass.visitorName}</strong></div>
            <div className="detail-row"><span>Unit</span><strong>{pass.unit}</strong></div>
            <div className="detail-row"><span>Access type</span><strong>{pass.accessType === 'premium' ? 'Premium' : 'Standard'}</strong></div>
            <div className="detail-row"><span>Created</span><strong>{formatExpiry(pass.createdAt)}</strong></div>
            <div className="detail-row"><span>Expires</span><strong>{formatExpiry(pass.expiresAt)}</strong></div>
          </div>
          <div className="detail-actions">
            <Link href="/passes" className="button button-soft" data-testid="link-return-overview">Return to all passes</Link>
            {currentStatus === 'active' && <button className="button button-danger" onClick={() => onRevoke(pass.id)} data-testid={`button-detail-revoke-${pass.id}`}><X className="icon" /> Revoke this pass</button>}
          </div>
          {currentStatus !== 'active' && <p className="detail-warning" data-testid={`text-pass-inactive-${pass.id}`}>This pass is {currentStatus} and can no longer be used to enter.</p>}
        </section>
        <section className="panel qr-card detail-qr reveal delay-2" data-testid={`card-pass-qr-${pass.id}`}>
          <div className="eyebrow">SMARTLOCK QR pass</div>
          <h2 className="panel-title" style={{ marginTop: 8 }}>{pass.visitorName}</h2>
          <div className="qr-wrap"><QRCodeSVG value={pass.token} size={220} bgColor="#fffdfa" fgColor="#152332" level="Q" title={`QR access pass for ${pass.visitorName}`} data-testid={`img-pass-qr-${pass.id}`} /></div>
          <div className="token" data-testid={`text-pass-token-${pass.id}`}>{pass.token}</div>
          {currentStatus === 'active' ? <button className="button button-accent" onClick={() => onCopy(pass.token)} data-testid={`button-copy-pass-${pass.id}`}><Copy className="icon" /> Copy access code</button> : <p className="helper" style={{ marginTop: 12 }}>This QR code is no longer active.</p>}
        </section>
      </div>
    </main>
  );
}

function GuestPage({ onCreate, notify }: { onCreate: (name: string, unit: string, type: AccessType) => AccessPass; notify: (message: string) => void }) {
  const [, setLocation] = useLocation();
  const [visitorName, setVisitorName] = useState('');
  const [unit, setUnit] = useState('4B');
  const [accessType, setAccessType] = useState<AccessType>('standard');
  const canGenerate = visitorName.trim().length > 1 && unit.trim().length > 0;
  function generate() {
    if (!canGenerate) return;
    const pass = onCreate(visitorName, unit, accessType);
    notify(`${pass.visitorName}'s QR pass is ready`);
    setLocation(`/passes/${pass.id}`);
  }
  return (
    <main className="main-content">
      <div className="top-row reveal"><div><div className="eyebrow">Guest access</div><h1 className="page-title">Make room for them.</h1><p className="page-subtitle">Create a time-limited QR pass for the front door. Share it once, then let SMARTLOCK handle the rest.</p></div></div>
      <div className="form-layout">
        <section className="panel panel-pad reveal delay-1">
          <div className="eyebrow">01 · Pass details</div><h2 className="panel-title" style={{ marginTop: 8 }}>Who is coming by?</h2>
          <div className="form-stack" style={{ marginTop: 22 }}>
            <div className="field"><label htmlFor="visitor-name">Visitor name</label><input id="visitor-name" value={visitorName} onChange={(event) => setVisitorName(event.target.value)} placeholder="e.g. Sam Rivera" data-testid="input-visitor-name" /></div>
            <div className="field"><label htmlFor="unit-number">Unit</label><input id="unit-number" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. 4B" data-testid="input-unit" /></div>
            <div className="field"><label>Access level</label><div className="option-grid"><button className={`option ${accessType === 'standard' ? 'selected' : ''}`} onClick={() => setAccessType('standard')} data-testid="button-select-standard"><div className="option-title"><span>Standard</span><span className="option-price">12 hours</span></div><div className="option-copy">Free access with a sponsor message.</div></button><button className={`option ${accessType === 'premium' ? 'selected' : ''}`} onClick={() => setAccessType('premium')} data-testid="button-select-premium"><div className="option-title"><span>Premium</span><span className="option-price">48 hours</span></div><div className="option-copy">Skip the sponsor step for longer, uninterrupted access.</div></button></div></div>
            {accessType === 'standard' && <div className="step-card" data-testid="card-sponsor-step"><div className="step-top"><div><div className="step-number">SPONSORED · DEMO</div><h3>Free access, supported by a sponsor.</h3></div><ShieldCheck className="icon" /></div><p>Ad playback is simulated in this demo. Generate the QR pass below to continue.</p></div>}
            <div className="helper">Each pass opens its own QR code and management page. You can revoke it from that page or the overview.</div>
            <button className="button button-primary" onClick={generate} disabled={!canGenerate} data-testid="button-generate-pass">Generate QR pass <QrCode className="icon" /></button>
          </div>
        </section>
        <section className="panel panel-pad pass-help-card reveal delay-2">
          <div className="eyebrow">One visitor, one pass</div>
          <h2 className="panel-title" style={{ marginTop: 8 }}>Your QR appears next.</h2>
          <p className="panel-kicker">As soon as you generate a pass, SMARTLOCK opens that visitor’s individual QR code, access code, expiry, and management controls.</p>
          <Link href="/passes" className="button button-soft" data-testid="link-view-all-passes">View all passes</Link>
        </section>
      </div>
    </main>
  );
}

function LockPage({ onVerify }: { onVerify: (token: string) => { ok: boolean; pass?: AccessPass; reason?: string } }) {
  const [sensorActive, setSensorActive] = useState(false);
  const [token, setToken] = useState('');
  const [result, setResult] = useState<{ ok: boolean; pass?: AccessPass; reason?: string } | null>(null);
  function verify() {
    if (!sensorActive || !token.trim()) return;
    setResult(onVerify(token));
  }
  return (
    <main className="main-content">
      <section className="lock-hero reveal"><div><div className="eyebrow">Entry point · Door 01</div><h1 className="page-title">Verify before you open.</h1><p className="lock-copy">This simulator checks a SMARTLOCK pass against the resident's access list. It does not connect to a physical lock or use your camera.</p></div><div className="sensor-pill">{sensorActive ? 'Sensor active' : 'Sensor idle'}</div></section>
      <div className="lock-grid">
        <section className="panel panel-pad sensor-panel reveal delay-1"><div><div className="eyebrow">01 · Sensor</div><div className={`sensor-graphic ${sensorActive ? 'active' : ''}`}><div className="sensor-core"><LockKeyhole className="icon" /></div></div><div className="sensor-status" data-testid="status-sensor">{sensorActive ? 'Ready for a pass' : 'Sensor is idle'}</div><div className="sensor-detail">Activate the simulated reader to begin.</div></div><button className={`button ${sensorActive ? 'button-soft' : 'button-accent'}`} onClick={() => { setSensorActive((value) => !value); setResult(null); }} data-testid="button-activate-sensor">{sensorActive ? 'Reset sensor' : 'Activate sensor'}</button></section>
        <section className="panel panel-pad verify-panel reveal delay-2"><div className="verify-title"><div className="verify-icon"><QrCode className="icon" /></div><div><div className="eyebrow">02 · Pass check</div><h2 className="panel-title" style={{ marginTop: 3 }}>Enter or paste token</h2></div></div><div className="verify-form"><input aria-label="Pass token" value={token} onChange={(event) => { setToken(event.target.value.toUpperCase()); setResult(null); }} placeholder="SMARTLOCK TOKEN" disabled={!sensorActive} data-testid="input-pass-token" /><button className="button button-primary" onClick={verify} disabled={!sensorActive || !token.trim()} data-testid="button-verify-token">Verify pass <ShieldCheck className="icon" /></button></div><p className="verify-note">For this simulation, use the token from a generated QR pass. A successful verification marks the pass as used and prevents reuse.</p>{result && <div className={`result ${result.ok ? 'granted' : 'denied'}`} data-testid={`status-verification-${result.ok ? 'granted' : 'denied'}`}><ShieldCheck className="icon" /> <div><h3>{result.ok ? 'Access granted' : 'Access denied'}</h3><p>{result.ok ? `${result.pass?.visitorName} · ${result.pass?.unit}. This pass is now marked as used.` : result.reason}</p></div></div>}</section>
      </div>
      <p className="helper" style={{ marginTop: 18, textAlign: 'center' }}><ShieldCheck className="icon" style={{ verticalAlign: 'middle', marginRight: 5 }} /> No camera access. No hardware connection. Just a clear verification flow.</p>
    </main>
  );
}

function RouterApp() {
  const [location] = useLocation();
  const [passes, setPasses] = useState<AccessPass[]>(loadPasses);
  const [toast, setToast] = useState('');
  const passId = location.startsWith('/passes/') ? decodeURIComponent(location.slice('/passes/'.length)) : '';
  const selectedPass = passes.find((pass) => pass.id === passId);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(passes)); }, [passes]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast]);
  const notify = (message: string) => setToast(message);
  const onCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      notify('Access code copied');
    } catch {
      notify('Clipboard unavailable. Select the access code to copy it.');
    }
  };
  const onCreate = (name: string, unit: string, type: AccessType) => {
    const pass = createPass(name, unit, type);
    setPasses((current) => [pass, ...current]);
    return pass;
  };
  const onRevoke = (id: string) => { setPasses((current) => current.map((pass) => pass.id === id ? { ...pass, status: 'revoked' } : pass)); notify('Pass revoked'); };
  const onVerify = (rawToken: string) => {
    const normalized = rawToken.trim().toUpperCase();
    const pass = passes.find((item) => item.token === normalized);
    if (!pass) return { ok: false, reason: 'This token is not recognized by the resident access list.' };
    if (statusFor(pass) === 'revoked') return { ok: false, reason: 'This pass was revoked by the resident.' };
    if (statusFor(pass) === 'expired') return { ok: false, reason: 'This pass has expired.' };
    if (pass.status === 'used') return { ok: false, reason: 'This pass has already been used. Passes are one-time entry keys.' };
    setPasses((current) => current.map((item) => item.id === pass.id ? { ...item, status: 'used' } : item));
    notify('Entry verified');
    return { ok: true, pass: { ...pass, status: 'used' as PassStatus } };
  };
  const page = useMemo(() => <Switch><Route path="/" component={() => <Overview passes={passes} onRevoke={onRevoke} />} /><Route path="/passes" component={() => <PassesPage passes={passes} onRevoke={onRevoke} />} /><Route path="/passes/:id" component={() => selectedPass ? <PassDetails pass={selectedPass} onRevoke={onRevoke} onCopy={onCopy} /> : <NotFound />} /><Route path="/guest" component={() => <GuestPage onCreate={onCreate} notify={notify} />} /><Route path="/lock" component={() => <LockPage onVerify={onVerify} />} /><Route component={NotFound} /></Switch>, [passes, location]);
  return <><AppShell currentPath={location}>{page}</AppShell>{toast && <div className="toast" role="status" data-testid="toast-message">{toast}</div>}</>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary resetKey={window.location.pathname}><RouterApp /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;