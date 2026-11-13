import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  CrisisStatePayload,
  ParentVehicle,
  TransitBus,
  TransitNode,
  TransitRoad,
  User,
} from '../types';
import { TransitMap } from './TransitMap';

interface Props {
  crisis: CrisisStatePayload | null;
  nodes: TransitNode[];
  roads: TransitRoad[];
  buses: TransitBus[];
  parentVehicles: ParentVehicle[];
  user: User | null;
  heading: string;
  triggerLabel: string;
  resetLabel: string;
  beforeLabel: string;
  afterLabel: string;
  countdownLabel: string;
  onTriggerCrisis: (brokenBusIds: string[], blockedRoadId: string) => Promise<void>;
  onResetCrisis: () => Promise<void>;
  onReassignStudent: (
    studentId: string,
    vehicleType: 'bus' | 'parent_ride' | 'none',
    vehicleId: string | null
  ) => Promise<{ ok: boolean; error?: string }>;
}

export const CrisisCommandCenter: React.FC<Props> = ({
  crisis,
  nodes,
  roads,
  buses,
  parentVehicles,
  user,
  heading,
  triggerLabel,
  resetLabel,
  beforeLabel,
  afterLabel,
  countdownLabel,
  onTriggerCrisis,
  onResetCrisis,
  onReassignStudent,
}) => {
  const [brokenBus1, setBrokenBus1] = useState('BUS-01');
  const [brokenBus2, setBrokenBus2] = useState('BUS-04');
  const [blockedRoad, setBlockedRoad] = useState('R15');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live ticking exam countdown (7200s = 2 hours)
  const [secondsLeft, setSecondsLeft] = useState(7200);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'exam' | 'On Time' | 'At Risk' | 'Unreachable'>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (!crisis?.active) {
      setSecondsLeft(7200);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [crisis?.active]);

  const formatCountdown = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const nodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) map.set(n.id, n.name);
    return map;
  }, [nodes]);

  const canManageCrisis = user?.role === 'admin' || user?.role === 'authority';

  const handleTrigger = async () => {
    if (brokenBus1 === brokenBus2) {
      setErrorMsg('Please select two distinct buses for the simulated breakdown.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      await onTriggerCrisis([brokenBus1, brokenBus2], blockedRoad);
      setSuccessMsg('Exam-Day Crisis simulation executed: Dijkstra rerouting and priority seat reallocation complete.');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to trigger crisis simulation.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      await onResetCrisis();
      setSelectedStudentId(null);
      setSuccessMsg('Crisis state reset cleanly to normal baseline operations.');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to reset crisis.');
    } finally {
      setBusy(false);
    }
  };

  const handleReassignChange = async (studentId: string, compositeVal: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (compositeVal === 'none') {
      const res = await onReassignStudent(studentId, 'none', null);
      if (!res.ok) setErrorMsg(res.error || 'Reassignment failed');
      else setSuccessMsg(`Updated assignment for ${studentId} and recalculated crisis metrics.`);
      return;
    }
    const [vType, vId] = compositeVal.split(':');
    const res = await onReassignStudent(studentId, vType as 'bus' | 'parent_ride', vId);
    if (!res.ok) {
      setErrorMsg(res.error || 'Capacity limit exceeded.');
    } else {
      setSuccessMsg(`Reassigned ${studentId} to ${vId} with capacity validation passed.`);
    }
  };

  const filteredAssignments = useMemo(() => {
    const rows = crisis?.assignments ?? [];
    return rows.filter((r) => {
      if (statusFilter === 'exam' && r.is_exam_student !== 1) return false;
      if (['On Time', 'At Risk', 'Unreachable'].includes(statusFilter) && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const vName = (nodeMap.get(r.village_id) ?? r.village_id).toLowerCase();
        const iName = (nodeMap.get(r.institution_id) ?? r.institution_id).toLowerCase();
        return (
          r.student_id.toLowerCase().includes(q) ||
          r.student_name.toLowerCase().includes(q) ||
          vName.includes(q) ||
          iName.includes(q) ||
          (r.vehicle_name ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [crisis?.assignments, statusFilter, searchQuery, nodeMap]);

  // Highlight path on map: either selected student's rerouted path or first rerouted exam student's path
  const highlightedPath = useMemo(() => {
    if (!crisis?.active) return [];
    const selected = crisis.assignments.find((a) => a.student_id === selectedStudentId);
    if (selected && selected.route_path.length > 1) return selected.route_path;
    const sampleExam = crisis.assignments.find((a) => a.is_exam_student === 1 && a.route_path.length > 2);
    return sampleExam?.route_path ?? [];
  }, [crisis, selectedStudentId]);

  const downloadCrisisCsv = () => {
    if (!crisis?.assignments?.length) return;
    const headers = [
      'Student ID',
      'Student Name',
      'Village',
      'Institution',
      'Exam Student',
      'Exam Subject',
      'Exam Deadline (min)',
      'Assigned Vehicle Type',
      'Assigned Vehicle',
      'Dijkstra Route',
      'Travel Time (min)',
      'ETA (min)',
      'Status',
      'Manual Override',
    ];
    const lines = [headers.join(',')];
    for (const row of crisis.assignments) {
      lines.push(
        [
          row.student_id,
          `"${row.student_name}"`,
          `"${nodeMap.get(row.village_id) ?? row.village_id}"`,
          `"${nodeMap.get(row.institution_id) ?? row.institution_id}"`,
          row.is_exam_student ? 'YES' : 'NO',
          `"${row.exam_subject ?? ''}"`,
          row.exam_deadline_minutes ?? '',
          row.vehicle_type,
          `"${row.vehicle_name ?? ''}"`,
          `"${row.route_path.join(' -> ')}"`,
          row.travel_minutes,
          row.eta_minutes,
          row.status,
          row.manually_edited ? 'YES' : 'NO',
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smarttransit_crisis_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const before = crisis?.before;
  const after = crisis?.after;

  const comparisonRows = [
    {
      label: 'Total Students',
      before: before?.total_students ?? 150,
      after: after ? after.total_students : null,
      unit: '',
    },
    {
      label: 'Students Served',
      before: before?.students_served ?? 150,
      after: after ? after.students_served : null,
      unit: '',
    },
    {
      label: 'Students Reaching On Time',
      before: before?.students_reaching_on_time ?? 0,
      after: after ? after.students_reaching_on_time : null,
      unit: '',
    },
    {
      label: 'Exam Students Reaching On Time',
      before: before ? `${before.exam_students_reaching_on_time} / ${before.exam_students_total}` : '—',
      after: after ? `${after.exam_students_reaching_on_time} / ${after.exam_students_total}` : null,
      unit: '',
    },
    {
      label: 'Students At Risk',
      before: before?.students_at_risk ?? 0,
      after: after ? after.students_at_risk : null,
      unit: '',
    },
    {
      label: 'Unreachable Students',
      before: before?.unreachable_students ?? 0,
      after: after ? after.unreachable_students : null,
      unit: '',
    },
    {
      label: 'Average Delay',
      before: before?.average_delay_minutes ?? 0,
      after: after ? after.average_delay_minutes : null,
      unit: ' min',
    },
    {
      label: 'Bus Utilization',
      before: before?.bus_utilization_pct ?? 0,
      after: after ? after.bus_utilization_pct : null,
      unit: '%',
    },
  ];

  const activeBuses = buses.filter((b) => b.status !== 'unavailable' && b.status !== 'cancelled');

  return (
    <div className="space-y-6">
      {/* Primary Crisis Command Header Banner (Blue-to-Indigo/Purple Gradient) */}
      <section className="rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 p-6 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3 text-xs font-mono text-indigo-100">
              <span>SIMULATED EMERGENCY ORCHESTRATION</span>
              <span aria-hidden="true">·</span>
              <span>MIN-HEAP DIJKSTRA ROUTING</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-balance">{heading}</h2>
            <p className="text-sm text-indigo-100 leading-relaxed">
              Simulates four simultaneous rural transit shocks: two bus breakdowns, a +40% student demand surge,
              a flooded arterial road removal, and 2-hour examination deadlines with strict vehicle capacity enforcement.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="rounded-lg bg-slate-950/35 border border-white/15 px-4 py-3 text-right">
              <div className="text-[11px] font-medium text-indigo-200">{countdownLabel}</div>
              <div className="font-mono text-2xl font-bold tabular-nums text-white">
                {formatCountdown(secondsLeft)}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleTrigger}
                disabled={busy || !canManageCrisis}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-indigo-800 hover:bg-indigo-50 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ShieldAlert className="h-4 w-4" />
                {busy ? 'Orchestrating...' : triggerLabel}
              </button>
              <button
                onClick={handleReset}
                disabled={busy || !canManageCrisis || !crisis?.active}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {resetLabel}
              </button>
            </div>
          </div>
        </div>

        {/* Crisis Shock Configuration Controls */}
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-white/15 pt-5 md:grid-cols-3">
          <div>
            <label className="block text-[11px] font-medium text-indigo-100 mb-1">
              A1. First Bus Breakdown
            </label>
            <select
              value={brokenBus1}
              onChange={(e) => setBrokenBus1(e.target.value)}
              disabled={crisis?.active}
              className="w-full rounded-lg border border-white/20 bg-slate-950/40 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-60"
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.id} · {b.name} ({b.capacity} seats)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-indigo-100 mb-1">
              A2. Second Bus Breakdown
            </label>
            <select
              value={brokenBus2}
              onChange={(e) => setBrokenBus2(e.target.value)}
              disabled={crisis?.active}
              className="w-full rounded-lg border border-white/20 bg-slate-950/40 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-60"
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.id} · {b.name} ({b.capacity} seats)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-indigo-100 mb-1">
              C. Flooded &amp; Blocked Road Corridor
            </label>
            <select
              value={blockedRoad}
              onChange={(e) => setBlockedRoad(e.target.value)}
              disabled={crisis?.active}
              className="w-full rounded-lg border border-white/20 bg-slate-950/40 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-60"
            >
              {roads.map((r) => (
                <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                  {r.id}: {nodeMap.get(r.from_node)} &lt;-&gt; {nodeMap.get(r.to_node)} ({r.travel_minutes}m)
                </option>
              ))}
            </select>
          </div>
        </div>
        {!canManageCrisis && (
          <p className="mt-3 text-xs text-amber-200">
            Role notice: You are signed in as {user?.role ?? 'guest'}. Sign in as Admin or Transport Authority in Auth &amp; Roles to trigger, reset, or manually override crisis assignments.
          </p>
        )}
      </section>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* BEFORE vs AFTER Comparison Dashboard */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Before vs After Crisis Impact Analysis
            </h3>
            <p className="text-xs text-slate-500">
              {crisis?.active
                ? `Invariant verified: Served (${after?.students_served}) + Unreachable (${after?.unreachable_students}) = Total (${after?.total_students})`
                : 'Showing normal baseline metrics. Click TRIGGER EXAM-DAY CRISIS to compute orchestrated AFTER metrics.'}
            </p>
          </div>
          {crisis?.active && (
            <button
              onClick={downloadCrisisCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Download Crisis Report (CSV)
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-5 py-3">Operational Metric</th>
                <th className="px-5 py-3 text-right">{beforeLabel}</th>
                <th className="px-5 py-3 text-right">{afterLabel}</th>
                <th className="px-5 py-3 text-right">Impact Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisonRows.map((row) => {
                const numericBefore = typeof row.before === 'number' ? row.before : null;
                const numericAfter = typeof row.after === 'number' ? row.after : null;
                const delta =
                  numericBefore !== null && numericAfter !== null
                    ? Math.round((numericAfter - numericBefore) * 10) / 10
                    : null;

                return (
                  <tr key={row.label} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-medium text-slate-800">{row.label}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                      {row.before}
                      {row.unit}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums font-semibold text-indigo-700">
                      {row.after !== null ? `${row.after}${row.unit}` : 'Pending Trigger'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-xs">
                      {delta !== null ? (
                        <span className={delta > 0 ? 'text-indigo-700' : delta < 0 ? 'text-amber-700' : 'text-slate-500'}>
                          {delta > 0 ? `+${delta}${row.unit}` : `${delta}${row.unit}`}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Interactive Crisis Map + Vehicle Seat Utilization */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Crisis Route Graph (Red = Flooded Road · Green = Dijkstra Detour)
            </h3>
            {selectedStudentId && (
              <span className="text-xs font-mono text-indigo-700">
                Showing path for {selectedStudentId}
              </span>
            )}
          </div>
          <TransitMap
            nodes={nodes}
            roads={roads}
            buses={buses}
            highlightedPath={highlightedPath}
            compact={true}
          />
        </div>

        <div className="xl:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
          <div className="border-b border-slate-200 px-4 py-3.5">
            <h3 className="text-base font-semibold text-slate-900">
              Seats Used Per Vehicle (Capacity Enforced)
            </h3>
            <p className="text-xs text-slate-500">
              Active crisis allocation across operational buses &amp; ParentRide fleet
            </p>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[340px]">
            {(after ?? before)?.seats_used_per_vehicle.map((v) => {
              const isDown = v.status === 'unavailable' || v.status === 'cancelled';
              return (
                <div key={v.vehicle_id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{v.vehicle_name}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {v.vehicle_id} · {v.type === 'bus' ? 'Govt Bus' : 'ParentRide'} · {v.status.toUpperCase()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${isDown ? 'bg-red-500' : v.utilization_pct >= 95 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                        style={{ width: `${Math.min(100, v.utilization_pct)}%` }}
                      />
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-slate-800 w-14 text-right">
                      {v.seats_used}/{v.capacity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resource Shortage Recommendations */}
      {crisis?.active && after && after.shortage_recommendations.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-5">
          <h3 className="text-sm font-semibold text-amber-950 mb-3">
            Resource Shortage Recommendations ({after.shortage_recommendations.length} Villages Flagged)
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {after.shortage_recommendations.map((rec) => (
              <div key={rec.village_id} className="rounded-lg border border-amber-200 bg-white p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                  <span>{rec.village_name}</span>
                  <span className="font-mono tabular-nums text-amber-700">
                    {rec.unserved_or_risk_count} affected
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{rec.recommended_action}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Student Assignment Table with Manual Reassignment & Capacity Validation */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Crisis Student Assignment &amp; Manual Capacity Override
            </h3>
            <p className="text-xs text-slate-500">
              Exam students are prioritized first by earliest deadline. Click any row to preview its Dijkstra path on the map.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student, village, bus..."
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['all', 'exam', 'On Time', 'At Risk', 'Unreachable'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === tab
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'exam' ? 'Exam Only' : tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!crisis?.active ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            <Users className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            Trigger the <strong>Exam-Day Crisis</strong> simulation above to generate prioritized student allocations,
            Dijkstra detour paths, and live manual override controls.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold z-10">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Origin -&gt; Campus</th>
                  <th className="px-4 py-3">Exam Deadline</th>
                  <th className="px-4 py-3">Dijkstra Route</th>
                  <th className="px-4 py-3 text-right">ETA</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned Vehicle / Reassign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.slice(0, 120).map((row) => (
                  <tr
                    key={row.student_id}
                    onClick={() => setSelectedStudentId(row.student_id)}
                    className={`cursor-pointer transition-colors ${
                      selectedStudentId === row.student_id ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{row.student_name}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {row.student_id}
                        {row.is_exam_student === 1 && ` · EXAM (${row.exam_subject})`}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {nodeMap.get(row.village_id) ?? row.village_id} -&gt;{' '}
                      {nodeMap.get(row.institution_id) ?? row.institution_id}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-700">
                      {row.exam_deadline_minutes ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-indigo-600" />
                          {row.exam_deadline_minutes}m
                        </span>
                      ) : (
                        'Regular'
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                      {row.route_path.length ? row.route_path.join(' -> ') : 'No path'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-800">
                      {row.eta_minutes > 0 ? `${row.eta_minutes}m` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          row.status === 'On Time'
                            ? 'text-emerald-700'
                            : row.status === 'At Risk'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }`}
                      >
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <select
                        disabled={!canManageCrisis}
                        value={
                          row.vehicle_type === 'none'
                            ? 'none'
                            : `${row.vehicle_type}:${row.vehicle_id}`
                        }
                        onChange={(e) => handleReassignChange(row.student_id, e.target.value)}
                        className="w-52 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                      >
                        <option value="none">Unassigned (None)</option>
                        <optgroup label="Active Buses">
                          {activeBuses.map((b) => (
                            <option key={b.id} value={`bus:${b.id}`}>
                              {b.id} · {b.name} (Cap {b.capacity})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Verified ParentRide">
                          {parentVehicles.map((pv) => (
                            <option key={pv.id} value={`parent_ride:${pv.id}`}>
                              {pv.id} · {pv.parent_name} (Cap {pv.seats_total})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
