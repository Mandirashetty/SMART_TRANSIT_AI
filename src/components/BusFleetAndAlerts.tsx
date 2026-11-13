import React, { useState } from 'react';
import { BellRing, Phone, ShieldAlert } from 'lucide-react';
import { AlertItem, TransitBus, TransitNode, User } from '../types';
import { BusIllustration } from './BusIllustration';

interface Props {
  heading: string;
  buses: TransitBus[];
  nodes: TransitNode[];
  alerts: AlertItem[];
  user: User | null;
  onUpdateBusStatus: (
    busId: string,
    status: TransitBus['status'],
    delayMinutes: number,
    reason: string
  ) => Promise<void>;
}

export const BusFleetAndAlerts: React.FC<Props> = ({
  heading,
  buses,
  nodes,
  alerts,
  user,
  onUpdateBusStatus,
}) => {
  const [selectedBusId, setSelectedBusId] = useState<string>(buses[0]?.id ?? 'BUS-01');
  const [newStatus, setNewStatus] = useState<TransitBus['status']>('delayed');
  const [delayMin, setDelayMin] = useState(15);
  const [reason, setReason] = useState('Heavy monsoon waterlogging on rural approach road');
  const [feedback, setFeedback] = useState<string | null>(null);

  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const selectedBus = buses.find((b) => b.id === selectedBusId) ?? buses[0];
  const canControlFleet = user?.role === 'admin' || user?.role === 'authority';

  const handleDispatchStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBus) return;
    await onUpdateBusStatus(selectedBus.id, newStatus, delayMin, reason);
    setFeedback(
      `Updated ${selectedBus.id} to ${newStatus.toUpperCase()} and dispatched simulated notifications to affected students & parents.`
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono text-indigo-700">SIMULATED FLEET ROSTER &amp; SMART NOTIFICATIONS</p>
        <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
      </div>

      {feedback && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-medium text-indigo-900">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Selected Bus Detail Card with Inline SVG Illustration */}
        <div className="xl:col-span-7 space-y-4">
          {selectedBus && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    {selectedBus.id} · {selectedBus.reg_number}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedBus.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span>Driver: {selectedBus.driver_name}</span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Phone className="h-3 w-3" /> {selectedBus.driver_phone}
                    </span>
                  </div>
                </div>
                <BusIllustration bus={selectedBus} />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-4 text-xs">
                <div>
                  <div className="text-slate-500">Status</div>
                  <div
                    className={`mt-0.5 font-mono font-bold uppercase ${
                      selectedBus.status === 'on_time'
                        ? 'text-emerald-700'
                        : selectedBus.status === 'delayed'
                          ? 'text-amber-700'
                          : 'text-red-700'
                    }`}
                  >
                    {selectedBus.status.replace('_', ' ')}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Seating Capacity</div>
                  <div className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                    {selectedBus.capacity} seats
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Simulated ETA</div>
                  <div className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                    {selectedBus.eta_minutes} min
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Active Delay</div>
                  <div className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                    +{selectedBus.delay_minutes} min
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 text-xs">
                <div className="font-semibold text-slate-700 mb-1">Route Stops</div>
                <div className="font-mono text-slate-600">
                  {selectedBus.route_stops.map(nodeName).join(' -> ')}
                </div>
              </div>
            </div>
          )}

          {/* Fleet Selector Grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {buses.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBusId(b.id)}
                className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
                  selectedBus?.id === b.id
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-slate-600">{b.id}</span>
                  <span
                    className={`font-mono text-[11px] font-bold uppercase ${
                      b.status === 'on_time'
                        ? 'text-emerald-700'
                        : b.status === 'delayed'
                          ? 'text-amber-700'
                          : 'text-red-700'
                    }`}
                  >
                    {b.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 truncate">{b.name}</div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                  {b.reg_number} · Cap {b.capacity} · ETA {b.eta_minutes}m
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Admin Smart Alert Dispatcher & Alerts Feed */}
        <div className="xl:col-span-5 space-y-6">
          <form
            onSubmit={handleDispatchStatus}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-indigo-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Admin Bus Status &amp; Smart Alert Dispatch
              </h3>
            </div>
            {!canControlFleet && (
              <p className="text-xs text-amber-700">
                Sign in as Admin or Transport Authority to mark buses delayed, cancelled, or unavailable.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Bus</label>
                <select
                  value={selectedBusId}
                  onChange={(e) => setSelectedBusId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} · {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TransitBus['status'])}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="on_time">On Time</option>
                  <option value="delayed">Delayed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="unavailable">Unavailable (Breakdown)</option>
                </select>
              </div>
            </div>
            {newStatus === 'delayed' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Delay Duration (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={delayMin}
                  onChange={(e) => setDelayMin(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reason / Advisory Note</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={!canControlFleet}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 cursor-pointer"
            >
              Update Status &amp; Notify Students/Parents
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <BellRing className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Simulated Student &amp; Parent Notifications ({alerts.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
              {alerts.map((a) => (
                <div key={a.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-semibold ${
                        a.severity === 'critical'
                          ? 'text-red-700'
                          : a.severity === 'warning'
                            ? 'text-amber-700'
                            : 'text-indigo-700'
                      }`}
                    >
                      {a.title}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {a.affected_count} affected
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{a.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
