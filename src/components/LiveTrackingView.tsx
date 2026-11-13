import React, { useState } from 'react';
import { Play, Pause, RefreshCw } from 'lucide-react';
import { TransitBus, TransitNode, TransitRoad } from '../types';
import { TransitMap } from './TransitMap';
import { BusIllustration } from './BusIllustration';

interface Props {
  heading: string;
  nodes: TransitNode[];
  roads: TransitRoad[];
  buses: TransitBus[];
  autoMove: boolean;
  onToggleAutoMove: () => void;
  onManualTick: () => Promise<void>;
}

export const LiveTrackingView: React.FC<Props> = ({
  heading,
  nodes,
  roads,
  buses,
  autoMove,
  onToggleAutoMove,
  onManualTick,
}) => {
  const [selectedBus, setSelectedBus] = useState<TransitBus | null>(buses[0] ?? null);
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;

  const activeBus = buses.find((b) => b.id === selectedBus?.id) ?? buses[0] ?? null;
  const onTimeCount = buses.filter((b) => b.status === 'on_time').length;
  const delayedCount = buses.filter((b) => b.status === 'delayed').length;
  const downCount = buses.filter((b) => b.status === 'unavailable' || b.status === 'cancelled').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-mono text-indigo-700">SIMULATED LIVE GPS &amp; AUTO-MOVEMENT</p>
          <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onToggleAutoMove}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              autoMove
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {autoMove ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoMove ? 'Auto-Movement: Running' : 'Auto-Movement: Paused'}
          </button>
          <button
            onClick={onManualTick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Step Fleet Position
          </button>
        </div>
      </div>

      {/* Fleet KPI Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Total Rural Buses</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">{buses.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Running On Time</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700">{onTimeCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Delayed Units</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700">{delayedCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Unavailable / Cancelled</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-red-700">{downCount}</div>
        </div>
      </div>

      {/* Interactive Map + Active Bus Sidebar */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <TransitMap
            nodes={nodes}
            roads={roads}
            buses={buses}
            highlightedPath={activeBus?.route_stops ?? []}
            selectedBusId={activeBus?.id ?? null}
            onSelectBus={(b) => setSelectedBus(b)}
          />
        </div>

        <div className="xl:col-span-4 rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4">
          {activeBus ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-700">{activeBus.id}</span>
                  <span
                    className={`font-mono text-xs font-bold uppercase ${
                      activeBus.status === 'on_time'
                        ? 'text-emerald-700'
                        : activeBus.status === 'delayed'
                          ? 'text-amber-700'
                          : 'text-red-700'
                    }`}
                  >
                    {activeBus.status.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{activeBus.name}</h3>
                <BusIllustration bus={activeBus} />
                <div className="space-y-1.5 text-xs text-slate-600 pt-2">
                  <div>
                    <strong>Driver:</strong> {activeBus.driver_name} ({activeBus.driver_phone})
                  </div>
                  <div>
                    <strong>Capacity:</strong>{' '}
                    <span className="font-mono tabular-nums">{activeBus.capacity} seats</span>
                  </div>
                  <div>
                    <strong>Next ETA:</strong>{' '}
                    <span className="font-mono tabular-nums">{activeBus.eta_minutes} min</span>
                  </div>
                  <div>
                    <strong>Corridor:</strong>{' '}
                    <span className="font-mono">{activeBus.route_stops.map(nodeName).join(' -> ')}</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 text-[11px] font-mono text-slate-500">
                Click any bus marker on the map to inspect its route and simulated GPS progress.
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">Select a bus on the map.</div>
          )}
        </div>
      </div>

      {/* Live Bus Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3">Bus</th>
                <th className="px-4 py-3">Registration</th>
                <th className="px-4 py-3">Route Stops</th>
                <th className="px-4 py-3 text-right">Capacity</th>
                <th className="px-4 py-3 text-right">Simulated ETA</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buses.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => setSelectedBus(b)}
                  className={`cursor-pointer ${activeBus?.id === b.id ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-900">
                    {b.id} · {b.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{b.reg_number}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                    {b.route_stops.map(nodeName).join(' -> ')}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{b.capacity}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">
                    {b.eta_minutes}m
                  </td>
                  <td className="px-4 py-2.5">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
