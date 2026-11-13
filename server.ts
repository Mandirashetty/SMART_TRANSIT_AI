import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  BusRecord,
  NodeRecord,
  ParentVehicleRecord,
  RoadRecord,
  StudentRecord,
  getDb,
  hashPassword,
  verifyPassword,
} from './server/db.js';
import {
  AssignmentRow,
  computeBaselineMetrics,
  computeRouteRescueOptions,
  dijkstraShortestPath,
  recalculateAfterMetrics,
  resetExamDayCrisis,
  triggerExamDayCrisis,
} from './server/routing.js';
import { answerTransitQuestion } from './server/assistant.js';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'parent' | 'admin' | 'authority';
  village_id: string | null;
  phone: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const db = getDb();
const app = express();
app.use(express.json());

// Auth middleware (optional or required depending on route)
function attachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (token) {
    const now = Date.now();
    const session = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.village_id, u.phone
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > ?`
      )
      .get(token, now) as AuthUser | undefined;
    if (session) {
      req.user = session;
    }
  }
  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireRole(roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Role '${req.user.role}' is not authorized for this action.` });
    }
    next();
  };
}

app.use(attachUser);

// 1. AUTHENTICATION ENDPOINTS
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = db
    .prepare('SELECT id, name, email, password_hash, role, village_id, phone FROM users WHERE lower(email) = lower(?)')
    .get(String(email).trim()) as (AuthUser & { password_hash: string }) | undefined;

  if (!user || !verifyPassword(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      village_id: user.village_id,
      phone: user.phone,
    },
  });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, role, village_id, phone } = req.body ?? {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }
  if (!['student', 'parent', 'admin', 'authority'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const id = `USR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role, village_id, phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    String(name).trim(),
    String(email).trim().toLowerCase(),
    hashPassword(String(password)),
    role,
    village_id || 'V1',
    phone || '+91 98450 00000',
    now
  );

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, id, expiresAt);

  return res.status(201).json({
    token,
    user: {
      id,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      role,
      village_id: village_id || 'V1',
      phone: phone || '+91 98450 00000',
    },
  });
});

app.post('/api/auth/logout', (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  res.json({ user: req.user });
});

// 2. NETWORK, BUSES & LIVE MOVEMENT
app.get('/api/network', (_req, res) => {
  const nodes = db.prepare('SELECT * FROM nodes ORDER BY type DESC, id ASC').all() as unknown as NodeRecord[];
  const roads = db.prepare('SELECT * FROM roads ORDER BY id ASC').all() as unknown as RoadRecord[];
  const buses = (db.prepare('SELECT * FROM buses ORDER BY id ASC').all() as unknown as BusRecord[]).map((b) => ({
    ...b,
    route_stops: JSON.parse(b.route_stops) as string[],
  }));
  const crisis = db.prepare('SELECT * FROM crisis_state WHERE id = 1').get() as {
    active: number;
    blocked_road_id: string | null;
    broken_bus_ids: string;
  };
  res.json({
    simulated: true,
    nodes,
    roads,
    buses,
    crisisActive: crisis?.active === 1,
    blockedRoadId: crisis?.blocked_road_id ?? null,
    brokenBusIds: crisis ? JSON.parse(crisis.broken_bus_ids) : [],
  });
});

app.post('/api/buses/tick', (_req, res) => {
  const buses = db.prepare('SELECT * FROM buses').all() as unknown as BusRecord[];
  const update = db.prepare('UPDATE buses SET current_stop_idx = ?, progress = ?, eta_minutes = ? WHERE id = ?');

  for (const bus of buses) {
    if (bus.status === 'cancelled' || bus.status === 'unavailable') continue;
    const stops: string[] = JSON.parse(bus.route_stops);
    if (stops.length < 2) continue;
    let nextProgress = bus.progress + 0.18;
    let nextIdx = bus.current_stop_idx;
    if (nextProgress >= 1) {
      nextProgress = 0;
      nextIdx = (nextIdx + 1) % (stops.length - 1);
    }
    const remainingStops = Math.max(1, stops.length - 1 - nextIdx);
    const eta = Math.max(4, Math.round(remainingStops * 9 * (1 - nextProgress * 0.4) + bus.delay_minutes));
    update.run(nextIdx, Math.round(nextProgress * 100) / 100, eta, bus.id);
  }

  const updated = (db.prepare('SELECT * FROM buses ORDER BY id ASC').all() as unknown as BusRecord[]).map((b) => ({
    ...b,
    route_stops: JSON.parse(b.route_stops) as string[],
  }));
  res.json({ buses: updated });
});

// 3. SMART ALERTS & ADMIN BUS STATUS CONTROL
app.get('/api/alerts', (_req, res) => {
  const alerts = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 40').all();
  res.json({ alerts });
});

app.post('/api/buses/:id/status', requireRole(['admin', 'authority']), (req, res) => {
  const { id } = req.params;
  const { status, delay_minutes, reason } = req.body ?? {};
  if (!['on_time', 'delayed', 'cancelled', 'unavailable'].includes(status)) {
    return res.status(400).json({ error: 'Invalid bus status.' });
  }
  const bus = db.prepare('SELECT * FROM buses WHERE id = ?').get(id) as BusRecord | undefined;
  if (!bus) return res.status(404).json({ error: 'Bus not found.' });

  const delay = status === 'delayed' ? Math.max(1, Number(delay_minutes || 15)) : 0;
  const newEta = status === 'on_time' ? Math.max(8, bus.eta_minutes - bus.delay_minutes) : bus.eta_minutes + delay;

  db.prepare('UPDATE buses SET status = ?, delay_minutes = ?, eta_minutes = ? WHERE id = ?').run(status, delay, newEta, id);

  if (status !== 'on_time') {
    const stops: string[] = JSON.parse(bus.route_stops);
    const affectedStudents = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM students WHERE village_id IN (${stops.map(() => '?').join(',')})`
        )
        .get(...stops) as { c: number }
    ).c;

    const severity = status === 'delayed' ? 'warning' : 'critical';
    const title = `${bus.name} marked ${status.toUpperCase()}`;
    const msg = `SIMULATED NOTIFICATION: ${bus.name} (${bus.reg_number}) status changed to ${status}${delay > 0 ? ` (+${delay} min delay)` : ''}. ${reason ? `Reason: ${reason}. ` : ''}Notified ${affectedStudents} students and parents along ${stops.join(' -> ')}.`;
    db.prepare(
      'INSERT INTO alerts (id, title, message, severity, target_bus_id, target_role, affected_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(`ALT-${Date.now()}`, title, msg, severity, id, 'all', affectedStudents, new Date().toISOString());
  }

  res.json({ ok: true });
});

// 4. PARENTRIDE ENDPOINTS
app.get('/api/parent-ride', (_req, res) => {
  const vehicles = db.prepare('SELECT * FROM parent_vehicles ORDER BY id ASC').all();
  const requests = db.prepare('SELECT * FROM parent_ride_requests ORDER BY created_at DESC').all();
  res.json({ vehicles, requests });
});

app.post('/api/parent-ride/offer', requireRole(['parent', 'admin', 'authority']), (req, res) => {
  const { vehicle_model, reg_number, origin_node_id, destination_node_id, seats_total, departure_minutes, phone } =
    req.body ?? {};
  if (!vehicle_model || !reg_number || !origin_node_id || !destination_node_id || !seats_total) {
    return res.status(400).json({ error: 'All vehicle offer fields are required.' });
  }
  const seats = Math.min(7, Math.max(1, Number(seats_total)));
  const id = `PR-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  db.prepare(
    `INSERT INTO parent_vehicles (id, parent_name, phone, vehicle_model, reg_number, origin_node_id, destination_node_id, seats_total, seats_available, departure_minutes, verified, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'available')`
  ).run(
    id,
    req.user!.name,
    phone || req.user!.phone || '+91 99000 12345',
    String(vehicle_model).trim(),
    String(reg_number).trim().toUpperCase(),
    origin_node_id,
    destination_node_id,
    seats,
    seats,
    Math.max(5, Number(departure_minutes || 15))
  );
  res.status(201).json({ ok: true, id });
});

app.post('/api/parent-ride/request', requireAuth, (req, res) => {
  const { vehicle_id, pickup_node_id } = req.body ?? {};
  if (!vehicle_id || !pickup_node_id) {
    return res.status(400).json({ error: 'Vehicle and pickup stop are required.' });
  }
  const vehicle = db.prepare('SELECT * FROM parent_vehicles WHERE id = ?').get(vehicle_id) as ParentVehicleRecord | undefined;
  if (!vehicle) return res.status(404).json({ error: 'Parent vehicle not found.' });
  if (vehicle.seats_available <= 0) {
    return res.status(400).json({ error: 'No seats currently available on this vehicle.' });
  }

  const id = `REQ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  db.prepare(
    'INSERT INTO parent_ride_requests (id, vehicle_id, student_name, student_email, pickup_node_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, vehicle_id, req.user!.name, req.user!.email, pickup_node_id, 'pending', new Date().toISOString());

  res.status(201).json({ ok: true, id });
});

app.post('/api/parent-ride/request/:id/action', requireRole(['parent', 'admin', 'authority']), (req, res) => {
  const { id } = req.params;
  const { action } = req.body ?? {};
  if (!['accepted', 'rejected', 'picked_up', 'dropped_off'].includes(action)) {
    return res.status(400).json({ error: 'Invalid ride request action.' });
  }

  const requestRow = db.prepare('SELECT * FROM parent_ride_requests WHERE id = ?').get(id) as
    | { id: string; vehicle_id: string; status: string; student_name: string }
    | undefined;
  if (!requestRow) return res.status(404).json({ error: 'Ride request not found.' });

  const vehicle = db.prepare('SELECT * FROM parent_vehicles WHERE id = ?').get(requestRow.vehicle_id) as unknown as ParentVehicleRecord;

  if (action === 'accepted' && requestRow.status === 'pending') {
    if (vehicle.seats_available <= 0) {
      return res.status(400).json({ error: 'Vehicle is already at full capacity.' });
    }
    const nextSeats = vehicle.seats_available - 1;
    db.prepare('UPDATE parent_vehicles SET seats_available = ?, status = ? WHERE id = ?').run(
      nextSeats,
      nextSeats === 0 ? 'full' : 'available',
      vehicle.id
    );
  }

  if (action === 'rejected' && requestRow.status === 'accepted') {
    const nextSeats = Math.min(vehicle.seats_total, vehicle.seats_available + 1);
    db.prepare('UPDATE parent_vehicles SET seats_available = ?, status = ? WHERE id = ?').run(
      nextSeats,
      nextSeats > 0 ? 'available' : 'full',
      vehicle.id
    );
  }

  if (action === 'dropped_off' && (requestRow.status === 'picked_up' || requestRow.status === 'accepted')) {
    const nextSeats = Math.min(vehicle.seats_total, vehicle.seats_available + 1);
    db.prepare('UPDATE parent_vehicles SET seats_available = ?, status = ? WHERE id = ?').run(
      nextSeats,
      'available',
      vehicle.id
    );
  }

  db.prepare('UPDATE parent_ride_requests SET status = ? WHERE id = ?').run(action, id);
  res.json({ ok: true });
});

// 5. ROUTERESCUE AI
app.get('/api/route-rescue', (req, res) => {
  const origin = String(req.query.origin || 'V1');
  const destination = String(req.query.destination || 'I1');
  const nodes = db.prepare('SELECT * FROM nodes').all() as unknown as NodeRecord[];
  const roads = db.prepare('SELECT * FROM roads').all() as unknown as RoadRecord[];
  const dijkstra = dijkstraShortestPath(nodes, roads, origin, destination, true);
  const options = computeRouteRescueOptions(db, origin, destination);
  res.json({ origin, destination, dijkstra, options });
});

// 6. DEMAND ANALYTICS & FORECAST
app.get('/api/analytics/demand', (_req, res) => {
  const nodes = db.prepare("SELECT * FROM nodes WHERE type = 'village' ORDER BY id ASC").all() as unknown as NodeRecord[];
  const buses = db.prepare('SELECT * FROM buses').all() as unknown as BusRecord[];
  const parentVehicles = db.prepare('SELECT * FROM parent_vehicles WHERE verified = 1').all() as unknown as ParentVehicleRecord[];
  const students = db.prepare('SELECT * FROM students').all() as unknown as StudentRecord[];

  const rows = nodes.map((v) => {
    const villageStudents = students.filter((s) => s.village_id === v.id);
    const demand = villageStudents.length;
    const examDemand = villageStudents.filter((s) => s.is_exam_student === 1).length;

    let busCapacity = 0;
    for (const b of buses) {
      if (b.status === 'unavailable' || b.status === 'cancelled') continue;
      const stops: string[] = JSON.parse(b.route_stops);
      if (stops.includes(v.id)) {
        // Share capacity across stops served by the bus
        busCapacity += Math.round(b.capacity / Math.max(1, stops.length - 1));
      }
    }

    const parentCapacity = parentVehicles
      .filter((p) => p.origin_node_id === v.id)
      .reduce((acc, p) => acc + p.seats_available, 0);

    const availableCapacity = busCapacity + parentCapacity;
    const shortage = Math.max(0, demand - availableCapacity);
    // Simple linear + seasonal forecast using demand_factor
    const forecastNextWeek = Math.round(demand * v.demand_factor * 1.12);
    const forecastExamPeak = Math.round(demand * 1.4);

    return {
      village_id: v.id,
      village_name: v.name,
      population: v.population,
      current_demand: demand,
      exam_students: examDemand,
      bus_capacity: busCapacity,
      parent_ride_capacity: parentCapacity,
      available_capacity: availableCapacity,
      shortage,
      forecast_next_week: forecastNextWeek,
      forecast_exam_peak: forecastExamPeak,
    };
  });

  res.json({ simulated: true, analytics: rows });
});

// 7. AI ASSISTANT
app.post('/api/assistant', async (req, res) => {
  const { question } = req.body ?? {};
  if (!question || !String(question).trim()) {
    return res.status(400).json({ error: 'Please enter a question.' });
  }
  const result = await answerTransitQuestion(db, String(question).trim());
  res.json(result);
});

// 8. SOS EMERGENCY ENDPOINTS
app.get('/api/sos', (_req, res) => {
  const reports = db.prepare('SELECT * FROM sos_reports ORDER BY created_at DESC LIMIT 50').all();
  res.json({ reports });
});

app.post('/api/sos', (req, res) => {
  const { emergency_number, location_node_id, notes, phone } = req.body ?? {};
  const allowed = ['112', '100', '108', '1098', '1091'];
  const num = allowed.includes(String(emergency_number)) ? String(emergency_number) : '112';
  const id = `SOS-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();
  const userName = req.user?.name ?? 'Guest Commuter';
  const userRole = req.user?.role ?? 'student';
  const userPhone = phone || req.user?.phone || '+91 98450 00000';

  db.prepare(
    'INSERT INTO sos_reports (id, user_name, user_role, phone, emergency_number, location_node_id, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    userName,
    userRole,
    userPhone,
    num,
    location_node_id || 'V1',
    notes ? String(notes).trim() : `Emergency SOS dispatched to ${num}`,
    'active',
    now
  );

  db.prepare(
    'INSERT INTO alerts (id, title, message, severity, target_bus_id, target_role, affected_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    `ALT-SOS-${Date.now()}`,
    `SOS Emergency Alert (${num})`,
    `SIMULATED SOS: ${userName} (${userRole}) triggered emergency call ${num} near ${location_node_id || 'V1'}.`,
    'critical',
    null,
    'admin',
    1,
    now
  );

  res.status(201).json({ ok: true, id });
});

app.post('/api/sos/:id/status', requireRole(['admin', 'authority']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body ?? {};
  if (!['active', 'dispatched', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid SOS status.' });
  }
  db.prepare('UPDATE sos_reports SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
});

// 9. CRISIS COMMAND CENTER (EXAM-DAY CRISIS MANAGEMENT)
app.get('/api/crisis', (_req, res) => {
  const state = db.prepare('SELECT * FROM crisis_state WHERE id = 1').get() as {
    active: number;
    triggered_at: string | null;
    exam_countdown_seconds: number;
    blocked_road_id: string | null;
    broken_bus_ids: string;
    demand_increase_pct: number;
    before_metrics: string | null;
    after_metrics: string | null;
  };

  const baseline = computeBaselineMetrics(db);
  const rawAssignments = db
    .prepare('SELECT * FROM crisis_assignments ORDER BY is_exam_student DESC, exam_deadline_minutes ASC, student_id ASC')
    .all() as unknown as (Omit<AssignmentRow, 'route_path'> & { route_path: string })[];

  const assignments: AssignmentRow[] = rawAssignments.map((r) => ({
    ...r,
    route_path: JSON.parse(r.route_path),
  }));

  res.json({
    simulated: true,
    active: state.active === 1,
    triggered_at: state.triggered_at,
    exam_countdown_seconds: state.exam_countdown_seconds,
    blocked_road_id: state.blocked_road_id,
    broken_bus_ids: JSON.parse(state.broken_bus_ids) as string[],
    demand_increase_pct: state.demand_increase_pct,
    before: state.before_metrics ? JSON.parse(state.before_metrics) : baseline,
    after: state.after_metrics ? JSON.parse(state.after_metrics) : null,
    assignments,
  });
});

app.post('/api/crisis/trigger', requireRole(['admin', 'authority']), (req, res) => {
  const { brokenBusIds, blockedRoadId } = req.body ?? {};
  const busesToBreak =
    Array.isArray(brokenBusIds) && brokenBusIds.length === 2 ? brokenBusIds : ['BUS-01', 'BUS-04'];
  const roadToBlock = typeof blockedRoadId === 'string' && blockedRoadId ? blockedRoadId : 'R15';

  const result = triggerExamDayCrisis(db, busesToBreak, roadToBlock);
  res.json({
    simulated: true,
    active: true,
    brokenBusIds: busesToBreak,
    blockedRoadId: roadToBlock,
    ...result,
  });
});

app.post('/api/crisis/reset', requireRole(['admin', 'authority']), (_req, res) => {
  resetExamDayCrisis(db);
  const baseline = computeBaselineMetrics(db);
  res.json({ ok: true, active: false, before: baseline });
});

app.post('/api/crisis/reassign', requireRole(['admin', 'authority']), (req, res) => {
  const { student_id, vehicle_type, vehicle_id } = req.body ?? {};
  if (!student_id || !['bus', 'parent_ride', 'none'].includes(vehicle_type)) {
    return res.status(400).json({ error: 'Valid student_id and vehicle_type are required.' });
  }

  const state = db.prepare('SELECT active FROM crisis_state WHERE id = 1').get() as { active: number };
  if (state.active !== 1) {
    return res.status(400).json({ error: 'Crisis simulation must be active to modify assignments.' });
  }

  const currentAssign = db.prepare('SELECT * FROM crisis_assignments WHERE student_id = ?').get(student_id) as
    | (Omit<AssignmentRow, 'route_path'> & { route_path: string })
    | undefined;
  if (!currentAssign) {
    return res.status(404).json({ error: 'Student assignment not found.' });
  }

  const nodes = db.prepare('SELECT * FROM nodes').all() as unknown as NodeRecord[];
  const roads = db.prepare('SELECT * FROM roads').all() as unknown as RoadRecord[];

  if (vehicle_type === 'none') {
    db.prepare(
      `UPDATE crisis_assignments SET vehicle_type = 'none', vehicle_id = NULL, vehicle_name = 'Unassigned (Manual)', eta_minutes = 0, status = 'Unreachable', manually_edited = 1 WHERE student_id = ?`
    ).run(student_id);
    const after = recalculateAfterMetrics(db);
    return res.json({ ok: true, after });
  }

  // Capacity validation!
  const currentAssignedCount = (
    db
      .prepare(
        'SELECT COUNT(*) as c FROM crisis_assignments WHERE vehicle_type = ? AND vehicle_id = ? AND student_id != ?'
      )
      .get(vehicle_type, vehicle_id, student_id) as { c: number }
  ).c;

  let vehicleName = '';
  let newTravelMin = 25;
  let newEta = 30;
  const shortest = dijkstraShortestPath(nodes, roads, currentAssign.village_id, currentAssign.institution_id, true);

  if (vehicle_type === 'bus') {
    const bus = db.prepare('SELECT * FROM buses WHERE id = ?').get(vehicle_id) as BusRecord | undefined;
    if (!bus) return res.status(404).json({ error: 'Target bus not found.' });
    if (bus.status === 'unavailable' || bus.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot assign to ${bus.name}: vehicle is ${bus.status}.` });
    }
    if (currentAssignedCount >= bus.capacity) {
      return res
        .status(400)
        .json({ error: `Capacity exceeded: ${bus.name} is full (${currentAssignedCount}/${bus.capacity} seats used).` });
    }
    vehicleName = `${bus.name} (${bus.reg_number})`;
    newTravelMin = Math.round(shortest.totalMinutes + bus.delay_minutes + 4);
    newEta = newTravelMin + 6;
  } else {
    const pv = db.prepare('SELECT * FROM parent_vehicles WHERE id = ?').get(vehicle_id) as ParentVehicleRecord | undefined;
    if (!pv) return res.status(404).json({ error: 'Target ParentRide vehicle not found.' });
    if (currentAssignedCount >= pv.seats_total) {
      return res
        .status(400)
        .json({ error: `Capacity exceeded: ${pv.parent_name}'s vehicle is full (${currentAssignedCount}/${pv.seats_total} seats used).` });
    }
    vehicleName = `ParentRide: ${pv.parent_name} (${pv.vehicle_model})`;
    newTravelMin = Math.round(shortest.totalMinutes);
    newEta = newTravelMin + Math.round(pv.departure_minutes * 0.6);
  }

  let newStatus: 'On Time' | 'At Risk' | 'Unreachable' = shortest.reachable ? 'On Time' : 'Unreachable';
  if (shortest.reachable && currentAssign.is_exam_student && currentAssign.exam_deadline_minutes !== null) {
    if (newEta > currentAssign.exam_deadline_minutes || currentAssign.exam_deadline_minutes - newEta <= 5) {
      newStatus = 'At Risk';
    }
  } else if (shortest.reachable && newEta > 55) {
    newStatus = 'At Risk';
  }

  db.prepare(
    `UPDATE crisis_assignments SET
      vehicle_type = ?, vehicle_id = ?, vehicle_name = ?,
      route_path = ?, travel_minutes = ?, eta_minutes = ?,
      status = ?, manually_edited = 1
     WHERE student_id = ?`
  ).run(
    vehicle_type,
    vehicle_id,
    vehicleName,
    JSON.stringify(shortest.path),
    newTravelMin,
    newEta,
    newStatus,
    student_id
  );

  const after = recalculateAfterMetrics(db);
  res.json({ ok: true, after });
});

async function startServer() {
  const PORT = 3000;
  app.use(express.static(path.resolve(process.cwd(), 'public')));
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartTransit AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
