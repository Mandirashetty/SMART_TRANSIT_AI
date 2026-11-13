import React from 'react';
import { SosReport, TransitNode, User } from '../types';

interface Props {
  heading: string;
  reports: SosReport[];
  nodes: TransitNode[];
  user: User | null;
  onUpdateStatus: (id: string, status: 'active' | 'dispatched' | 'resolved') => Promise<void>;
}

export const SosAdminView: React.FC<Props> = ({
  heading,
  reports,
  nodes,
  user,
  onUpdateStatus,
}) => {
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const canManage = user?.role === 'admin' || user?.role === 'authority';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono text-red-700">INDIAN HELPLINE LOGS · 112 / 100 / 108 / 1098 / 1091</p>
        <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3">SOS ID</th>
                <th className="px-4 py-3">Caller</th>
                <th className="px-4 py-3">Helpline</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Admin Dispatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{r.user_name}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {r.user_role} · {r.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-red-700">{r.emergency_number}</td>
                  <td className="px-4 py-3 text-slate-700">{nodeName(r.location_node_id)}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs">{r.notes}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-mono text-[11px] font-bold uppercase ${
                        r.status === 'active'
                          ? 'text-red-700'
                          : r.status === 'dispatched'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={!canManage || r.status === 'dispatched'}
                        onClick={() => onUpdateStatus(r.id, 'dispatched')}
                        className="rounded border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        Dispatch
                      </button>
                      <button
                        disabled={!canManage || r.status === 'resolved'}
                        onClick={() => onUpdateStatus(r.id, 'resolved')}
                        className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 cursor-pointer"
                      >
                        Resolve
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
