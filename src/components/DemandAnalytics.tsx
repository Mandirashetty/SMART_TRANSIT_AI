import React from 'react';
import { Download } from 'lucide-react';
import { DemandAnalyticsRow } from '../types';

interface Props {
  heading: string;
  analytics: DemandAnalyticsRow[];
}

export const DemandAnalytics: React.FC<Props> = ({ heading, analytics }) => {
  const maxVal = Math.max(
    10,
    ...analytics.map((r) => Math.max(r.current_demand, r.available_capacity, r.forecast_exam_peak))
  );

  const downloadCsv = () => {
    const headers = [
      'Village ID',
      'Village Name',
      'Population',
      'Current Demand',
      'Exam Students',
      'Bus Capacity',
      'ParentRide Capacity',
      'Total Available Capacity',
      'Shortage',
      'Forecast Next Week',
      'Forecast Exam Peak (+40%)',
    ];
    const lines = [headers.join(',')];
    for (const r of analytics) {
      lines.push(
        [
          r.village_id,
          `"${r.village_name}"`,
          r.population,
          r.current_demand,
          r.exam_students,
          r.bus_capacity,
          r.parent_ride_capacity,
          r.available_capacity,
          r.shortage,
          r.forecast_next_week,
          r.forecast_exam_peak,
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smarttransit_demand_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalDemand = analytics.reduce((s, r) => s + r.current_demand, 0);
  const totalCap = analytics.reduce((s, r) => s + r.available_capacity, 0);
  const totalShortage = analytics.reduce((s, r) => s + r.shortage, 0);
  const totalForecast = analytics.reduce((s, r) => s + r.forecast_exam_peak, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-indigo-700">SIMULATED DEMAND &amp; CAPACITY MODEL</p>
          <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
        </div>
        <button
          onClick={downloadCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:from-blue-700 hover:to-indigo-700 cursor-pointer whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          Download Demand CSV
        </button>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Current Student Demand</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">{totalDemand}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Available Seat Capacity</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-indigo-700">{totalCap}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Aggregate Village Shortage</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700">{totalShortage}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Exam Peak Forecast (+40%)</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-purple-700">{totalForecast}</div>
        </div>
      </div>

      {/* Interactive SVG Grouped Bar Chart: Demand vs Capacity vs Exam Forecast */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            Village-Wise Demand vs Available Capacity &amp; Peak Forecast
          </h3>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-600" />
              Current Demand
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />
              Available Capacity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-600" />
              Exam Peak Forecast
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg viewBox="0 0 880 280" className="w-full min-w-[680px] h-auto">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = 225 - t * 185;
              const val = Math.round(maxVal * t);
              return (
                <g key={t}>
                  <line x1="48" y1={y} x2="860" y2={y} stroke="#E2E8F0" strokeWidth="1" />
                  <text
                    x="40"
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fill="#64748B"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {analytics.map((row, idx) => {
              const groupX = 65 + idx * 98;
              const barW = 20;
              const hDemand = (row.current_demand / maxVal) * 185;
              const hCap = (row.available_capacity / maxVal) * 185;
              const hPeak = (row.forecast_exam_peak / maxVal) * 185;

              return (
                <g key={row.village_id}>
                  <rect
                    x={groupX}
                    y={225 - hDemand}
                    width={barW}
                    height={hDemand}
                    rx="3"
                    fill="#2563EB"
                  />
                  <rect
                    x={groupX + 24}
                    y={225 - hCap}
                    width={barW}
                    height={hCap}
                    rx="3"
                    fill="#16A34A"
                  />
                  <rect
                    x={groupX + 48}
                    y={225 - hPeak}
                    width={barW}
                    height={hPeak}
                    rx="3"
                    fill="#7C3AED"
                  />
                  <text
                    x={groupX + 34}
                    y="244"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="#334155"
                  >
                    {row.village_id}
                  </text>
                  <text
                    x={groupX + 34}
                    y="258"
                    textAnchor="middle"
                    fontSize="9"
                    fill="#64748B"
                  >
                    {row.village_name.split(' ')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Village Data Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3">Village</th>
                <th className="px-4 py-3 text-right">Demand</th>
                <th className="px-4 py-3 text-right">Exam Candidates</th>
                <th className="px-4 py-3 text-right">Bus Cap</th>
                <th className="px-4 py-3 text-right">ParentRide Cap</th>
                <th className="px-4 py-3 text-right">Shortage</th>
                <th className="px-4 py-3 text-right">Next Week Forecast</th>
                <th className="px-4 py-3 text-right">Exam Peak Forecast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.map((r) => (
                <tr key={r.village_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.village_id} · {r.village_name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{r.current_demand}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-indigo-700">
                    {r.exam_students}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{r.bus_capacity}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{r.parent_ride_capacity}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                      r.shortage > 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {r.shortage}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{r.forecast_next_week}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-purple-700 font-semibold">
                    {r.forecast_exam_peak}
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
