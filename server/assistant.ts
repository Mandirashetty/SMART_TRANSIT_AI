import { GoogleGenAI } from '@google/genai';
import { DatabaseSync } from 'node:sqlite';
import { BusRecord, NodeRecord, ParentVehicleRecord, RoadRecord } from './db.js';
import { dijkstraShortestPath } from './routing.js';

interface AssistantContext {
  nodes: NodeRecord[];
  roads: RoadRecord[];
  buses: BusRecord[];
  parentVehicles: ParentVehicleRecord[];
  activeAlerts: { title: string; message: string; severity: string }[];
  crisisActive: boolean;
  blockedRoadId: string | null;
  brokenBusIds: string[];
  afterSummary: {
    total_students: number;
    students_served: number;
    exam_students_reaching_on_time: number;
    exam_students_total: number;
    unreachable_students: number;
  } | null;
}

function loadContext(db: DatabaseSync): AssistantContext {
  const nodes = db.prepare('SELECT * FROM nodes').all() as unknown as NodeRecord[];
  const roads = db.prepare('SELECT * FROM roads').all() as unknown as RoadRecord[];
  const buses = db.prepare('SELECT * FROM buses').all() as unknown as BusRecord[];
  const parentVehicles = db.prepare('SELECT * FROM parent_vehicles WHERE verified = 1').all() as unknown as ParentVehicleRecord[];
  const activeAlerts = db
    .prepare('SELECT title, message, severity FROM alerts ORDER BY created_at DESC LIMIT 5')
    .all() as unknown as { title: string; message: string; severity: string }[];
  const crisisRow = db.prepare('SELECT * FROM crisis_state WHERE id = 1').get() as
    | {
        active: number;
        blocked_road_id: string | null;
        broken_bus_ids: string;
        after_metrics: string | null;
      }
    | undefined;

  return {
    nodes,
    roads,
    buses,
    parentVehicles,
    activeAlerts,
    crisisActive: crisisRow?.active === 1,
    blockedRoadId: crisisRow?.blocked_road_id ?? null,
    brokenBusIds: crisisRow ? JSON.parse(crisisRow.broken_bus_ids) : [],
    afterSummary: crisisRow?.after_metrics ? JSON.parse(crisisRow.after_metrics) : null,
  };
}

function ruleBasedAnswer(query: string, ctx: AssistantContext): string {
  const q = query.toLowerCase();
  const nodeName = (id: string) => ctx.nodes.find((n) => n.id === id)?.name ?? id;

  // Check if user asks about a specific bus ID or bus list
  const busMatch = q.match(/bus[- ]?(\d{1,2})/i);
  if (busMatch) {
    const num = busMatch[1].padStart(2, '0');
    const bus = ctx.buses.find((b) => b.id === `BUS-${num}`);
    if (bus) {
      const stops: string[] = JSON.parse(bus.route_stops);
      return [
        `${bus.name} (${bus.reg_number}) — Live DB Status: ${bus.status.toUpperCase()}.`,
        `Driver: ${bus.driver_name} (${bus.driver_phone}) | Capacity: ${bus.capacity} seats.`,
        `Route: ${stops.map(nodeName).join(' -> ')}.`,
        `Current ETA: ${bus.eta_minutes} min (Delay: ${bus.delay_minutes} min). [SIMULATED DATA]`,
      ].join('\n');
    }
  }

  // Check if user mentions two places (route query)
  const mentionedNodes = ctx.nodes.filter((n) => q.includes(n.name.toLowerCase()) || q.includes(n.id.toLowerCase()));
  if (mentionedNodes.length >= 2) {
    const from = mentionedNodes[0];
    const to = mentionedNodes[1];
    const path = dijkstraShortestPath(ctx.nodes, ctx.roads, from.id, to.id, true);
    if (!path.reachable) {
      return `No unblocked road path currently exists between ${from.name} and ${to.name} in the database.`;
    }
    const matchingBuses = ctx.buses.filter((b) => {
      if (b.status === 'unavailable' || b.status === 'cancelled') return false;
      const stops: string[] = JSON.parse(b.route_stops);
      return stops.includes(from.id) || stops.includes(to.id);
    });
    const matchingParents = ctx.parentVehicles.filter(
      (pv) => pv.seats_available > 0 && (pv.origin_node_id === from.id || pv.destination_node_id === to.id)
    );
    return [
      `Dijkstra Shortest Unblocked Route (${from.name} -> ${to.name}):`,
      `Path: ${path.path.map(nodeName).join(' -> ')} (${path.totalKm} km, ~${path.totalMinutes} min).`,
      `Active Buses serving corridor: ${matchingBuses.length > 0 ? matchingBuses.map((b) => `${b.id} ${b.name} (${b.status}, ETA ${b.eta_minutes}m, ${b.capacity} seats)`).join('; ') : 'None directly; transfer required'}.`,
      `ParentRide seats available nearby: ${matchingParents.length > 0 ? matchingParents.map((p) => `${p.id} ${p.parent_name} (${p.seats_available} seats)`).join('; ') : 'None directly on this pair'}.`,
    ].join('\n');
  }

  // Crisis query
  if (q.includes('crisis') || q.includes('exam') || q.includes('flood') || q.includes('blocked')) {
    if (!ctx.crisisActive) {
      const examTotal = 30;
      return `Exam-Day Crisis Mode is currently INACTIVE. Baseline fleet: ${ctx.buses.filter((b) => b.status !== 'unavailable' && b.status !== 'cancelled').length}/${ctx.buses.length} buses operational, ${examTotal} examination students tracked, all ${ctx.roads.length} road segments open.`;
    }
    const blocked = ctx.roads.find((r) => r.id === ctx.blockedRoadId);
    const roadLabel = blocked ? `${nodeName(blocked.from_node)} <-> ${nodeName(blocked.to_node)}` : ctx.blockedRoadId;
    return [
      `EXAM-DAY CRISIS IS ACTIVE:`,
      `• Blocked Road: ${roadLabel} (flooded).`,
      `• Unavailable Buses: ${ctx.brokenBusIds.join(', ')}.`,
      ctx.afterSummary
        ? `• Allocation Summary: ${ctx.afterSummary.students_served}/${ctx.afterSummary.total_students} students served, ${ctx.afterSummary.exam_students_reaching_on_time}/${ctx.afterSummary.exam_students_total} exam candidates on time, ${ctx.afterSummary.unreachable_students} unreachable.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  // ParentRide query
  if (q.includes('parent') || q.includes('carpool') || q.includes('seat')) {
    const avail = ctx.parentVehicles.filter((p) => p.seats_available > 0);
    if (avail.length === 0) {
      return 'All verified ParentRide vehicles currently have 0 open seats in the database.';
    }
    return [
      `Verified ParentRide Vehicles with Open Seats (${avail.length}):`,
      ...avail.map(
        (p) =>
          `• ${p.id}: ${p.parent_name} (${p.vehicle_model}, ${p.reg_number}) | ${nodeName(p.origin_node_id)} -> ${nodeName(p.destination_node_id)} | ${p.seats_available}/${p.seats_total} seats open | Departs in ${p.departure_minutes}m`
      ),
    ].join('\n');
  }

  // SOS / Emergency query
  if (q.includes('sos') || q.includes('emergency') || q.includes('helpline') || q.includes('police')) {
    return 'Indian Emergency Numbers available via the always-visible SOS button: 112 (National Emergency), 100 (Police), 108 (Ambulance), 1098 (Childline), and 1091 (Women Helpline). Use the red SOS button in the top bar to log an incident directly to the Admin dashboard.';
  }

  // Delay / status / bus summary
  const delayed = ctx.buses.filter((b) => b.status === 'delayed');
  const unavailable = ctx.buses.filter((b) => b.status === 'unavailable' || b.status === 'cancelled');
  const onTime = ctx.buses.filter((b) => b.status === 'on_time');
  const totalOpenParentSeats = ctx.parentVehicles.reduce((s, p) => s + p.seats_available, 0);

  return [
    `Live SmartTransit AI Database Summary (SIMULATED DATA):`,
    `• Buses: ${onTime.length} On Time, ${delayed.length} Delayed${delayed.length ? ` (${delayed.map((b) => `${b.id} +${b.delay_minutes}m`).join(', ')})` : ''}, ${unavailable.length} Cancelled/Unavailable${unavailable.length ? ` (${unavailable.map((b) => b.id).join(', ')})` : ''}.`,
    `• Verified ParentRide: ${ctx.parentVehicles.length} vehicles with ${totalOpenParentSeats} open seats total.`,
    `• Crisis Mode: ${ctx.crisisActive ? 'ACTIVE (Dijkstra detouring enabled)' : 'Standby (normal operations)'}.`,
    `Ask about a specific bus (e.g., "Status of BUS-01"), a village route (e.g., "Route from Tavarekere to Govt Polytechnic College"), ParentRide seats, or Crisis status.`,
  ].join('\n');
}

export async function answerTransitQuestion(
  db: DatabaseSync,
  question: string
): Promise<{ answer: string; source: 'gemini' | 'rule_engine' }> {
  const ctx = loadContext(db);
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const snapshot = {
        nodes: ctx.nodes.map((n) => ({ id: n.id, name: n.name, type: n.type })),
        blockedRoads: ctx.roads
          .filter((r) => r.is_blocked === 1)
          .map((r) => `${r.id}: ${r.from_node} <-> ${r.to_node}`),
        buses: ctx.buses.map((b) => ({
          id: b.id,
          name: b.name,
          reg: b.reg_number,
          status: b.status,
          delay_min: b.delay_minutes,
          eta_min: b.eta_minutes,
          capacity: b.capacity,
          stops: JSON.parse(b.route_stops),
        })),
        parentVehicles: ctx.parentVehicles.map((p) => ({
          id: p.id,
          parent: p.parent_name,
          model: p.vehicle_model,
          from: p.origin_node_id,
          to: p.destination_node_id,
          seats_available: p.seats_available,
          seats_total: p.seats_total,
          departure_min: p.departure_minutes,
        })),
        recentAlerts: ctx.activeAlerts,
        crisisActive: ctx.crisisActive,
        crisisSummary: ctx.afterSummary,
      };

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Database Snapshot (SIMULATED DATA):\n${JSON.stringify(snapshot)}\n\nUser Question: ${question}`,
        config: {
          systemInstruction:
            'You are SmartTransit AI Assistant for rural student transportation. Answer strictly using ONLY the provided SQLite Database Snapshot. NEVER invent bus timings, routes, capacities, or seat availability not present in the snapshot. Keep answers concise, structured, and under 120 words. Mention [SIMULATED DATA] when citing live timings.',
        },
      });

      if (response.text && response.text.trim().length > 0) {
        return { answer: response.text.trim(), source: 'gemini' };
      }
    } catch {
      // Fall through gracefully to deterministic SQLite rule engine
    }
  }

  return { answer: ruleBasedAnswer(question, ctx), source: 'rule_engine' };
}
