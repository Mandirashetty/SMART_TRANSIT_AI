import React from 'react';
import { TransitBus, TransitNode, TransitRoad } from '../types';

interface Props {
  nodes: TransitNode[];
  roads: TransitRoad[];
  buses: TransitBus[];
  highlightedPath?: string[];
  selectedBusId?: string | null;
  onSelectBus?: (bus: TransitBus) => void;
  compact?: boolean;
}

export const TransitMap: React.FC<Props> = ({
  nodes,
  roads,
  buses,
  highlightedPath = [],
  selectedBusId = null,
  onSelectBus,
  compact = false,
}) => {
  const nodeMap = new Map<string, TransitNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const isEdgeHighlighted = (a: string, b: string) => {
    for (let i = 0; i < highlightedPath.length - 1; i++) {
      if (
        (highlightedPath[i] === a && highlightedPath[i + 1] === b) ||
        (highlightedPath[i] === b && highlightedPath[i + 1] === a)
      ) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-mono text-[11px] font-medium text-indigo-300">SIMULATED GPS &amp; ROAD NETWORK</span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400" />
            Village (8)
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-400" />
            Institution (3)
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="inline-block h-0.5 w-4 bg-red-500" />
            Flooded / Blocked Road
          </span>
          {highlightedPath.length > 1 && (
            <span className="flex items-center gap-1.5 text-emerald-300">
              <span className="inline-block h-0.5 w-4 bg-emerald-400" />
              Dijkstra Alternative Route
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span>On Time: Green</span>
          <span>Delayed: Amber</span>
          <span>Unavailable: Red</span>
        </div>
      </div>

      <svg
        viewBox="0 0 940 465"
        className={`w-full ${compact ? 'h-[320px]' : 'h-[410px]'} block`}
        role="img"
        aria-label="Interactive rural student transportation road network map"
      >
        {/* Subtle coordinate grid */}
        <defs>
          <pattern id="transitGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="0.7" />
          </pattern>
        </defs>
        <rect width="940" height="465" fill="url(#transitGrid)" />

        {/* Road Edges */}
        {roads.map((road) => {
          const from = nodeMap.get(road.from_node);
          const to = nodeMap.get(road.to_node);
          if (!from || !to) return null;
          const blocked = road.is_blocked === 1;
          const highlighted = !blocked && isEdgeHighlighted(road.from_node, road.to_node);
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;

          return (
            <g key={road.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={blocked ? '#EF4444' : highlighted ? '#34D399' : '#334155'}
                strokeWidth={blocked ? 4 : highlighted ? 4.5 : 2.2}
                strokeDasharray={blocked ? '8 6' : undefined}
                opacity={blocked ? 0.95 : highlighted ? 1 : 0.85}
              />
              {/* Road duration label */}
              <rect
                x={midX - 18}
                y={midY - 9}
                width="36"
                height="16"
                rx="3"
                fill={blocked ? '#7F1D1D' : '#0F172A'}
                stroke={blocked ? '#EF4444' : highlighted ? '#10B981' : '#334155'}
                strokeWidth="0.8"
              />
              <text
                x={midX}
                y={midY + 2}
                textAnchor="middle"
                fontSize="8.5"
                fontFamily="JetBrains Mono, monospace"
                fill={blocked ? '#FECACA' : highlighted ? '#6EE7B7' : '#94A3B8'}
              >
                {blocked ? 'FLOOD' : `${road.travel_minutes}m`}
              </text>
            </g>
          );
        })}

        {/* Villages and Institutions */}
        {nodes.map((node) => {
          const isInst = node.type === 'institution';
          const inHighlight = highlightedPath.includes(node.id);

          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              {isInst ? (
                <rect
                  x="-11"
                  y="-11"
                  width="22"
                  height="22"
                  rx="4"
                  fill={inHighlight ? '#7C3AED' : '#4F46E5'}
                  stroke="#E0E7FF"
                  strokeWidth="2"
                />
              ) : (
                <circle
                  r={inHighlight ? 10 : 8.5}
                  fill={inHighlight ? '#10B981' : '#2563EB'}
                  stroke="#F8FAFC"
                  strokeWidth="2"
                />
              )}
              <text
                y="2"
                textAnchor="middle"
                fontSize="7.5"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
                fill="#FFFFFF"
              >
                {node.id}
              </text>
              <rect
                x="-56"
                y="14"
                width="112"
                height="16"
                rx="3"
                fill="#0F172A"
                fillOpacity="0.88"
              />
              <text
                y="25"
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="600"
                fill={isInst ? '#C4B5FD' : '#E2E8F0'}
              >
                {node.name}
              </text>
            </g>
          );
        })}

        {/* Live Simulated Buses */}
        {buses.map((bus, idx) => {
          const stops = bus.route_stops;
          const fromNode = nodeMap.get(stops[bus.current_stop_idx] ?? stops[0]);
          const toNode = nodeMap.get(stops[Math.min(stops.length - 1, bus.current_stop_idx + 1)] ?? stops[0]);
          if (!fromNode || !toNode) return null;

          // Slight offset so overlapping buses remain clickable
          const offsetAngle = (idx % 4) * 0.4;
          const bx = fromNode.x + (toNode.x - fromNode.x) * bus.progress + Math.cos(offsetAngle) * 6;
          const by = fromNode.y + (toNode.y - fromNode.y) * bus.progress + Math.sin(offsetAngle) * 6;

          const color =
            bus.status === 'on_time'
              ? '#16A34A'
              : bus.status === 'delayed'
                ? '#D97706'
                : '#DC2626';
          const isSelected = selectedBusId === bus.id;

          return (
            <g
              key={bus.id}
              transform={`translate(${bx}, ${by})`}
              onClick={() => onSelectBus?.(bus)}
              className="cursor-pointer"
            >
              {isSelected && <circle r="15" fill="none" stroke="#FFFFFF" strokeWidth="2" />}
              <rect
                x="-14"
                y="-10"
                width="28"
                height="18"
                rx="4"
                fill={color}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
              <text
                y="2"
                textAnchor="middle"
                fontSize="8"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
                fill="#FFFFFF"
              >
                {bus.id.replace('BUS-', 'B')}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
