import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ClerkProvider, Show, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Copy, DoorOpen, Download, ExternalLink, Info, LayoutDashboard, LockKeyhole, LogOut, Plus, QrCode, RotateCcw, Search, Share2, ShieldCheck, UserRoundPlus, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
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
  notes?: string;
  usedAt?: string;
  revokedAt?: string;
};

const STORAGE_KEY = 'smartlock-access-passes';
const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY for Clerk authentication.');
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#c5f56a',
    colorForeground: '#152332',
    colorMutedForeground: '#697681',
    colorDanger: '#a8342b',
    colorBackground: '#fffdfa',
    colorInput: '#fffdfa',
    colorInputForeground: '#152332',
    colorNeutral: '#d2dae0',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '12px',
  },
  elements: {
    rootBox: { width: '100%', display: 'flex', justifyContent: 'center' },
    cardBox: { width: 'min(440px, 100%)', maxWidth: '100%', backgroundColor: '#fffdfa', border: '1px solid #d2dae0', borderRadius: '18px', boxShadow: '0 18px 48px rgba(21, 35, 50, 0.1)', overflow: 'hidden' },
    card: { backgroundColor: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none' },
    footer: { backgroundColor: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none' },
    headerTitle: { color: '#152332', fontFamily: 'Manrope, sans-serif', fontWeight: 800 },
    headerSubtitle: { color: '#697681' },
    socialButtonsBlockButtonText: { color: '#152332', fontWeight: 700 },
    formFieldLabel: { color: '#152332', fontWeight: 700 },
    footerActionLink: { color: '#253443', fontWeight: 800 },
    footerActionText: { color: '#697681' },
    dividerText: { color: '#697681' },
    identityPreviewEditButton: { color: '#253443' },
    formFieldSuccessText: { color: '#237343' },
    alertText: { color: '#8c302a' },
    logoBox: { borderRadius: '10px', overflow: 'hidden' },
    logoImage: { width: '36px', height: '36px', objectFit: 'cover' },
    socialButtonsBlockButton: { backgroundColor: '#fffdfa', border: '1px solid #d2dae0', borderRadius: '10px', color: '#152332' },
    formButtonPrimary: { backgroundColor: '#152332', borderRadius: '10px', color: '#fffdfa', fontWeight: 800 },
    formFieldInput: { backgroundColor: '#fffdfa', borderColor: '#d2dae0', borderRadius: '10px', color: '#152332' },
    footerAction: { color: '#697681' },
    dividerLine: { backgroundColor: '#d2dae0' },
    alert: { backgroundColor: '#fff2f0', borderColor: '#f0c7c2' },
    otpCodeFieldInput: { backgroundColor: '#fffdfa', borderColor: '#d2dae0', color: '#152332' },
    formFieldRow: { color: '#152332' },
    main: { backgroundColor: 'transparent' },
  },
};

function makeToken(existing: AccessPass[] = []) {
  let token = '';
  do {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    token = `SL-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  } while (existing.some((pass) => pass.token.toUpperCase() === token));
  return token;
}

function createPass(visitorName: string, unit: string, accessType: AccessType, expiresAt: Date, notes: string, existing: AccessPass[]): AccessPass {
  const createdAt = new Date();
  const token = makeToken(existing);
  return {
    id: `pass-${token}`,
    visitorName: visitorName.trim(),
    unit: unit.trim().toUpperCase(),
    accessType,
    token,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'active',
    notes: notes.trim() || undefined,
  };
}

function seedPasses(): AccessPass[] {
  const now = Date.now();
  return [
    { id: 'seed-maya', visitorName: 'Maya Chen', unit: '4B', accessType: 'premium', token: 'MAYA4B8A21D4', createdAt: new Date(now - 1000 * 60 * 42).toISOString(), expiresAt: new Date(now + 1000 * 60 * 60 * 26).toISOString(), status: 'active' },
    { id: 'seed-jon', visitorName: 'Jon Bell', unit: '4B', accessType: 'standard', token: 'JON4B2F901A', createdAt: new Date(now - 1000 * 60 * 60 * 19).toISOString(), expiresAt: new Date(now - 1000 * 60 * 60 * 7).toISOString(), status: 'used', usedAt: new Date(now - 1000 * 60 * 60 * 18).toISOString() },
    { id: 'seed-ari', visitorName: 'Ari Patel', unit: '4B', accessType: 'standard', token: 'ARI4B91C0EF', createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(), expiresAt: new Date(now + 1000 * 60 * 60 * 8).toISOString(), status: 'revoked', revokedAt: new Date(now - 1000 * 60 * 60).toISOString() },
  ];
}

function migratePasses(value: unknown): AccessPass[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AccessPass[] => {
    if (!item || typeof item !== 'object') return [];
    const pass = item as Partial<AccessPass>;
    if (typeof pass.id !== 'string' || typeof pass.visitorName !== 'string' || typeof pass.token !== 'string') return [];
    if (typeof pass.createdAt !== 'string' || typeof pass.expiresAt !== 'string' || !Number.isFinite(Date.parse(pass.expiresAt))) return [];
    return [{
      id: pass.id,
      visitorName: pass.visitorName,
      unit: typeof pass.unit === 'string' ? pass.unit : '',
      accessType: pass.accessType === 'premium' ? 'premium' : 'standard',
      token: pass.token,
      createdAt: pass.createdAt,
      expiresAt: pass.expiresAt,
      status: pass.status === 'used' || pass.status === 'revoked' ? pass.status : 'active',
      notes: typeof pass.notes === 'string' ? pass.notes : undefined,
      usedAt: typeof pass.usedAt === 'string' ? pass.usedAt : undefined,
      revokedAt: typeof pass.revokedAt === 'string' ? pass.revokedAt : undefined,
    }];
  });
}

function loadPasses(): AccessPass[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    try {
      return migratePasses(JSON.parse(stored));
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
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatToday() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

function statusFor(pass: AccessPass, now = Date.now()): DisplayPassStatus {
  if (pass.revokedAt || pass.status === 'revoked') return 'revoked';
  if (pass.usedAt || pass.status === 'used') return 'used';
  if (new Date(pass.expiresAt).getTime() <= now) return 'expired';
  return 'active';
}

function validateAccess(rawCode: string, passes: AccessPass[], now = Date.now()): { ok: true; pass: AccessPass; accessTime: string } | { ok: false; reason: string } {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'Please enter an access code.' };
  const pass = passes.find((item) => item.token.toUpperCase() === code);
  if (!pass) return { ok: false, reason: 'Access denied — invalid visitor credential.' };
  const status = statusFor(pass, now);
  if (status === 'revoked') return { ok: false, reason: 'Access denied — this visitor pass has been revoked.' };
  if (status === 'used') return { ok: false, reason: 'Access denied — this visitor pass has already been used.' };
  if (status === 'expired') return { ok: false, reason: 'Access denied — this visitor pass has expired.' };
  return { ok: true, pass, accessTime: new Date(now).toISOString() };
}

function formatRemaining(expiresAt: string, now: number) {
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) return 'Expired';
  const minutes = Math.floor(remaining / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days) return `${days}d ${hours}h remaining`;
  if (hours) return `${hours}h ${rest}m remaining`;
  return `${rest}m remaining`;
}

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function PublicLandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link href="/" className="brand" data-testid="link-landing-brand"><span className="brand-mark" aria-hidden="true" /><span className="brand-name">SMARTLOCK</span></Link>
        <nav className="landing-nav" aria-label="Account">
          <Link href="/sign-in" className="landing-signin" data-testid="link-landing-sign-in">Sign in</Link>
          <Link href="/sign-up" className="button button-accent" data-testid="link-landing-sign-up">Create account</Link>
        </nav>
      </header>
      <main className="landing-main">
        <section className="landing-copy">
          <div className="eyebrow">RESIDENT ACCESS · MADE SIMPLE</div>
          <h1>Give guests a pass.<br /><span>Keep control.</span></h1>
          <p>Create a unique, time-limited visitor pass, then verify it at a simulated entry reader. Sign in to manage your resident console.</p>
          <div className="landing-actions">
            <Link href="/sign-up" className="button button-accent" data-testid="button-landing-create-account">Create a resident account <ExternalLink className="icon" /></Link>
            <Link href="/sign-in" className="button button-soft" data-testid="button-landing-sign-in">I already have an account</Link>
          </div>
          <div className="landing-assurance"><ShieldCheck className="icon" /><span>Accounts use secure Clerk sign-in. Pass records in this demo remain in the current browser.</span></div>
        </section>
        <aside className="landing-visual" aria-label="SMARTLOCK visitor pass preview">
          <div className="landing-orbit landing-orbit-one" /><div className="landing-orbit landing-orbit-two" />
          <div className="landing-reader"><LockKeyhole className="icon" /><span>SIMULATED READER</span></div>
          <div className="landing-ticket">
            <div className="landing-ticket-head"><span>SMARTLOCK</span><QrCode className="icon" /></div>
            <div className="landing-ticket-label">VISITOR ACCESS PASS</div>
            <div className="landing-ticket-name">One guest. One pass.</div>
            <div className="landing-ticket-code">SL-••••••••••••••••••••</div>
            <div className="landing-ticket-foot"><span>TIME-LIMITED</span><span>ONE USE</span></div>
          </div>
          <div className="landing-visual-caption"><span className="status-dot" /> Access stays clear from issue to entry.</div>
        </aside>
      </main>
      <footer className="landing-footer">This is a demonstration. Visitor passes stay in this browser and do not sync across devices or control a physical lock.</footer>
    </div>
  );
}

function PublicVisitorShell({ children }: { children: ReactNode }) {
  return (
    <div className="visitor-shell">
      <header className="visitor-header">
        <Link href="/" className="brand" data-testid="link-visitor-brand"><span className="brand-mark" aria-hidden="true" /><span className="brand-name">SMARTLOCK</span></Link>
        <div className="visitor-header-actions"><span>Visitor pass</span><Link href="/sign-in" className="visitor-signin" data-testid="link-visitor-sign-in">Resident sign in</Link></div>
      </header>
      <div className="visitor-demo-note">This shared pass page is a demo. Passes are stored in the resident’s browser, so this link may not load on another device.</div>
      {children}
    </div>
  );
}

function AppShell({ children, currentPath, account, onSignOut }: { children: ReactNode; currentPath: string; account: { name: string; email: string; imageUrl?: string | null }; onSignOut: () => void }) {
  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/passes', label: 'Passes', icon: UserRoundPlus },
    { href: '/guest', label: 'Create pass', icon: Plus },
    { href: '/lock', label: 'Smart lock', icon: LockKeyhole },
    { href: '/about', label: 'About', icon: Info },
  ];
  return (
    <div className="app-shell">
      <aside className="side-rail" data-testid="navigation-sidebar">
          <Link href="/dashboard" className="brand" data-testid="link-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">SMARTLOCK</span>
        </Link>
        <div className="rail-label">Resident console</div>
        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-link ${currentPath === href || (href === '/passes' && currentPath.startsWith('/passes/')) ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`}>
              <Icon className="nav-icon" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="rail-account">
            <div className="account-avatar">{account.imageUrl ? <img src={account.imageUrl} alt="" /> : initials(account.name || account.email || 'R')}</div>
            <div className="account-copy"><strong>{account.name || 'Resident'}</strong><span>{account.email}</span></div>
            <button className="account-signout" onClick={onSignOut} aria-label="Sign out" title="Sign out" data-testid="button-sign-out"><LogOut className="icon" /></button>
          </div>
          <div className="rail-status"><span className="status-dot" /><span><strong>Demo mode</strong><br />Passes stay on this device</span></div>
        </div>
      </aside>
      <div className="main-area">
        <header className="mobile-head">
          <Link href="/dashboard" className="brand" data-testid="link-mobile-brand">
            <span className="brand-mark" aria-hidden="true" /><span className="brand-name">SMARTLOCK</span>
          </Link>
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={currentPath === href || (href === '/passes' && currentPath.startsWith('/passes/')) ? 'active' : ''} aria-label={label} title={label} data-testid={`link-mobile-${label.toLowerCase().replace(' ', '-')}`}><Icon className="icon" /></Link>)}
            <button className="mobile-signout" onClick={onSignOut} aria-label="Sign out" title="Sign out" data-testid="button-mobile-sign-out"><LogOut className="icon" /></button>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

function PassRows({ passes, onRevoke, onCopy }: { passes: AccessPass[]; onRevoke: (id: string) => void; onCopy: (token: string) => void }) {
  return (
    <div className="pass-table">
      <div className="pass-table-head" aria-hidden="true"><span>Guest</span><span>Pass type</span><span>Access code</span><span>Status</span><span>Created</span><span>Expires</span><span>Actions</span></div>
      {passes.map((pass) => {
        const currentStatus = statusFor(pass);
        return <div className="pass-table-row" key={pass.id} data-testid={`managed-pass-${pass.id}`}>
          <div className="pass-cell guest-cell" data-label="Guest"><div className="pass-avatar" aria-hidden="true">{initials(pass.visitorName)}</div><div><div className="pass-name">{pass.visitorName}</div><div className="pass-meta">Unit {pass.unit}</div></div></div>
          <div className="pass-cell" data-label="Pass type"><span className={`badge badge-${pass.accessType}`}>{pass.accessType}</span></div>
          <div className="pass-cell code-cell" data-label="Access code"><code>{pass.token}</code><button className="icon-button" onClick={() => onCopy(pass.token)} aria-label={`Copy ${pass.visitorName}'s access code`} title="Copy code" data-testid={`copy-code-${pass.id}`}><Copy className="icon" /></button></div>
          <div className="pass-cell" data-label="Status"><span className={`badge badge-${currentStatus}`} data-testid={`managed-status-${pass.id}`}>{currentStatus}</span></div>
          <div className="pass-cell date-cell" data-label="Created">{formatExpiry(pass.createdAt)}</div>
          <div className="pass-cell date-cell" data-label="Expires">{formatExpiry(pass.expiresAt)}</div>
          <div className="pass-cell row-actions" data-label="Actions"><Link href={`/passes/${pass.id}`} className="button button-quiet" data-testid={`manage-pass-${pass.id}`}>View</Link>{currentStatus === 'active' && <button className="button button-quiet" onClick={() => onRevoke(pass.id)} data-testid={`revoke-pass-${pass.id}`}><X className="icon" /> Revoke</button>}</div>
        </div>;
      })}
    </div>
  );
}

function Overview({ passes, onRevoke, onCopy }: { passes: AccessPass[]; onRevoke: (id: string) => void; onCopy: (token: string) => void }) {
  const [, setLocation] = useLocation();
  const total = passes.length;
  const active = passes.filter((pass) => statusFor(pass) === 'active');
  const used = passes.filter((pass) => statusFor(pass) === 'used');
  const expired = passes.filter((pass) => statusFor(pass) === 'expired');
  const revoked = passes.filter((pass) => statusFor(pass) === 'revoked');
  const recent = [...passes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  return (
    <main className="main-content">
      <div className="top-row reveal">
        <div><div className="eyebrow">{formatToday()} · Unit 4B</div><h1 className="page-title">Your access, at a glance.</h1><p className="page-subtitle">Issue a temporary pass in seconds. Your keys stay yours, and every entry leaves a clear trail.</p></div>
        <button className="button button-accent" onClick={() => setLocation('/guest')} data-testid="button-create-pass"><Plus className="icon" /> Create guest pass</button>
      </div>
      <div className="stat-strip reveal delay-1">
        <div className="stat-card" data-testid="stat-total-passes"><div className="stat-value">{total}</div><div className="stat-label">Total passes</div></div>
        <div className="stat-card" data-testid="stat-active-passes"><div className="stat-value">{active.length}</div><div className="stat-label">Active</div></div>
        <div className="stat-card" data-testid="stat-used-passes"><div className="stat-value">{used.length}</div><div className="stat-label">Used</div></div>
        <div className="stat-card" data-testid="stat-expired-passes"><div className="stat-value">{expired.length}</div><div className="stat-label">Expired</div></div>
        <div className="stat-card" data-testid="stat-revoked-passes"><div className="stat-value">{revoked.length}</div><div className="stat-label">Revoked</div></div>
      </div>
      <div className="overview-grid">
        <section className="panel panel-pad detail-info reveal delay-1">
          <div className="top-row" style={{ marginBottom: 0, alignItems: 'flex-start' }}><div><h2 className="panel-title">Visitor passes</h2><p className="panel-kicker">Guest access, codes, lifecycle status, and expiry.</p></div><Link href="/passes" className="button button-soft" data-testid="link-manage-passes">Filter passes <ExternalLink className="icon" /></Link></div>
          {passes.length === 0 ? <div className="empty" data-testid="empty-passes"><strong>No guest passes yet</strong>Create one when someone is on their way.</div> : <PassRows passes={[...passes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())} onRevoke={onRevoke} onCopy={onCopy} />}
        </section>
        <div className="grid" style={{ gap: 20 }}>
          <section className="panel side-card panel-pad reveal delay-2"><div className="eyebrow" style={{ color: 'hsl(76 83% 69%)' }}>Secure access · simulated</div><h2 className="panel-title" style={{ marginTop: 12, fontSize: 25 }}>Issue. Verify. Enter.</h2><p className="panel-kicker">A single-use visitor code is checked against its status and expiration before access is granted.</p><Link href="/lock" className="button button-accent" data-testid="link-open-lock">Open smart lock <DoorOpen className="icon" /></Link></section>
          <section className="panel panel-pad reveal delay-2"><h2 className="panel-title">Recent activity</h2><div className="activity-list">{recent.slice(0, 3).map((pass) => <div className="activity" key={`activity-${pass.id}`} data-testid={`activity-${pass.id}`}><span className="activity-line" /><div className="activity-copy"><strong>{pass.visitorName}</strong> pass was {statusFor(pass) === 'used' ? 'verified at the entry' : statusFor(pass) === 'revoked' ? 'revoked by you' : statusFor(pass) === 'expired' ? 'expired' : 'issued'}<div className="activity-time">{formatExpiry(pass.createdAt)}</div></div></div>)}</div></section>
        </div>
      </div>
    </main>
  );
}

function PassesPage({ passes, onRevoke, onCopy }: { passes: AccessPass[]; onRevoke: (id: string) => void; onCopy: (token: string) => void }) {
  const [filter, setFilter] = useState<'all' | DisplayPassStatus>('all');
  const [query, setQuery] = useState('');
  const sortedPasses = [...passes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filtered = sortedPasses.filter((pass) => {
    const matchesStatus = filter === 'all' || statusFor(pass) === filter;
    const search = query.trim().toLowerCase();
    return matchesStatus && (!search || pass.visitorName.toLowerCase().includes(search) || pass.token.toLowerCase().includes(search));
  });
  return (
    <main className="main-content">
      <div className="top-row reveal">
        <div><div className="eyebrow">Resident console · Pass management</div><h1 className="page-title">Visitor passes.</h1><p className="page-subtitle">Search, filter, copy, view, or revoke each visitor’s individual pass.</p></div>
        <Link href="/guest" className="button button-accent" data-testid="button-create-pass-from-list"><Plus className="icon" /> Create guest pass</Link>
      </div>
      <section className="panel panel-pad reveal delay-1">
        <div className="pass-filters">
          <label className="search-field"><Search className="icon" /><span className="sr-only">Search guests or access codes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guest or access code" /></label>
          <label className="filter-field"><span className="sr-only">Filter by status</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All statuses</option><option value="active">Active</option><option value="used">Used</option><option value="expired">Expired</option><option value="revoked">Revoked</option></select></label>
        </div>
        {filtered.length === 0 ? <div className="empty" data-testid="empty-all-passes"><strong>{passes.length === 0 ? 'No guest passes yet' : 'No passes match this search'}</strong>{passes.length === 0 ? 'Create a pass to generate a visitor-specific QR code.' : 'Try another guest name, access code, or status.'}</div> : <PassRows passes={filtered} onRevoke={onRevoke} onCopy={onCopy} />}
      </section>
    </main>
  );
}

function PassDetails({ pass, onRevoke, onCopy, onShare, now, canManage }: { pass: AccessPass; onRevoke: (id: string) => void; onCopy: (token: string) => void; onShare: (pass: AccessPass) => void; now: number; canManage: boolean }) {
  const qrRef = useRef<SVGSVGElement>(null);
  const currentStatus = statusFor(pass);
  function downloadQr() {
    if (!qrRef.current) return;
    const source = new XMLSerializer().serializeToString(qrRef.current);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartlock-${pass.visitorName.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-qr.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="main-content">
      <div className="top-row reveal">
        <div>
          <div className="eyebrow">{canManage ? `Individual guest pass · Unit ${pass.unit}` : 'Visitor access pass'}</div>
          <h1 className="page-title">{canManage ? pass.visitorName : 'Your guest pass'}</h1>
          <p className="page-subtitle">{canManage ? 'This is the QR code and management page for this visitor’s pass.' : 'Show this QR code or access code at the simulated entry reader.'}</p>
        </div>
        {canManage && <Link href="/passes" className="button button-soft" data-testid="link-back-to-passes">Back to all passes</Link>}
      </div>
      <div className="pass-detail-grid">
        <section className="panel panel-pad reveal delay-1">
          <div className="detail-heading">
            <div>
              <div className="eyebrow">{canManage ? 'Pass status' : 'Entry status'}</div>
              <h2 className="panel-title" style={{ marginTop: 8 }}>{canManage ? `${pass.visitorName}’s access` : 'Pass details'}</h2>
            </div>
            <span className={`badge badge-${currentStatus}`} data-testid={`detail-status-${pass.id}`}>{currentStatus}</span>
          </div>
          <div className="detail-list">
            <div className="detail-row"><span>Unit</span><strong>{pass.unit}</strong></div>
            {canManage && <div className="detail-row"><span>Visitor</span><strong data-testid={`detail-visitor-${pass.id}`}>{pass.visitorName}</strong></div>}
            {canManage && <div className="detail-row"><span>Access type</span><strong>{pass.accessType === 'premium' ? 'Premium' : 'Standard'}</strong></div>}
            {canManage && <div className="detail-row"><span>Created</span><strong>{formatExpiry(pass.createdAt)}</strong></div>}
            <div className="detail-row"><span>Expires</span><strong>{formatExpiry(pass.expiresAt)}</strong></div>
            {currentStatus === 'active' && <div className="detail-row"><span>Time remaining</span><strong>{formatRemaining(pass.expiresAt, now)}</strong></div>}
            {canManage && pass.usedAt && <div className="detail-row"><span>Used at</span><strong>{formatExpiry(pass.usedAt)}</strong></div>}
            {canManage && pass.revokedAt && <div className="detail-row"><span>Revoked at</span><strong>{formatExpiry(pass.revokedAt)}</strong></div>}
            {canManage && pass.notes && <div className="detail-row"><span>Purpose / notes</span><strong>{pass.notes}</strong></div>}
          </div>
          {canManage && <div className="detail-actions">
            <Link href="/passes" className="button button-soft" data-testid="link-return-overview">Return to all passes</Link>
            {currentStatus === 'active' && <button className="button button-danger" onClick={() => onRevoke(pass.id)} data-testid={`button-detail-revoke-${pass.id}`}><X className="icon" /> Revoke this pass</button>}
          </div>}
          {currentStatus !== 'active' && <p className="detail-warning" data-testid={`text-pass-inactive-${pass.id}`}>This pass is {currentStatus} and can no longer be used to enter.</p>}
        </section>
        <section className="panel qr-card detail-qr reveal delay-2" data-testid={`card-pass-qr-${pass.id}`}>
          <div className="eyebrow">SMARTLOCK QR pass</div>
          <h2 className="panel-title" style={{ marginTop: 8 }}>{canManage ? pass.visitorName : 'Ready for entry'}</h2>
          <div className="qr-wrap"><QRCodeSVG ref={qrRef} value={pass.token} size={220} bgColor="#fffdfa" fgColor="#152332" level="Q" includeMargin title={`QR access pass for ${pass.visitorName}`} data-testid={`img-pass-qr-${pass.id}`} /></div>
          <div className="token" data-testid={`text-pass-token-${pass.id}`}>{pass.token}</div>
          <div className="qr-actions">
            <button className="button button-accent" onClick={() => onCopy(pass.token)} data-testid={`button-copy-pass-${pass.id}`}><Copy className="icon" /> Copy access code</button>
            <button className="button button-soft" onClick={downloadQr} data-testid={`button-download-qr-${pass.id}`}><Download className="icon" /> Download QR</button>
            <button className="button button-soft" onClick={() => onShare(pass)} data-testid={`button-share-pass-${pass.id}`}><Share2 className="icon" /> Share pass</button>
          </div>
          {currentStatus !== 'active' && <p className="helper" style={{ marginTop: 12 }}>This QR code remains available for reference, but the pass is no longer active.</p>}
        </section>
      </div>
    </main>
  );
}

function GuestPage({ onCreate, notify }: { onCreate: (name: string, unit: string, type: AccessType, expiresAt: Date, notes: string) => AccessPass; notify: (message: string) => void }) {
  const [, setLocation] = useLocation();
  const [visitorName, setVisitorName] = useState('');
  const [unit, setUnit] = useState('4B');
  const [accessType, setAccessType] = useState<AccessType>('standard');
  const [duration, setDuration] = useState('4h');
  const [customExpiration, setCustomExpiration] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  function generate() {
    if (!visitorName.trim()) {
      setError('Please enter the guest name.');
      return;
    }
    if (!unit.trim()) {
      setError('Please enter the unit.');
      return;
    }
    const durationMs: Record<string, number> = { '30m': 30 * 60000, '1h': 60 * 60000, '4h': 4 * 60 * 60000, '12h': 12 * 60 * 60000, '24h': 24 * 60 * 60000 };
    const expiresAt = duration === 'custom' ? new Date(customExpiration) : new Date(Date.now() + durationMs[duration]);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      setError('Expiration time must be in the future.');
      return;
    }
    setError('');
    const pass = onCreate(visitorName, unit, accessType, expiresAt, notes);
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
            <div className="field"><label htmlFor="visitor-name">Visitor name</label><input id="visitor-name" value={visitorName} onChange={(event) => { setVisitorName(event.target.value); setError(''); }} placeholder="e.g. Sam Rivera" data-testid="input-visitor-name" /></div>
            <div className="field"><label htmlFor="unit-number">Unit</label><input id="unit-number" value={unit} onChange={(event) => { setUnit(event.target.value); setError(''); }} placeholder="e.g. 4B" data-testid="input-unit" /></div>
            <div className="field"><label>Pass type</label><div className="option-grid"><button type="button" className={`option ${accessType === 'standard' ? 'selected' : ''}`} aria-pressed={accessType === 'standard'} onClick={() => setAccessType('standard')} data-testid="button-select-standard"><div className="option-title"><span>Standard</span><span className="option-price">Sponsor demo</span></div><div className="option-copy">Includes a demonstration sponsor step. No real ad network.</div></button><button type="button" className={`option premium-option ${accessType === 'premium' ? 'selected' : ''}`} aria-pressed={accessType === 'premium'} onClick={() => setAccessType('premium')} data-testid="button-select-premium"><div className="option-title"><span>Premium</span><span className="option-price">Premium demo</span></div><div className="option-copy">Visually distinct pass type; skips the sponsor demonstration. No payment is taken.</div></button></div></div>
            {accessType === 'standard' && <div className="step-card" data-testid="card-sponsor-step"><div className="step-top"><div><div className="step-number">SPONSOR STEP · DEMONSTRATION ONLY</div><h3>Standard pass sponsor message</h3></div><ShieldCheck className="icon" /></div><p>This project demonstrates a sponsor-supported flow. No advertisement is played or verified.</p></div>}
            <div className="field"><label htmlFor="pass-duration">Access duration</label><select id="pass-duration" value={duration} onChange={(event) => setDuration(event.target.value)} data-testid="select-expiration"><option value="30m">30 minutes</option><option value="1h">1 hour</option><option value="4h">4 hours</option><option value="12h">12 hours</option><option value="24h">24 hours</option><option value="custom">Custom expiration</option></select></div>
            {duration === 'custom' && <div className="field"><label htmlFor="custom-expiration">Custom expiration date and time</label><input id="custom-expiration" type="datetime-local" min={localDateTimeValue(new Date(Date.now() + 1000))} value={customExpiration} onChange={(event) => { setCustomExpiration(event.target.value); setError(''); }} data-testid="input-custom-expiration" /></div>}
            <div className="field"><label htmlFor="visitor-notes">Purpose / notes <span className="optional-label">Optional</span></label><textarea id="visitor-notes" value={notes} maxLength={240} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Delivering a package" data-testid="input-pass-notes" /></div>
            <div className="helper">Each pass opens its own QR code and management page. You can revoke it from that page or the overview.</div>
            {error && <p className="form-error" role="alert" data-testid="pass-form-error">{error}</p>}
            <button className="button button-primary" onClick={generate} data-testid="button-generate-pass">Generate QR pass <QrCode className="icon" /></button>
          </div>
        </section>
        <section className="panel panel-pad pass-help-card reveal delay-2">
          <div className="eyebrow">One visitor, one pass</div>
          <h2 className="panel-title" style={{ marginTop: 8 }}>Your QR appears next.</h2>
          <p className="panel-kicker">Choose a duration for each pass, then SMARTLOCK opens that visitor’s individual QR code, access code, expiry, and management controls.</p>
          <Link href="/passes" className="button button-soft" data-testid="link-view-all-passes">View all passes</Link>
        </section>
      </div>
    </main>
  );
}

type VerificationResult =
  | { ok: true; pass: AccessPass; accessTime: string }
  | { ok: false; reason: string };

function LockPage({ onVerify }: { onVerify: (token: string) => VerificationResult }) {
  const [sensorActive, setSensorActive] = useState(false);
  const [token, setToken] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  function verify() {
    if (!sensorActive) return;
    setResult(onVerify(token));
  }
  return (
    <main className="main-content">
      <section className="lock-hero reveal"><div><div className="eyebrow">Entry point · Door 01</div><h1 className="page-title">SMARTLOCK</h1><p className="lock-copy">SECURE ACCESS · This simulated reader checks a visitor code against the resident’s pass list. It does not connect to a physical lock.</p></div><div className="sensor-pill">{sensorActive ? 'Reader active' : 'Reader idle'}</div></section>
      <div className="lock-grid">
        <section className="panel panel-pad sensor-panel reveal delay-1"><div><div className="eyebrow">01 · Sensor</div><div className={`sensor-graphic ${sensorActive ? 'active' : ''}`}><div className="sensor-core"><LockKeyhole className="icon" /></div></div><div className="sensor-status" data-testid="status-sensor">{sensorActive ? 'Ready for a pass' : 'Sensor is idle'}</div><div className="sensor-detail">Activate the simulated reader to begin.</div></div><button className={`button ${sensorActive ? 'button-soft' : 'button-accent'}`} onClick={() => { setSensorActive((value) => !value); setResult(null); }} data-testid="button-activate-sensor">{sensorActive ? 'Reset sensor' : 'Activate sensor'}</button></section>
        <section className="panel panel-pad verify-panel reveal delay-2"><div className="verify-title"><div className="verify-icon"><QrCode className="icon" /></div><div><div className="eyebrow">02 · Pass check</div><h2 className="panel-title" style={{ marginTop: 3 }}>Enter access code</h2></div></div><div className="verify-form"><input aria-label="Visitor access code" autoComplete="off" value={token} onChange={(event) => { setToken(event.target.value.toUpperCase()); setResult(null); }} onKeyDown={(event) => { if (event.key === 'Enter') verify(); }} placeholder="e.g. SL-3A7F..." disabled={!sensorActive} data-testid="input-pass-token" /><button className="button button-primary" onClick={verify} disabled={!sensorActive} data-testid="button-verify-token">Unlock Door <DoorOpen className="icon" /></button></div><p className="verify-note">A valid code unlocks this simulation once, then the pass is marked USED. Camera QR scanning is unavailable; enter the code printed beside the QR.</p>{result && <div className={`result ${result.ok ? 'granted' : 'denied'}`} data-testid={`status-verification-${result.ok ? 'granted' : 'denied'}`}>{result.ok ? <DoorOpen className="icon" /> : <ShieldCheck className="icon" />}<div><h3>{result.ok ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</h3>{result.ok ? <><p>Door unlocked successfully in this simulation.</p><dl className="access-result-details"><div><dt>Guest</dt><dd>{result.pass.visitorName} · Unit {result.pass.unit}</dd></div><div><dt>Pass type</dt><dd>{result.pass.accessType === 'premium' ? 'Premium' : 'Standard'}</dd></div><div><dt>Access time</dt><dd>{formatExpiry(result.accessTime)}</dd></div><div><dt>Expiration</dt><dd>{formatExpiry(result.pass.expiresAt)}</dd></div></dl><p className="used-confirmation">This single-use pass is now marked USED.</p></> : <p>{result.reason}</p>}</div></div>}</section>
      </div>
      <p className="helper" style={{ marginTop: 18, textAlign: 'center' }}><ShieldCheck className="icon" style={{ verticalAlign: 'middle', marginRight: 5 }} /> No camera access. No hardware connection. Just a clear verification flow.</p>
    </main>
  );
}

function AboutPage({ onReset }: { onReset: () => void }) {
  return (
    <main className="main-content">
      <div className="top-row reveal"><div><div className="eyebrow">Project information</div><h1 className="page-title">About SMARTLOCK.</h1><p className="page-subtitle">A visitor-access management prototype for residents and property owners.</p></div></div>
      <div className="about-grid">
        <section className="panel panel-pad reveal delay-1">
          <div className="eyebrow">Academic software prototype</div>
          <h2 className="panel-title" style={{ marginTop: 8 }}>Controlled guest access, made clear.</h2>
          <p className="about-copy">SMARTLOCK is a QR-based visitor access management system designed to provide residents and property owners with a convenient and controlled way to manage temporary guest access.</p>
          <p className="about-copy">The system demonstrates digital visitor-pass generation, QR-based identification, access-code validation, expiration management, pass revocation, single-use access, and smart-lock access simulation.</p>
          <p className="about-copy">The current version uses browser-based storage for visitor-pass data and simulates the physical smart-lock mechanism. Pass data remains in this browser on this device.</p>
          <h3 className="about-subtitle">Future integrations</h3>
          <ul className="about-list"><li>Physical door-lock hardware</li><li>Cloud database synchronization and cross-device pass sharing</li><li>Real payment processing and advertising networks</li><li>SMS and email notifications</li><li>Camera-based QR scanning</li></ul>
        </section>
        <section className="panel panel-pad about-reset reveal delay-2">
          <div className="eyebrow">Developer tools</div>
          <h2 className="panel-title" style={{ marginTop: 8 }}>Demo data</h2>
          <p className="panel-kicker">Clear all visitor passes stored by this browser. The dashboard will return to an empty state. This cannot be undone.</p>
          <button className="button button-danger" onClick={onReset} data-testid="button-reset-demo"><RotateCcw className="icon" /> Reset demo data</button>
        </section>
      </div>
    </main>
  );
}

function SignInPage() {
  return <main className="auth-page" data-testid="page-sign-in"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></main>;
}

function SignUpPage() {
  return <main className="auth-page" data-testid="page-sign-up"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></main>;
}

function AuthLoadingPage() {
  return <main className="auth-loading" role="status"><span className="auth-loading-mark" /><span>Loading your secure SMARTLOCK session…</span></main>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const currentQueryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) currentQueryClient.clear();
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, currentQueryClient]);
  return null;
}

function RouterApp() {
  const [location, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [passes, setPasses] = useState<AccessPass[]>(loadPasses);
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(Date.now());
  const passId = location.startsWith('/passes/') ? decodeURIComponent(location.slice('/passes/'.length)) : '';
  const selectedPass = passes.find((pass) => pass.id === passId);
  const signedIn = Boolean(isSignedIn);
  const account = {
    name: user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Resident',
    email: user?.primaryEmailAddress?.emailAddress || '',
    imageUrl: user?.imageUrl,
  };
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(passes)); }, [passes]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(timer); }, []);
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
  const onCreate = (name: string, unit: string, type: AccessType, expiresAt: Date, notes: string) => {
    const pass = createPass(name, unit, type, expiresAt, notes, passes);
    setPasses((current) => [pass, ...current]);
    return pass;
  };
  const onRevoke = (id: string) => { const revokedAt = new Date().toISOString(); setPasses((current) => current.map((pass) => pass.id === id ? { ...pass, status: 'revoked', revokedAt } : pass)); notify('Pass revoked'); };
  const onVerify = (rawToken: string): VerificationResult => {
    const validation = validateAccess(rawToken, passes);
    if (!validation.ok) return validation;
    const usedPass = { ...validation.pass, status: 'used' as const, usedAt: validation.accessTime };
    setPasses((current) => current.map((item) => item.id === usedPass.id ? usedPass : item));
    notify('Entry verified');
    return { ...validation, pass: usedPass };
  };
  const onShare = async (pass: AccessPass) => {
    const passUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `SMARTLOCK pass for ${pass.visitorName}`, text: `Visitor access pass for ${pass.visitorName}. Access code: ${pass.token}`, url: passUrl });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') notify('Unable to share this pass from the current browser.');
      }
    } else {
      try {
        await navigator.clipboard.writeText(passUrl);
        notify('Pass link copied');
      } catch {
        notify('Sharing is not available in this browser. Copy the access code instead.');
      }
    }
  };
  const onReset = () => {
    if (!window.confirm('Reset demo data? This permanently removes all visitor passes saved in this browser.')) return;
    setPasses([]);
    notify('Demo data reset');
    setLocation('/dashboard');
  };
  if (!isLoaded) return <AuthLoadingPage />;
  const page = <Switch>
    <Route path="/"><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><PublicLandingPage /></Show></Route>
    <Route path="/dashboard">{signedIn ? <Overview passes={passes} onRevoke={onRevoke} onCopy={onCopy} /> : <Redirect to="/" />}</Route>
    <Route path="/passes"><ProtectedPage signedIn={signedIn}><PassesPage passes={passes} onRevoke={onRevoke} onCopy={onCopy} /></ProtectedPage></Route>
    <Route path="/passes/:id">{selectedPass ? <PassDetails pass={selectedPass} onRevoke={onRevoke} onCopy={onCopy} onShare={onShare} now={now} canManage={signedIn} /> : signedIn ? <NotFound /> : <Redirect to="/" />}</Route>
    <Route path="/guest"><ProtectedPage signedIn={signedIn}><GuestPage onCreate={onCreate} notify={notify} /></ProtectedPage></Route>
    <Route path="/lock"><ProtectedPage signedIn={signedIn}><LockPage onVerify={onVerify} /></ProtectedPage></Route>
    <Route path="/about"><ProtectedPage signedIn={signedIn}><AboutPage onReset={onReset} /></ProtectedPage></Route>
    <Route>{signedIn ? <NotFound /> : <Redirect to="/" />}</Route>
  </Switch>;
  const toastMessage = toast && <div className="toast" role="status" data-testid="toast-message">{toast}</div>;
  if (signedIn) {
    return <AppShell currentPath={location} account={account} onSignOut={() => { void signOut({ redirectUrl: basePath || '/' }); }}>{page}{toastMessage}</AppShell>;
  }
  if (location.startsWith('/passes/')) return <PublicVisitorShell>{page}{toastMessage}</PublicVisitorShell>;
  return <>{page}{toastMessage}</>;
}

function ProtectedPage({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  return signedIn ? <>{children}</> : <Redirect to="/" />;
}

function ClerkApp() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to manage your visitor passes.' } },
        signUp: { start: { title: 'Create your resident account', subtitle: 'Get started with SMARTLOCK.' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/sign-in/*?"><SignInPage /></Route>
        <Route path="/sign-up/*?"><SignUpPage /></Route>
        <Route><RouterApp /></Route>
      </Switch>
    </ClerkProvider>
  );
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><ErrorBoundary resetKey={window.location.pathname}><ClerkApp /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;