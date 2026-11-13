import { DatabaseSync } from 'node:sqlite';
import {
  BusRecord,
  NodeRecord,
  ParentVehicleRecord,
  RoadRecord,
  StudentRecord,
  createSeededRandom,
} from './db.js';

/**
 * Binary Min-Heap Priority Queue (TypeScript equivalent of Python heapq)
 * Used by Dijkstra's shortest-path algorithm for O((V + E) log V) routing.
 */
export class MinHeap<T> {
  private heap: { priority: number; value: T }[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(priority: number, value: T): void {
    this.heap.push({ priority, value });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { priority: number; value: T } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.heap[parent].priority <= this.heap[idx].priority) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const len = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < len && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < len && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}

export interface DijkstraResult {
  reachable: boolean;
  totalMinutes: number;
  totalKm: number;
  path: string[];
}

export function dijkstraShortestPath(
  nodes: NodeRecord[],
  roads: RoadRecord[],
  startId: string,
  endId: string,
  respectBlocks = true
): DijkstraResult {
  if (startId === endId) {
    return { reachable: true, totalMinutes: 0, totalKm: 0, path: [startId] };
  }

  const adj = new Map<string, { to: string; minutes: number; km: number }[]>();
  for (const n of nodes) adj.set(n.id, []);

  for (const r of roads) {
    if (respectBlocks && r.is_blocked === 1) continue;
    adj.get(r.from_node)?.push({ to: r.to_node, minutes: r.travel_minutes, km: r.distance_km });
    adj.get(r.to_node)?.push({ to: r.from_node, minutes: r.travel_minutes, km: r.distance_km });
  }

  const dist = new Map<string, number>();
  const kmMap = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const pq = new MinHeap<string>();

  for (const n of nodes) {
    dist.set(n.id, Infinity);
    kmMap.set(n.id, Infinity);
    prev.set(n.id, null);
  }

  dist.set(startId, 0);
  kmMap.set(startId, 0);
  pq.push(0, startId);

  while (pq.size > 0) {
    const current = pq.pop()!;
    const u = current.value;
    if (current.priority > (dist.get(u) ?? Infinity)) continue;
    if (u === endId) break;

    for (const edge of adj.get(u) ?? []) {
      const alt = (dist.get(u) ?? Infinity) + edge.minutes;
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        kmMap.set(edge.to, (kmMap.get(u) ?? 0) + edge.km);
        prev.set(edge.to, u);
        pq.push(alt, edge.to);
      }
    }
  }

  const totalMinutes = dist.get(endId) ?? Infinity;
  if (!Number.isFinite(totalMinutes)) {
    return { reachable: false, totalMinutes: 999, totalKm: 0, path: [] };
  }

  const path: string[] = [];
  let curr: string | null = endId;
  while (curr) {
    path.unshift(curr);
    curr = prev.get(curr) ?? null;
  }

  return {
    reachable: true,
    totalMinutes: Math.round(totalMinutes * 10) / 10,
    totalKm: Math.round((kmMap.get(endId) ?? 0) * 10) / 10,
    path,
  };
}

export interface RouteRescueOption {
  id: string;
  mode: 'Direct Bus' | 'Transfer Bus + Walk' | 'ParentRide Carpool' | 'Dijkstra Road Reroute';
  providerName: string;
  vehicleReg: string;
  stopsPath: string[];
  estimatedMinutes: number;
  distanceKm: number;
  seatsRemaining: number;
  reliabilityNote: string;
}

export function computeRouteRescueOptions(
  db: DatabaseSync,
  originId: string,
  destinationId: string
): RouteRescueOption[] {
  const nodes = db.prepare('SELECT * FROM nodes').all() as unknown as NodeRecord[];
  const roads = db.prepare('SELECT * FROM roads').all() as unknown as RoadRecord[];
  const buses = db.prepare('SELECT * FROM buses').all() as unknown as BusRecord[];
  const parentVehicles = db.prepare('SELECT * FROM parent_vehicles WHERE verified = 1').all() as unknown as ParentVehicleRecord[];

  const shortest = dijkstraShortestPath(nodes, roads, originId, destinationId, true);
  const options: RouteRescueOption[] = [];

  // 1. Evaluate active buses
  for (const bus of buses) {
    if (bus.status === 'cancelled' || bus.status === 'unavailable') continue;
    const stops: string[] = JSON.parse(bus.route_stops);
    const hasOrigin = stops.includes(originId);
    const hasDest = stops.includes(destinationId);

    // Check if any segment along the bus route is blocked
    let routeBlocked = false;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      const seg = roads.find(
        (r) => (r.from_node === a && r.to_node === b) || (r.from_node === b && r.to_node === a)
      );
      if (seg && seg.is_blocked === 1) {
        routeBlocked = true;
      }
    }

    if (hasOrigin && hasDest && !routeBlocked) {
      const oIdx = stops.indexOf(originId);
      const dIdx = stops.indexOf(destinationId);
      const subStops = oIdx <= dIdx ? stops.slice(oIdx, dIdx + 1) : [...stops.slice(dIdx, oIdx + 1)].reverse();
      const legTime = Math.max(10, Math.round(shortest.totalMinutes + bus.delay_minutes + 4));
      options.push({
        id: bus.id,
        mode: 'Direct Bus',
        providerName: bus.name,
        vehicleReg: bus.reg_number,
        stopsPath: subStops,
        estimatedMinutes: legTime,
        distanceKm: shortest.totalKm,
        seatsRemaining: bus.capacity,
        reliabilityNote: bus.status === 'delayed' ? `Delayed +${bus.delay_minutes}m` : 'On Schedule',
      });
    } else if (hasOrigin || hasDest || stops.some((s) => shortest.path.includes(s))) {
      // Transfer via Dijkstra to nearest stop
      const nearestHub = stops[Math.min(stops.length - 1, 1)];
      const leg1 = dijkstraShortestPath(nodes, roads, originId, nearestHub, true);
      const leg2 = dijkstraShortestPath(nodes, roads, nearestHub, destinationId, true);
      if (leg1.reachable && leg2.reachable) {
        const mergedPath = [...leg1.path, ...leg2.path.slice(1)];
        const estMin = Math.round(leg1.totalMinutes + leg2.totalMinutes + bus.delay_minutes + 9);
        options.push({
          id: `${bus.id}-XFER`,
          mode: 'Transfer Bus + Walk',
          providerName: `${bus.name} (via ${nodes.find((n) => n.id === nearestHub)?.name ?? nearestHub})`,
          vehicleReg: bus.reg_number,
          stopsPath: mergedPath,
          estimatedMinutes: estMin,
          distanceKm: Math.round((leg1.totalKm + leg2.totalKm) * 10) / 10,
          seatsRemaining: bus.capacity,
          reliabilityNote: routeBlocked ? 'Detour around blocked road' : 'Hub transfer option',
        });
      }
    }
  }

  // 2. Evaluate Verified ParentRide vehicles
  for (const pv of parentVehicles) {
    if (pv.seats_available <= 0) continue;
    const legToPickup = dijkstraShortestPath(nodes, roads, originId, pv.origin_node_id, true);
    const legToDest = dijkstraShortestPath(nodes, roads, pv.origin_node_id, destinationId, true);
    if (legToPickup.reachable && legToDest.reachable) {
      const est = Math.round(legToPickup.totalMinutes * 0.6 + legToDest.totalMinutes + pv.departure_minutes * 0.4);
      options.push({
        id: pv.id,
        mode: 'ParentRide Carpool',
        providerName: `${pv.parent_name} (${pv.vehicle_model})`,
        vehicleReg: pv.reg_number,
        stopsPath: [...legToPickup.path, ...legToDest.path.slice(1)],
        estimatedMinutes: est,
        distanceKm: Math.round((legToPickup.totalKm + legToDest.totalKm) * 10) / 10,
        seatsRemaining: pv.seats_available,
        reliabilityNote: `Verified Parent · Departs in ${pv.departure_minutes}m`,
      });
    }
  }

  // 3. Always surface best Dijkstra unblocked corridor
  if (shortest.reachable) {
    options.push({
      id: `DIJKSTRA-${originId}-${destinationId}`,
      mode: 'Dijkstra Road Reroute',
      providerName: 'Optimal Unblocked Emergency Corridor',
      vehicleReg: 'SHUTTLE-DISPATCH',
      stopsPath: shortest.path,
      estimatedMinutes: Math.round(shortest.totalMinutes + 5),
      distanceKm: shortest.totalKm,
      seatsRemaining: 15,
      reliabilityNote: 'Computed via Min-Heap Dijkstra',
    });
  }

  return options.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes).slice(0, 8);
}

export interface CrisisMetricsSummary {
  total_students: number;
  students_served: number;
  students_reaching_on_time: number;
  exam_students_total: number;
  exam_students_reaching_on_time: number;
  students_at_risk: number;
  unreachable_students: number;
  average_delay_minutes: number;
  bus_utilization_pct: number;
  seats_used_per_vehicle: {
    vehicle_id: string;
    vehicle_name: string;
    type: 'bus' | 'parent_ride';
    seats_used: number;
    capacity: number;
    utilization_pct: number;
    status: string;
  }[];
  shortage_recommendations: {
    village_id: string;
    village_name: string;
    unserved_or_risk_count: number;
    recommended_action: string;
  }[];
}

export interface AssignmentRow {
  student_id: string;
  student_name: string;
  village_id: string;
  institution_id: string;
  is_exam_student: number;
  exam_subject: string | null;
  exam_deadline_minutes: number | null;
  vehicle_type: 'bus' | 'parent_ride' | 'none';
  vehicle_id: string | null;
  vehicle_name: string | null;
  route_path: string[];
  travel_minutes: number;
  eta_minutes: number;
  status: 'On Time' | 'At Risk' | 'Unreachable';
  manually_edited: number;
}

function allocateStudents(
  nodes: NodeRecord[],
  roads: RoadRecord[],
  buses: BusRecord[],
  parentVehicles: ParentVehicleRecord[],
  students: StudentRecord[],
  isCrisis: boolean
): { assignments: AssignmentRow[]; metrics: CrisisMetricsSummary } {
  const busUsage = new Map<string, number>();
  for (const b of buses) busUsage.set(b.id, 0);

  const pvUsage = new Map<string, number>();
  for (const pv of parentVehicles) pvUsage.set(pv.id, 0);

  // Cache shortest paths between (village, institution)
  const pathCache = new Map<string, DijkstraResult>();
  const getPath = (from: string, to: string): DijkstraResult => {
    const key = `${from}->${to}`;
    if (!pathCache.has(key)) {
      pathCache.set(key, dijkstraShortestPath(nodes, roads, from, to, true));
    }
    return pathCache.get(key)!;
  };

  // Prioritize: Exam students first by earliest deadline, then regular students
  const orderedStudents = [...students].sort((a, b) => {
    if (a.is_exam_student !== b.is_exam_student) {
      return b.is_exam_student - a.is_exam_student;
    }
    if (a.is_exam_student && b.is_exam_student) {
      return (a.exam_deadline_minutes ?? 120) - (b.exam_deadline_minutes ?? 120);
    }
    return a.id.localeCompare(b.id);
  });

  const assignments: AssignmentRow[] = [];

  for (const stu of orderedStudents) {
    const directShortest = getPath(stu.village_id, stu.institution_id);
    if (!directShortest.reachable) {
      assignments.push({
        student_id: stu.id,
        student_name: stu.name,
        village_id: stu.village_id,
        institution_id: stu.institution_id,
        is_exam_student: stu.is_exam_student,
        exam_subject: stu.exam_subject,
        exam_deadline_minutes: stu.exam_deadline_minutes,
        vehicle_type: 'none',
        vehicle_id: null,
        vehicle_name: 'No Reachable Corridor',
        route_path: [],
        travel_minutes: 0,
        eta_minutes: 0,
        status: 'Unreachable',
        manually_edited: 0,
      });
      continue;
    }

    // Build candidate vehicles with remaining capacity
    interface Candidate {
      type: 'bus' | 'parent_ride';
      id: string;
      name: string;
      travelMinutes: number;
      etaMinutes: number;
      path: string[];
      score: number;
    }
    const candidates: Candidate[] = [];

    for (const bus of buses) {
      if (bus.status === 'unavailable' || bus.status === 'cancelled') continue;
      const used = busUsage.get(bus.id) ?? 0;
      if (used >= bus.capacity) continue;

      const stops: string[] = JSON.parse(bus.route_stops);
      const servesVillage = stops.includes(stu.village_id);
      const servesInst = stops.includes(stu.institution_id);

      // Check if bus stops near the village or institution
      const pickupHub = servesVillage ? stu.village_id : stops[0];
      const dropHub = servesInst ? stu.institution_id : stops[stops.length - 1];
      const legPickup = getPath(stu.village_id, pickupHub);
      const legMain = getPath(pickupHub, dropHub);
      const legDrop = getPath(dropHub, stu.institution_id);

      if (!legPickup.reachable || !legMain.reachable || !legDrop.reachable) continue;

      const detourPenalty = (servesVillage ? 0 : 7) + (servesInst ? 0 : 6);
      const boardingWait = isCrisis ? 6 : 4;
      const travelMin = Math.round(
        legPickup.totalMinutes * 0.7 + legMain.totalMinutes + legDrop.totalMinutes * 0.7 + bus.delay_minutes + detourPenalty
      );
      const etaMin = travelMin + boardingWait;

      const mergedPath = Array.from(
        new Set([...legPickup.path, ...legMain.path, ...legDrop.path])
      );

      // Strongly prefer buses serving the village directly
      const score = etaMin + (servesVillage && servesInst ? 0 : servesVillage ? 8 : 18);
      candidates.push({
        type: 'bus',
        id: bus.id,
        name: `${bus.name} (${bus.reg_number})`,
        travelMinutes: travelMin,
        etaMinutes: etaMin,
        path: mergedPath,
        score,
      });
    }

    // Consider ParentRide vehicles (especially vital during crisis or for exam students)
    for (const pv of parentVehicles) {
      if (!pv.verified) continue;
      const used = pvUsage.get(pv.id) ?? 0;
      if (used >= pv.seats_total) continue;

      const legToOrigin = getPath(stu.village_id, pv.origin_node_id);
      const legMain = getPath(pv.origin_node_id, pv.destination_node_id);
      const legToDest = getPath(pv.destination_node_id, stu.institution_id);
      if (!legToOrigin.reachable || !legMain.reachable || !legToDest.reachable) continue;

      const travelMin = Math.round(legToOrigin.totalMinutes * 0.5 + legMain.totalMinutes + legToDest.totalMinutes * 0.5);
      const etaMin = travelMin + Math.round(pv.departure_minutes * 0.6);
      const mergedPath = Array.from(
        new Set([...legToOrigin.path, ...legMain.path, ...legToDest.path])
      );
      const sameOriginBonus = pv.origin_node_id === stu.village_id ? -4 : 6;
      candidates.push({
        type: 'parent_ride',
        id: pv.id,
        name: `ParentRide: ${pv.parent_name} (${pv.vehicle_model})`,
        travelMinutes: travelMin,
        etaMinutes: etaMin,
        path: mergedPath,
        score: etaMin + sameOriginBonus,
      });
    }

    candidates.sort((a, b) => a.score - b.score);

    if (candidates.length === 0) {
      assignments.push({
        student_id: stu.id,
        student_name: stu.name,
        village_id: stu.village_id,
        institution_id: stu.institution_id,
        is_exam_student: stu.is_exam_student,
        exam_subject: stu.exam_subject,
        exam_deadline_minutes: stu.exam_deadline_minutes,
        vehicle_type: 'none',
        vehicle_id: null,
        vehicle_name: 'Unassigned (Capacity Exhausted)',
        route_path: directShortest.path,
        travel_minutes: directShortest.totalMinutes,
        eta_minutes: 0,
        status: 'Unreachable',
        manually_edited: 0,
      });
      continue;
    }

    const best = candidates[0];
    if (best.type === 'bus') {
      busUsage.set(best.id, (busUsage.get(best.id) ?? 0) + 1);
    } else {
      pvUsage.set(best.id, (pvUsage.get(best.id) ?? 0) + 1);
    }

    let status: 'On Time' | 'At Risk' | 'Unreachable' = 'On Time';
    if (stu.is_exam_student && stu.exam_deadline_minutes !== null) {
      if (best.etaMinutes > stu.exam_deadline_minutes) {
        status = 'At Risk';
      } else if (stu.exam_deadline_minutes - best.etaMinutes <= 5) {
        status = 'At Risk';
      }
    } else if (best.etaMinutes > 55) {
      status = 'At Risk';
    }

    assignments.push({
      student_id: stu.id,
      student_name: stu.name,
      village_id: stu.village_id,
      institution_id: stu.institution_id,
      is_exam_student: stu.is_exam_student,
      exam_subject: stu.exam_subject,
      exam_deadline_minutes: stu.exam_deadline_minutes,
      vehicle_type: best.type,
      vehicle_id: best.id,
      vehicle_name: best.name,
      route_path: best.path,
      travel_minutes: best.travelMinutes,
      eta_minutes: best.etaMinutes,
      status,
      manually_edited: 0,
    });
  }

  const metrics = buildMetricsSummary(nodes, buses, parentVehicles, assignments, isCrisis);
  return { assignments, metrics };
}

export function buildMetricsSummary(
  nodes: NodeRecord[],
  buses: BusRecord[],
  parentVehicles: ParentVehicleRecord[],
  assignments: AssignmentRow[],
  isCrisis: boolean
): CrisisMetricsSummary {
  const total_students = assignments.length;
  const unreachable_students = assignments.filter((a) => a.status === 'Unreachable').length;
  const students_served = total_students - unreachable_students;
  const students_reaching_on_time = assignments.filter((a) => a.status === 'On Time').length;
  const students_at_risk = assignments.filter((a) => a.status === 'At Risk').length;

  const examRows = assignments.filter((a) => a.is_exam_student === 1);
  const exam_students_total = examRows.length;
  const exam_students_reaching_on_time = examRows.filter((a) => a.status === 'On Time').length;

  // Compute average delay relative to baseline 28 min commute
  const servedRows = assignments.filter((a) => a.status !== 'Unreachable');
  const totalDelay = servedRows.reduce((acc, row) => acc + Math.max(0, row.eta_minutes - 28), 0);
  const average_delay_minutes =
    servedRows.length > 0 ? Math.round((totalDelay / servedRows.length) * 10) / 10 : 0;

  const seats_used_per_vehicle: CrisisMetricsSummary['seats_used_per_vehicle'] = [];
  let activeBusSeatsUsed = 0;
  let activeBusTotalCapacity = 0;

  for (const bus of buses) {
    const used = assignments.filter((a) => a.vehicle_type === 'bus' && a.vehicle_id === bus.id).length;
    const isAvail = bus.status !== 'unavailable' && bus.status !== 'cancelled';
    if (isAvail) {
      activeBusSeatsUsed += used;
      activeBusTotalCapacity += bus.capacity;
    }
    seats_used_per_vehicle.push({
      vehicle_id: bus.id,
      vehicle_name: bus.name,
      type: 'bus',
      seats_used: used,
      capacity: bus.capacity,
      utilization_pct: bus.capacity > 0 ? Math.round((used / bus.capacity) * 1000) / 10 : 0,
      status: bus.status,
    });
  }

  for (const pv of parentVehicles) {
    const used = assignments.filter((a) => a.vehicle_type === 'parent_ride' && a.vehicle_id === pv.id).length;
    seats_used_per_vehicle.push({
      vehicle_id: pv.id,
      vehicle_name: `ParentRide · ${pv.parent_name}`,
      type: 'parent_ride',
      seats_used: used,
      capacity: pv.seats_total,
      utilization_pct: pv.seats_total > 0 ? Math.round((used / pv.seats_total) * 1000) / 10 : 0,
      status: pv.verified ? 'verified' : 'unverified',
    });
  }

  const bus_utilization_pct =
    activeBusTotalCapacity > 0
      ? Math.round((activeBusSeatsUsed / activeBusTotalCapacity) * 1000) / 10
      : 0;

  // Resource shortage recommendations per village
  const villageTrouble = new Map<string, number>();
  for (const a of assignments) {
    if (a.status === 'Unreachable' || a.status === 'At Risk') {
      villageTrouble.set(a.village_id, (villageTrouble.get(a.village_id) ?? 0) + 1);
    }
  }

  const shortage_recommendations: CrisisMetricsSummary['shortage_recommendations'] = [];
  for (const [vId, count] of villageTrouble.entries()) {
    const vName = nodes.find((n) => n.id === vId)?.name ?? vId;
    const shuttlesNeeded = Math.ceil(count / 18);
    shortage_recommendations.push({
      village_id: vId,
      village_name: vName,
      unserved_or_risk_count: count,
      recommended_action: isCrisis
        ? `Dispatch ${shuttlesNeeded} emergency 20-seat reserve shuttle${shuttlesNeeded > 1 ? 's' : ''} or recruit ${Math.ceil(count / 4)} ParentRide vehicles from ${vName}.`
        : `Monitor morning peak load at ${vName}; pre-stage 1 feeder van if demand grows.`,
    });
  }
  shortage_recommendations.sort((a, b) => b.unserved_or_risk_count - a.unserved_or_risk_count);

  return {
    total_students,
    students_served,
    students_reaching_on_time,
    exam_students_total,
    exam_students_reaching_on_time,
    students_at_risk,
    unreachable_students,
    average_delay_minutes,
    bus_utilization_pct,
    seats_used_per_vehicle,
    shortage_recommendations,
  };
}

export function computeBaselineMetrics(db: DatabaseSync): CrisisMetricsSummary {
  const nodes = db.prepare('SELECT * FROM nodes').all() as unknown as NodeRecord[];
  const roads = db.prepare('SELECT * FROM roads').all() as unknown as RoadRecord[];
  const buses = db.prepare('SELECT * FROM buses').all() as unknown as BusRecord[];
  const parentVehicles = db.prepare('SELECT * FROM parent_vehicles').all() as unknown as ParentVehicleRecord[];
  const students = db.prepare('SELECT * FROM students WHERE is_crisis_surge = 0').all() as unknown as StudentRecord[];

  // Clean non-blocked baseline copy
  const cleanRoads = roads.map((r) => ({ ...r, is_blocked: 0 }));
  const cleanBuses = buses.map((b) => ({
    ...b,
    status: b.id === 'BUS-05' ? ('delayed' as const) : ('on_time' as const),
    delay_minutes: b.id === 'BUS-05' ? 6 : 0,
  }));

  const { metrics } = allocateStudents(nodes, cleanRoads, cleanBuses, parentVehicles, students, false);
  return metrics;
}

export function triggerExamDayCrisis(
  db: DatabaseSync,
  brokenBusIds: string[],
  blockedRoadId: string
): {
  before: CrisisMetricsSummary;
  after: CrisisMetricsSummary;
  assignments: AssignmentRow[];
} {
  // First reset any previous crisis surge cleanly so repeated triggers are idempotent
  resetExamDayCrisis(db);

  const before = computeBaselineMetrics(db);

  // A. Mark 2 selected buses unavailable
  const markBusStmt = db.prepare('UPDATE buses SET status = ?, delay_minutes = 0 WHERE id = ?');
  for (const busId of brokenBusIds) {
    markBusStmt.run('unavailable', busId);
  }

  // B. Increase student demand by +40% (150 -> 210 students, +60 deterministic surge students)
  const rand = createSeededRandom(99026);
  const villages = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'];
  const institutions = ['I1', 'I2', 'I3'];
  const surgeFirst = ['Aryan', 'Bhoomi', 'Chirag', 'Dhanya', 'Eshwar', 'Farhan', 'Gauri', 'Hemant', 'Kavya', 'Lokesh'];
  const surgeLast = ['Gowda', 'Patil', 'Rao', 'Naik', 'Shetty', 'Reddy'];
  const insertSurge = db.prepare(
    'INSERT INTO students (id, name, village_id, institution_id, is_exam_student, exam_subject, exam_deadline_minutes, is_crisis_surge) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  );
  for (let i = 1; i <= 60; i++) {
    const fn = surgeFirst[Math.floor(rand() * surgeFirst.length)];
    const ln = surgeLast[Math.floor(rand() * surgeLast.length)];
    const vId = villages[Math.floor(rand() * villages.length)];
    const iId = institutions[Math.floor(rand() * institutions.length)];
    const isExam = i <= 10 ? 1 : 0; // 10 extra urgent exam candidates in the surge -> 40 total exam students
    insertSurge.run(
      `SURGE-${String(i).padStart(3, '0')}`,
      `${fn} ${ln}`,
      vId,
      iId,
      isExam,
      isExam ? 'Emergency Re-Sit Exam' : null,
      isExam ? Math.floor(60 + rand() * 50) : null
    );
  }

  // C. Block the flooded road
  db.prepare('UPDATE roads SET is_blocked = 1 WHERE id = ?').run(blockedRoadId);

  // D. Run Dijkstra + Priority Allocation
  const nodes = db.prepare('SELECT * FROM nodes').all() as unknown as NodeRecord[];
  const roads = db.prepare('SELECT * FROM roads').all() as unknown as RoadRecord[];
  const buses = db.prepare('SELECT * FROM buses').all() as unknown as BusRecord[];
  const parentVehicles = db.prepare('SELECT * FROM parent_vehicles').all() as unknown as ParentVehicleRecord[];
  const students = db.prepare('SELECT * FROM students').all() as unknown as StudentRecord[];

  const { assignments, metrics: after } = allocateStudents(nodes, roads, buses, parentVehicles, students, true);

  // Persist assignments
  db.prepare('DELETE FROM crisis_assignments').run();
  const insertAssign = db.prepare(
    `INSERT INTO crisis_assignments (
      student_id, student_name, village_id, institution_id, is_exam_student,
      exam_subject, exam_deadline_minutes, vehicle_type, vehicle_id, vehicle_name,
      route_path, travel_minutes, eta_minutes, status, manually_edited
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const a of assignments) {
    insertAssign.run(
      a.student_id,
      a.student_name,
      a.village_id,
      a.institution_id,
      a.is_exam_student,
      a.exam_subject,
      a.exam_deadline_minutes,
      a.vehicle_type,
      a.vehicle_id,
      a.vehicle_name,
      JSON.stringify(a.route_path),
      a.travel_minutes,
      a.eta_minutes,
      a.status,
      0
    );
  }

  // Update ParentRide seats_available to reflect crisis allocation
  for (const pv of parentVehicles) {
    const used = assignments.filter((a) => a.vehicle_type === 'parent_ride' && a.vehicle_id === pv.id).length;
    const rem = Math.max(0, pv.seats_total - used);
    db.prepare('UPDATE parent_vehicles SET seats_available = ?, status = ? WHERE id = ?').run(
      rem,
      rem === 0 ? 'full' : 'available',
      pv.id
    );
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crisis_state SET
      active = 1,
      triggered_at = ?,
      exam_countdown_seconds = 7200,
      blocked_road_id = ?,
      broken_bus_ids = ?,
      demand_increase_pct = 40,
      before_metrics = ?,
      after_metrics = ?
     WHERE id = 1`
  ).run(now, blockedRoadId, JSON.stringify(brokenBusIds), JSON.stringify(before), JSON.stringify(after));

  // Generate simulated alerts for affected students & parents
  const blockedRoad = roads.find((r) => r.id === blockedRoadId);
  const fromName = nodes.find((n) => n.id === blockedRoad?.from_node)?.name ?? blockedRoad?.from_node;
  const toName = nodes.find((n) => n.id === blockedRoad?.to_node)?.name ?? blockedRoad?.to_node;

  const insertAlert = db.prepare(
    'INSERT INTO alerts (id, title, message, severity, target_bus_id, target_role, affected_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertAlert.run(
    `ALT-CRISIS-${Date.now()}-1`,
    'EXAM-DAY CRISIS: Road Flooded & Buses Unavailable',
    `SIMULATED ALERT: ${fromName}–${toName} corridor is flooded and blocked. Buses ${brokenBusIds.join(', ')} are out of service. Dijkstra rerouting active across ${after.students_served} served students.`,
    'critical',
    brokenBusIds[0] ?? null,
    'all',
    after.total_students,
    now
  );
  insertAlert.run(
    `ALT-CRISIS-${Date.now()}-2`,
    'ParentRide Priority Carpool Activated',
    `SIMULATED ALERT: Verified ParentRide vehicles dispatched to rescue examination candidates. ${after.exam_students_reaching_on_time}/${after.exam_students_total} exam candidates projected to reach on time.`,
    'warning',
    null,
    'parent',
    after.exam_students_total,
    now
  );

  return { before, after, assignments };
}

export function resetExamDayCrisis(db: DatabaseSync): void {
  db.prepare('DELETE FROM students WHERE is_crisis_surge = 1').run();
  db.prepare('UPDATE roads SET is_blocked = 0').run();
  db.prepare("UPDATE buses SET status = CASE WHEN id = 'BUS-05' THEN 'delayed' ELSE 'on_time' END, delay_minutes = CASE WHEN id = 'BUS-05' THEN 6 ELSE 0 END").run();
  db.prepare('DELETE FROM crisis_assignments').run();
  db.prepare("UPDATE parent_vehicles SET seats_available = seats_total, status = 'available'").run();
  db.prepare("UPDATE parent_vehicles SET seats_available = seats_available - 1 WHERE id IN ('PR-01', 'PR-02')").run();
  db.prepare(
    "DELETE FROM alerts WHERE id LIKE 'ALT-CRISIS-%'"
  ).run();
  db.prepare(
    `UPDATE crisis_state SET
      active = 0,
      triggered_at = NULL,
      exam_countdown_seconds = 7200,
      demand_increase_pct = 0,
      before_metrics = NULL,
      after_metrics = NULL
     WHERE id = 1`
  ).run();
}

export function recalculateAfterMetrics(db: DatabaseSync): CrisisMetricsSummary {
  const nodes = db.prepare('SELECT * FROM nodes').all() as unknown as NodeRecord[];
  const buses = db.prepare('SELECT * FROM buses').all() as unknown as BusRecord[];
  const parentVehicles = db.prepare('SELECT * FROM parent_vehicles').all() as unknown as ParentVehicleRecord[];
  const rawRows = db.prepare('SELECT * FROM crisis_assignments').all() as unknown as (Omit<AssignmentRow, 'route_path'> & { route_path: string })[];
  const assignments: AssignmentRow[] = rawRows.map((r) => ({
    ...r,
    route_path: JSON.parse(r.route_path),
  }));

  const after = buildMetricsSummary(nodes, buses, parentVehicles, assignments, true);
  db.prepare('UPDATE crisis_state SET after_metrics = ? WHERE id = 1').run(JSON.stringify(after));
  return after;
}
