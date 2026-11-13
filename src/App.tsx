import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Bus,
  Car,
  Film,
  Globe,
  Menu,
  Navigation,
  ShieldAlert,
  Siren,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AlertItem,
  CrisisStatePayload,
  DemandAnalyticsRow,
  LangCode,
  ParentRideRequest,
  ParentVehicle,
  SosReport,
  TransitBus,
  TransitNode,
  TransitRoad,
  User,
  UserRole,
} from './types';
import { LANGUAGES, TRANSLATIONS } from './i18n';
import { CrisisCommandCenter } from './components/CrisisCommandCenter';
import { LiveTrackingView } from './components/LiveTrackingView';
import { RouteRescuePanel } from './components/RouteRescuePanel';
import { ParentRideHub } from './components/ParentRideHub';
import { BusFleetAndAlerts } from './components/BusFleetAndAlerts';
import { DemandAnalytics } from './components/DemandAnalytics';
import { AIAssistant } from './components/AIAssistant';
import { VideoStudio } from './components/VideoStudio';
import { SosModal } from './components/SosModal';
import { SosAdminView } from './components/SosAdminView';
import { AuthView } from './components/AuthView';

type TabKey =
  | 'crisis'
  | 'live'
  | 'rescue'
  | 'parent'
  | 'fleet'
  | 'analytics'
  | 'assistant'
  | 'video'
  | 'sos'
  | 'auth';

const TOKEN_KEY = 'smarttransit_session_token';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('crisis');
  const [lang, setLang] = useState<LangCode>('en');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);

  const [nodes, setNodes] = useState<TransitNode[]>([]);
  const [roads, setRoads] = useState<TransitRoad[]>([]);
  const [buses, setBuses] = useState<TransitBus[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [parentVehicles, setParentVehicles] = useState<ParentVehicle[]>([]);
  const [parentRequests, setParentRequests] = useState<ParentRideRequest[]>([]);
  const [analytics, setAnalytics] = useState<DemandAnalyticsRow[]>([]);
  const [sosReports, setSosReports] = useState<SosReport[]>([]);
  const [crisis, setCrisis] = useState<CrisisStatePayload | null>(null);
  const [autoMove, setAutoMove] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const t = TRANSLATIONS[lang];

  const authHeaders = useCallback(
    (extra: Record<string, string> = {}) => ({
      ...extra,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const refreshAll = useCallback(async () => {
    const [netRes, altRes, prRes, anaRes, sosRes, criRes] = await Promise.all([
      fetch('/api/network'),
      fetch('/api/alerts'),
      fetch('/api/parent-ride'),
      fetch('/api/analytics/demand'),
      fetch('/api/sos'),
      fetch('/api/crisis'),
    ]);
    const [net, alt, pr, ana, sos, cri] = await Promise.all([
      netRes.json(),
      altRes.json(),
      prRes.json(),
      anaRes.json(),
      sosRes.json(),
      criRes.json(),
    ]);

    setNodes(net.nodes ?? []);
    setRoads(net.roads ?? []);
    setBuses(net.buses ?? []);
    setAlerts(alt.alerts ?? []);
    setParentVehicles(pr.vehicles ?? []);
    setParentRequests(pr.requests ?? []);
    setAnalytics(ana.analytics ?? []);
    setSosReports(sos.reports ?? []);
    setCrisis(cri ?? null);
  }, []);

  // Bootstrap authentication & initial data
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (mounted) {
              setToken(storedToken);
              setUser(meData.user);
            }
          } else {
            localStorage.removeItem(TOKEN_KEY);
            if (mounted) setToken(null);
          }
        } else if (!localStorage.getItem('smarttransit_explicit_logout')) {
          // Seamless first-load demo Admin session so Crisis Command Center works immediately
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'admin@smarttransit.in',
              password: 'Admin@123',
            }),
          });
          if (loginRes.ok) {
            const loginData = await loginRes.json();
            localStorage.setItem(TOKEN_KEY, loginData.token);
            if (mounted) {
              setToken(loginData.token);
              setUser(loginData.user);
            }
          }
        }
        await refreshAll();
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [refreshAll]);

  // Automatic simulated bus movement loop
  useEffect(() => {
    if (!autoMove) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/buses/tick', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setBuses(data.buses ?? []);
        }
      } catch {
        // ignore transient polling error
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [autoMove]);

  const handleManualTick = async () => {
    const res = await fetch('/api/buses/tick', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setBuses(data.buses ?? []);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.removeItem('smarttransit_explicit_logout');
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const handleSignup = async (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    village_id: string;
    phone: string;
  }) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    localStorage.removeItem('smarttransit_explicit_logout');
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
    localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem('smarttransit_explicit_logout', '1');
    setToken(null);
    setUser(null);
  };

  const handleTriggerCrisis = async (brokenBusIds: string[], blockedRoadId: string) => {
    const res = await fetch('/api/crisis/trigger', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ brokenBusIds, blockedRoadId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to trigger crisis');
    await refreshAll();
  };

  const handleResetCrisis = async () => {
    const res = await fetch('/api/crisis/reset', {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset crisis');
    await refreshAll();
  };

  const handleReassignStudent = async (
    studentId: string,
    vehicleType: 'bus' | 'parent_ride' | 'none',
    vehicleId: string | null
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch('/api/crisis/reassign', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ student_id: studentId, vehicle_type: vehicleType, vehicle_id: vehicleId }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Reassignment rejected' };
    await refreshAll();
    return { ok: true };
  };

  const handleUpdateBusStatus = async (
    busId: string,
    status: TransitBus['status'],
    delayMinutes: number,
    reason: string
  ) => {
    const res = await fetch(`/api/buses/${busId}/status`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, delay_minutes: delayMinutes, reason }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update bus status');
    }
    await refreshAll();
  };

  const handleOfferVehicle = async (payload: {
    vehicle_model: string;
    reg_number: string;
    origin_node_id: string;
    destination_node_id: string;
    seats_total: number;
    departure_minutes: number;
  }) => {
    const res = await fetch('/api/parent-ride/offer', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to publish vehicle');
    await refreshAll();
  };

  const handleRequestSeat = async (vehicleId: string, pickupNodeId: string) => {
    const res = await fetch('/api/parent-ride/request', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ vehicle_id: vehicleId, pickup_node_id: pickupNodeId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to request seat');
    await refreshAll();
  };

  const handleParentRideAction = async (
    requestId: string,
    action: 'accepted' | 'rejected' | 'picked_up' | 'dropped_off'
  ) => {
    const res = await fetch(`/api/parent-ride/request/${requestId}/action`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Action failed');
    await refreshAll();
  };

  const handleSubmitSos = async (payload: {
    emergency_number: string;
    location_node_id: string;
    notes: string;
    phone: string;
  }) => {
    const res = await fetch('/api/sos', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Unable to save SOS');
    await refreshAll();
  };

  const handleUpdateSosStatus = async (id: string, status: 'active' | 'dispatched' | 'resolved') => {
    const res = await fetch(`/api/sos/${id}/status`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update SOS');
    }
    await refreshAll();
  };

  const navItems: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'crisis', label: t.navCrisis, icon: ShieldAlert },
    { key: 'live', label: t.navLiveMap, icon: Activity },
    { key: 'rescue', label: t.navRouteRescue, icon: Navigation },
    { key: 'parent', label: t.navParentRide, icon: Car },
    { key: 'fleet', label: t.navFleetAlerts, icon: Bus },
    { key: 'analytics', label: t.navAnalytics, icon: BarChart3 },
    { key: 'assistant', label: t.navAssistant, icon: Bot },
    { key: 'video', label: t.navVideoStudio, icon: Film },
    { key: 'sos', label: t.navSosAdmin, icon: Siren },
    { key: 'auth', label: t.navAccount, icon: UserCheck },
  ];

  const activeNavLabel = navItems.find((n) => n.key === activeTab)?.label ?? '';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-950 text-slate-100 border-r border-slate-800">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="font-display text-lg font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {t.appTitle}
          </div>
          <div className="mt-1 text-[11px] font-mono text-slate-400">{t.simulatedBadge}</div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4 text-xs">
          {user ? (
            <button
              onClick={() => setActiveTab('auth')}
              className="w-full text-left rounded-lg bg-slate-900 p-3 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <div className="font-semibold text-white truncate">{user.name}</div>
              <div className="font-mono text-[11px] text-indigo-300 uppercase mt-0.5">
                {user.role} Account
              </div>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('auth')}
              className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700 cursor-pointer"
            >
              Sign In / Sign Up
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-50 w-64 bg-slate-950 text-slate-100 flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
              <span className="font-display font-bold text-base text-white">{t.appTitle}</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveTab(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium cursor-pointer ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (3-zone layout with Emergency SOS always visible) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="text-xs text-slate-500 truncate">
              <span className="font-semibold text-slate-900">{t.appTitle}</span>
              <span className="mx-2">/</span>
              <span>{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <Globe className="h-3.5 w-3.5 text-slate-500" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as LangCode)}
                aria-label="Language selector"
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native} · {l.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setSosModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Siren className="h-3.5 w-3.5" />
              {t.sosButton}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-[1380px] w-full mx-auto">
          {loadingInitial ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
              Initializing SmartTransit AI rural network and SQLite persistence...
            </div>
          ) : (
            <>
              {activeTab === 'crisis' && (
                <CrisisCommandCenter
                  crisis={crisis}
                  nodes={nodes}
                  roads={roads}
                  buses={buses}
                  parentVehicles={parentVehicles}
                  user={user}
                  heading={t.headingCrisis}
                  triggerLabel={t.triggerCrisis}
                  resetLabel={t.resetCrisis}
                  beforeLabel={t.beforeLabel}
                  afterLabel={t.afterLabel}
                  countdownLabel={t.examCountdown}
                  onTriggerCrisis={handleTriggerCrisis}
                  onResetCrisis={handleResetCrisis}
                  onReassignStudent={handleReassignStudent}
                />
              )}
              {activeTab === 'live' && (
                <LiveTrackingView
                  heading={t.headingLiveMap}
                  nodes={nodes}
                  roads={roads}
                  buses={buses}
                  autoMove={autoMove}
                  onToggleAutoMove={() => setAutoMove((a) => !a)}
                  onManualTick={handleManualTick}
                />
              )}
              {activeTab === 'rescue' && (
                <RouteRescuePanel
                  heading={t.headingRouteRescue}
                  nodes={nodes}
                  roads={roads}
                  buses={buses}
                />
              )}
              {activeTab === 'parent' && (
                <ParentRideHub
                  heading={t.headingParentRide}
                  vehicles={parentVehicles}
                  requests={parentRequests}
                  nodes={nodes}
                  user={user}
                  onOfferVehicle={handleOfferVehicle}
                  onRequestSeat={handleRequestSeat}
                  onRequestAction={handleParentRideAction}
                />
              )}
              {activeTab === 'fleet' && (
                <BusFleetAndAlerts
                  heading={t.headingFleetAlerts}
                  buses={buses}
                  nodes={nodes}
                  alerts={alerts}
                  user={user}
                  onUpdateBusStatus={handleUpdateBusStatus}
                />
              )}
              {activeTab === 'analytics' && (
                <DemandAnalytics heading={t.headingAnalytics} analytics={analytics} />
              )}
              {activeTab === 'assistant' && <AIAssistant heading={t.headingAssistant} />}
              {activeTab === 'video' && <VideoStudio heading={t.headingVideoStudio} crisis={crisis} />}
              {activeTab === 'sos' && (
                <SosAdminView
                  heading={t.headingSosAdmin}
                  reports={sosReports}
                  nodes={nodes}
                  user={user}
                  onUpdateStatus={handleUpdateSosStatus}
                />
              )}
              {activeTab === 'auth' && (
                <AuthView
                  heading={t.headingAccount}
                  user={user}
                  nodes={nodes}
                  onLogin={handleLogin}
                  onSignup={handleSignup}
                  onLogout={handleLogout}
                />
              )}
            </>
          )}
        </main>
      </div>

      <SosModal
        open={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        nodes={nodes}
        onSubmitSos={handleSubmitSos}
      />
    </div>
  );
}
