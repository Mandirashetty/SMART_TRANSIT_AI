import React, { useState } from 'react';
import { KeyRound, LogOut, UserPlus } from 'lucide-react';
import { TransitNode, User, UserRole } from '../types';

interface Props {
  heading: string;
  user: User | null;
  nodes: TransitNode[];
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    village_id: string;
    phone: string;
  }) => Promise<void>;
  onLogout: () => Promise<void>;
}

const DEMO_ACCOUNTS: { role: UserRole; label: string; email: string; password: string; access: string }[] = [
  {
    role: 'student',
    label: 'Student',
    email: 'student@smarttransit.in',
    password: 'Student@123',
    access: 'Track buses, RouteRescue AI, Request ParentRide seats, SOS, AI Assistant',
  },
  {
    role: 'parent',
    label: 'Parent',
    email: 'parent@smarttransit.in',
    password: 'Parent@123',
    access: 'Offer ParentRide seats, Accept/Reject/Pickup/Drop-off requests, Track buses, SOS',
  },
  {
    role: 'admin',
    label: 'Admin',
    email: 'admin@smarttransit.in',
    password: 'Admin@123',
    access: 'Full Crisis Command Center, Bus status alerts, Manual capacity override, SOS dispatch',
  },
  {
    role: 'authority',
    label: 'Transport Authority',
    email: 'authority@smarttransit.in',
    password: 'Authority@123',
    access: 'Full Crisis Command Center, Fleet disruption alerts, Analytics & SOS governance',
  },
];

export const AuthView: React.FC<Props> = ({
  heading,
  user,
  nodes,
  onLogin,
  onSignup,
  onLogout,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('admin@smarttransit.in');
  const [password, setPassword] = useState('Admin@123');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [villageId, setVillageId] = useState('V1');
  const [phone, setPhone] = useState('+91 98450 55111');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const villages = nodes.filter((n) => n.type === 'village');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await onLogin(email, password);
      setMsg(`Signed in successfully as ${email}.`);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await onSignup({ name, email, password, role, village_id: villageId, phone });
      setMsg(`Account created and signed in as ${role}.`);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Signup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono text-indigo-700">SCRYPT SALTED HASHING · ROLE-BASED ACCESS CONTROL</p>
        <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Auth Form Card */}
        <div className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          {user && (
            <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs">
              <div>
                <div className="font-bold text-slate-900">{user.name}</div>
                <div className="font-mono text-[11px] text-indigo-800">
                  {user.email} · ROLE: {user.role.toUpperCase()}
                </div>
              </div>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold cursor-pointer ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold cursor-pointer ${
                mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Create Account
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:from-blue-700 hover:to-indigo-700 cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {busy ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sahana Kulkarni"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password (min 6)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Account Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    <option value="student">Student</option>
                    <option value="parent">Parent</option>
                    <option value="admin">Admin</option>
                    <option value="authority">Transport Authority</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Home Village</label>
                  <select
                    value={villageId}
                    onChange={(e) => setVillageId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    {villages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {busy ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        {/* Demo Credentials Matrix */}
        <div className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              Seeded Demo Accounts &amp; Role Permissions
            </h3>
            <p className="text-xs text-slate-500">
              Click any role below to sign in instantly and verify role-based access enforcement across modules.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {DEMO_ACCOUNTS.map((acc) => (
              <div
                key={acc.role}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{acc.label}</span>
                    <span className="font-mono text-xs text-indigo-700">{acc.email}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">Password: {acc.password}</div>
                  <p className="text-xs text-slate-600">{acc.access}</p>
                </div>
                <button
                  onClick={async () => {
                    setErr(null);
                    setEmail(acc.email);
                    setPassword(acc.password);
                    await onLogin(acc.email, acc.password);
                    setMsg(`Signed in as ${acc.label} (${acc.email}).`);
                  }}
                  className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-800 cursor-pointer whitespace-nowrap"
                >
                  Sign In as {acc.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
