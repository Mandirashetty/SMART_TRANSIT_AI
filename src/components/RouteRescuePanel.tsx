import React, { useEffect, useState } from 'react';
import { Navigation } from 'lucide-react';
import { RouteRescueOption, TransitBus, TransitNode, TransitRoad } from '../types';
import { TransitMap } from './TransitMap';

interface Props {
  heading: string;
  nodes: TransitNode[];
  roads: TransitRoad[];
  buses: TransitBus[];
}

export const RouteRescuePanel: React.FC<Props> = ({ heading, nodes, roads, buses }) => {
  const villages = nodes.filter((n) => n.type === 'village');
  const institutions = nodes.filter((n) => n.type === 'institution');
  const [origin, setOrigin] = useState('V6');
  const [destination, setDestination] = useState('I1');
  const [options, setOptions] = useState<RouteRescueOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<RouteRescueOption | null>(null);
  const [loading, setLoading] = useState(false);

  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;

  const fetchRescue = async (o: string, d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/route-rescue?origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}`);
      const data = await res.json();
      setOptions(data.options ?? []);
      setSelectedOption(data.options?.[0] ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRescue(origin, destination);
  }, [origin, destination, roads]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-mono text-indigo-700">MIN-HEAP DIJKSTRA + PARENTRIDE RANKING</p>
          <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Origin Village</label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
            >
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id} · {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Target Campus</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
            >
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.id} · {i.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => fetchRescue(origin, destination)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:from-blue-700 hover:to-indigo-700 cursor-pointer"
          >
            <Navigation className="h-3.5 w-3.5" />
            {loading ? 'Calculating...' : 'Rank Options'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5 space-y-3">
          {options.map((opt, idx) => {
            const isSel = selectedOption?.id === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedOption(opt)}
                className={`w-full text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                  isSel
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-mono font-semibold text-indigo-700">
                      #{idx + 1} · {opt.mode.toUpperCase()}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-0.5">{opt.providerName}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-lg font-bold tabular-nums text-slate-900">
                      {opt.estimatedMinutes} min
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">{opt.distanceKm} km</div>
                  </div>
                </div>
                <div className="mt-2 font-mono text-[11px] text-slate-600">
                  Route: {opt.stopsPath.map(nodeName).join(' -> ')}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{opt.reliabilityNote}</span>
                  <span className="font-mono tabular-nums">{opt.seatsRemaining} seats</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="xl:col-span-7">
          <TransitMap
            nodes={nodes}
            roads={roads}
            buses={buses}
            highlightedPath={selectedOption?.stopsPath ?? []}
          />
        </div>
      </div>
    </div>
  );
};
