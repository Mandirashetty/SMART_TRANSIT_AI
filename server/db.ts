import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';

export interface NodeRecord {
  id: string;
  name: string;
  type: 'village' | 'institution';
  x: number;
  y: number;
  population: number;
  demand_factor: number;
}

export interface RoadRecord {
  id: string;
  from_node: string;
  to_node: string;
  distance_km: number;
  travel_minutes: number;
  is_blocked: number;
  is_flood_corridor: number;
}

export interface BusRecord {
  id: string;
  name: string;
  reg_number: string;
  driver_name: string;
  driver_phone: string;
  capacity: number;
  route_stops: string; // JSON string[]
  current_stop_idx: number;
  progress: number;
  status: 'on_time' | 'delayed' | 'cancelled' | 'unavailable';
  delay_minutes: number;
  eta_minutes: number;
  base_travel_minutes: number;
}

export interface StudentRecord {
  id: string;
  name: string;
  village_id: string;
  institution_id: string;
  is_exam_student: number;
  exam_subject: string | null;
  exam_deadline_minutes: number | null;
  is_crisis_surge: number;
}

export interface ParentVehicleRecord {
  id: string;
  parent_name: string;
  phone: string;
  vehicle_model: string;
  reg_number: string;
  origin_node_id: string;
  destination_node_id: string;
  seats_total: number;
  seats_available: number;
  departure_minutes: number;
  verified: number;
  status: 'available' | 'full' | 'en_route';
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

// Deterministic PRNG (Mulberry32) with fixed seed for consistent demo data
export function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  const dbPath = path.resolve(process.cwd(), 'smarttransit.db');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  initSchema(db);
  seedDatabaseIfEmpty(db);
  dbInstance = db;
  return db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'parent', 'admin', 'authority')),
      village_id TEXT,
      phone TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('village', 'institution')),
      x REAL NOT NULL,
      y REAL NOT NULL,
      population INTEGER NOT NULL,
      demand_factor REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roads (
      id TEXT PRIMARY KEY,
      from_node TEXT NOT NULL,
      to_node TEXT NOT NULL,
      distance_km REAL NOT NULL,
      travel_minutes REAL NOT NULL,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      is_flood_corridor INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS buses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      reg_number TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      driver_phone TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      route_stops TEXT NOT NULL,
      current_stop_idx INTEGER NOT NULL DEFAULT 0,
      progress REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('on_time', 'delayed', 'cancelled', 'unavailable')),
      delay_minutes INTEGER NOT NULL DEFAULT 0,
      eta_minutes INTEGER NOT NULL DEFAULT 15,
      base_travel_minutes INTEGER NOT NULL DEFAULT 25
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      village_id TEXT NOT NULL,
      institution_id TEXT NOT NULL,
      is_exam_student INTEGER NOT NULL DEFAULT 0,
      exam_subject TEXT,
      exam_deadline_minutes INTEGER,
      is_crisis_surge INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS parent_vehicles (
      id TEXT PRIMARY KEY,
      parent_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      vehicle_model TEXT NOT NULL,
      reg_number TEXT NOT NULL,
      origin_node_id TEXT NOT NULL,
      destination_node_id TEXT NOT NULL,
      seats_total INTEGER NOT NULL,
      seats_available INTEGER NOT NULL,
      departure_minutes INTEGER NOT NULL,
      verified INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'available'
    );

    CREATE TABLE IF NOT EXISTS parent_ride_requests (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      student_email TEXT NOT NULL,
      pickup_node_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'rejected', 'picked_up', 'dropped_off')),
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES parent_vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
      target_bus_id TEXT,
      target_role TEXT NOT NULL DEFAULT 'all',
      affected_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sos_reports (
      id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      phone TEXT NOT NULL,
      emergency_number TEXT NOT NULL,
      location_node_id TEXT NOT NULL,
      notes TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'dispatched', 'resolved')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crisis_state (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      active INTEGER NOT NULL DEFAULT 0,
      triggered_at TEXT,
      exam_countdown_seconds INTEGER NOT NULL DEFAULT 7200,
      blocked_road_id TEXT,
      broken_bus_ids TEXT NOT NULL DEFAULT '[]',
      demand_increase_pct INTEGER NOT NULL DEFAULT 0,
      before_metrics TEXT,
      after_metrics TEXT
    );

    CREATE TABLE IF NOT EXISTS crisis_assignments (
      student_id TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      village_id TEXT NOT NULL,
      institution_id TEXT NOT NULL,
      is_exam_student INTEGER NOT NULL,
      exam_subject TEXT,
      exam_deadline_minutes INTEGER,
      vehicle_type TEXT NOT NULL CHECK(vehicle_type IN ('bus', 'parent_ride', 'none')),
      vehicle_id TEXT,
      vehicle_name TEXT,
      route_path TEXT NOT NULL,
      travel_minutes REAL NOT NULL,
      eta_minutes REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('On Time', 'At Risk', 'Unreachable')),
      manually_edited INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export const INITIAL_NODES: NodeRecord[] = [
  { id: 'V1', name: 'Kengeri Rural', type: 'village', x: 110, y: 290, population: 3400, demand_factor: 1.05 },
  { id: 'V2', name: 'Bidadi Hobli', type: 'village', x: 240, y: 400, population: 4100, demand_factor: 1.18 },
  { id: 'V3', name: 'Ramanagara Cross', type: 'village', x: 460, y: 415, population: 3850, demand_factor: 1.12 },
  { id: 'V4', name: 'Channapatna East', type: 'village', x: 675, y: 390, population: 3200, demand_factor: 0.96 },
  { id: 'V5', name: 'Magadi Gate', type: 'village', x: 215, y: 155, population: 2950, demand_factor: 0.92 },
  { id: 'V6', name: 'Tavarekere', type: 'village', x: 415, y: 205, population: 3650, demand_factor: 1.15 },
  { id: 'V7', name: 'Nelamangala North', type: 'village', x: 350, y: 78, population: 3100, demand_factor: 0.98 },
  { id: 'V8', name: 'Kanakapura Road', type: 'village', x: 590, y: 255, population: 4300, demand_factor: 1.24 },
  { id: 'I1', name: 'Govt Polytechnic College', type: 'institution', x: 770, y: 145, population: 1200, demand_factor: 1.0 },
  { id: 'I2', name: 'Rural Engineering Institute', type: 'institution', x: 845, y: 300, population: 1500, demand_factor: 1.0 },
  { id: 'I3', name: 'District Junior College', type: 'institution', x: 605, y: 95, population: 1100, demand_factor: 1.0 },
];

export const INITIAL_ROADS: RoadRecord[] = [
  { id: 'R1', from_node: 'V1', to_node: 'V2', distance_km: 9.5, travel_minutes: 12, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R2', from_node: 'V1', to_node: 'V5', distance_km: 11.0, travel_minutes: 14, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R3', from_node: 'V1', to_node: 'V6', distance_km: 15.5, travel_minutes: 19, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R4', from_node: 'V2', to_node: 'V3', distance_km: 12.0, travel_minutes: 15, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R5', from_node: 'V2', to_node: 'V6', distance_km: 13.5, travel_minutes: 17, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R6', from_node: 'V3', to_node: 'V4', distance_km: 13.0, travel_minutes: 16, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R7', from_node: 'V3', to_node: 'V8', distance_km: 11.5, travel_minutes: 15, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R8', from_node: 'V3', to_node: 'V6', distance_km: 12.5, travel_minutes: 16, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R9', from_node: 'V4', to_node: 'V8', distance_km: 10.5, travel_minutes: 14, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R10', from_node: 'V4', to_node: 'I2', distance_km: 11.0, travel_minutes: 13, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R11', from_node: 'V5', to_node: 'V7', distance_km: 10.0, travel_minutes: 12, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R12', from_node: 'V5', to_node: 'V6', distance_km: 11.5, travel_minutes: 14, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R13', from_node: 'V7', to_node: 'I3', distance_km: 14.0, travel_minutes: 17, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R14', from_node: 'V6', to_node: 'I3', distance_km: 12.0, travel_minutes: 15, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R15', from_node: 'V6', to_node: 'V8', distance_km: 10.0, travel_minutes: 11, is_blocked: 0, is_flood_corridor: 1 }, // Major central corridor prone to flooding
  { id: 'R16', from_node: 'V8', to_node: 'I1', distance_km: 13.0, travel_minutes: 16, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R17', from_node: 'V8', to_node: 'I2', distance_km: 14.5, travel_minutes: 18, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R18', from_node: 'V8', to_node: 'I3', distance_km: 11.0, travel_minutes: 14, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R19', from_node: 'I3', to_node: 'I1', distance_km: 9.5, travel_minutes: 12, is_blocked: 0, is_flood_corridor: 0 },
  { id: 'R20', from_node: 'I1', to_node: 'I2', distance_km: 10.5, travel_minutes: 13, is_blocked: 0, is_flood_corridor: 0 },
];

export const INITIAL_BUSES: BusRecord[] = [
  {
    id: 'BUS-01',
    name: 'KSRTC Grama Express 101',
    reg_number: 'KA-42-G-1101',
    driver_name: 'Ramesh Gowda',
    driver_phone: '+91 98450 11011',
    capacity: 26,
    route_stops: JSON.stringify(['V1', 'V6', 'V8', 'I1']),
    current_stop_idx: 1,
    progress: 0.45,
    status: 'on_time',
    delay_minutes: 0,
    eta_minutes: 18,
    base_travel_minutes: 34,
  },
  {
    id: 'BUS-02',
    name: 'KSRTC Vidya Vahini 102',
    reg_number: 'KA-42-G-1102',
    driver_name: 'Mahesh Naik',
    driver_phone: '+91 98450 11022',
    capacity: 24,
    route_stops: JSON.stringify(['V2', 'V3', 'V8', 'I2']),
    current_stop_idx: 0,
    progress: 0.72,
    status: 'on_time',
    delay_minutes: 0,
    eta_minutes: 22,
    base_travel_minutes: 38,
  },
  {
    id: 'BUS-03',
    name: 'Sahyadri Rural Shuttle 103',
    reg_number: 'KA-42-G-1103',
    driver_name: 'Suresh Kulkarni',
    driver_phone: '+91 98450 11033',
    capacity: 22,
    route_stops: JSON.stringify(['V5', 'V7', 'I3', 'I1']),
    current_stop_idx: 1,
    progress: 0.3,
    status: 'on_time',
    delay_minutes: 0,
    eta_minutes: 16,
    base_travel_minutes: 31,
  },
  {
    id: 'BUS-04',
    name: 'Cauvery Student Special 104',
    reg_number: 'KA-42-G-1104',
    driver_name: 'Venkatesh Murthy',
    driver_phone: '+91 98450 11044',
    capacity: 24,
    route_stops: JSON.stringify(['V1', 'V2', 'V3', 'V4', 'I2']),
    current_stop_idx: 2,
    progress: 0.55,
    status: 'on_time',
    delay_minutes: 0,
    eta_minutes: 24,
    base_travel_minutes: 42,
  },
  {
    id: 'BUS-05',
    name: 'Nandi Hill Connect 105',
    reg_number: 'KA-42-G-1105',
    driver_name: 'Prakash Shetty',
    driver_phone: '+91 98450 11055',
    capacity: 20,
    route_stops: JSON.stringify(['V5', 'V6', 'I3', 'I1']),
    current_stop_idx: 0,
    progress: 0.62,
    status: 'delayed',
    delay_minutes: 6,
    eta_minutes: 21,
    base_travel_minutes: 29,
  },
  {
    id: 'BUS-06',
    name: 'Kanakapura Corridor 106',
    reg_number: 'KA-42-G-1106',
    driver_name: 'Kiran Kumar',
    driver_phone: '+91 98450 11066',
    capacity: 22,
    route_stops: JSON.stringify(['V3', 'V8', 'I1', 'I2']),
    current_stop_idx: 1,
    progress: 0.25,
    status: 'on_time',
    delay_minutes: 0,
    eta_minutes: 19,
    base_travel_minutes: 33,
  },
  {
    id: 'BUS-07',
    name: 'Channapatna Express 107',
    reg_number: 'KA-42-G-1107',
    driver_name: 'Basavaraj Patil',
    driver_phone: '+91 98450 11077',
    capacity: 20,
    route_stops: JSON.stringify(['V4', 'V8', 'I3', 'I1']),
    current_stop_idx: 0,
    progress: 0.85,
    status: 'on_time',
    delay_minutes: 0,
    eta_minutes: 17,
    base_travel_minutes: 30,
  },
  {
    id: 'BUS-08',
    name: 'Tavarekere Link 108',
    reg_number: 'KA-42-G-1108',
    driver_name: 'Manjunath Rao',
    driver_phone: '+91 98450 11088',
    capacity: 18,
    route_stops: JSON.stringify(['V2', 'V6', 'V8', 'I2']),
    current_stop_idx: 1,
    progress: 0.4,
    status: 'on_time',
    delay_minutes: 0,
    eta_minutes: 20,
    base_travel_minutes: 35,
  },
  {
    id: 'BUS-09',
    name: 'North Taluk Feeder 109',
    reg_number: 'KA-42-G-1109',
    driver_name: 'Harish Babu',
    driver_phone: '+91 98450 11099',
    capacity: 18,
    route_stops: JSON.stringify(['V1', 'V5', 'V7', 'I3']),
    current_stop_idx: 2,
    progress: 0.15,
    status: 'on_time',
    delay_minutes: 0,
    eta_minutes: 14,
    base_travel_minutes: 28,
  },
  {
    id: 'BUS-10',
    name: 'District Campus Loop 110',
    reg_number: 'KA-42-G-1110',
    driver_name: 'Shankarappa D',
    driver_phone: '+91 98450 11100',
    capacity: 20,
    route_stops: JSON.stringify(['V6', 'V3', 'V4', 'I2']),
    current_stop_idx: 0,
    progress: 0.5,
    status: 'on_time',
    delay_minutes: 0,
    eta_minutes: 23,
    base_travel_minutes: 36,
  },
];

export const INITIAL_PARENT_VEHICLES: ParentVehicleRecord[] = [
  {
    id: 'PR-01',
    parent_name: 'Anitha Deshmukh',
    phone: '+91 99001 44101',
    vehicle_model: 'Maruti Ertiga MPV',
    reg_number: 'KA-05-MJ-4821',
    origin_node_id: 'V1',
    destination_node_id: 'I1',
    seats_total: 4,
    seats_available: 4,
    departure_minutes: 10,
    verified: 1,
    status: 'available',
  },
  {
    id: 'PR-02',
    parent_name: 'Rajeshwari Hegde',
    phone: '+91 99001 44102',
    vehicle_model: 'Tata Nexon EV',
    reg_number: 'KA-42-N-9014',
    origin_node_id: 'V2',
    destination_node_id: 'I2',
    seats_total: 4,
    seats_available: 4,
    departure_minutes: 12,
    verified: 1,
    status: 'available',
  },
  {
    id: 'PR-03',
    parent_name: 'Srinivasulu Reddy',
    phone: '+91 99001 44103',
    vehicle_model: 'Mahindra Bolero',
    reg_number: 'KA-42-B-3372',
    origin_node_id: 'V6',
    destination_node_id: 'I3',
    seats_total: 5,
    seats_available: 5,
    departure_minutes: 8,
    verified: 1,
    status: 'available',
  },
  {
    id: 'PR-04',
    parent_name: 'Kavitha Narayan',
    phone: '+91 99001 44104',
    vehicle_model: 'Hyundai Creta',
    reg_number: 'KA-01-Z-7729',
    origin_node_id: 'V3',
    destination_node_id: 'I1',
    seats_total: 3,
    seats_available: 3,
    departure_minutes: 15,
    verified: 1,
    status: 'available',
  },
  {
    id: 'PR-05',
    parent_name: 'Mohammed Irfan',
    phone: '+91 99001 44105',
    vehicle_model: 'Toyota Innova',
    reg_number: 'KA-42-P-5510',
    origin_node_id: 'V8',
    destination_node_id: 'I2',
    seats_total: 4,
    seats_available: 4,
    departure_minutes: 9,
    verified: 1,
    status: 'available',
  },
];

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Akash', 'Ananya', 'Arjun', 'Bhavana', 'Chetan', 'Deepika',
  'Darshan', 'Divya', 'Gaurav', 'Harsha', 'Ishaan', 'Jhanvi', 'Karthik', 'Keerthi',
  'Lakshmi', 'Manoj', 'Meghana', 'Nikhil', 'Nandini', 'Pranav', 'Pooja', 'Rahul',
  'Rakshitha', 'Rohan', 'Sahana', 'Sanjay', 'Shreya', 'Siddharth', 'Sneha', 'Sumanth',
  'Tanvi', 'Tejas', 'Varsha', 'Vikram', 'Yashas', 'Zoya',
];

const LAST_NAMES = [
  'Gowda', 'Sharma', 'Patil', 'Naik', 'Rao', 'Kulkarni', 'Reddy', 'Shetty',
  'Hegde', 'Murthy', 'Bhat', 'Desai', 'Joshi', 'Kumar', 'Prasad', 'Verma',
];

const EXAM_SUBJECTS = [
  'Engineering Mathematics II',
  'Applied Physics',
  'Digital Electronics',
  'Computer Networks',
  'Organic Chemistry',
  'Fluid Mechanics',
];

export function seedDatabaseIfEmpty(db: DatabaseSync) {
  const nodeCount = (db.prepare('SELECT COUNT(*) as c FROM nodes').get() as { c: number }).c;
  if (nodeCount > 0) return;

  const rand = createSeededRandom(42026);
  const now = new Date().toISOString();

  // 1. Users (4 demo roles)
  const insertUser = db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role, village_id, phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertUser.run('USR-STU', 'Aarav Gowda', 'student@smarttransit.in', hashPassword('Student@123'), 'student', 'V6', '+91 98451 10001', now);
  insertUser.run('USR-PAR', 'Anitha Deshmukh', 'parent@smarttransit.in', hashPassword('Parent@123'), 'parent', 'V1', '+91 99001 44101', now);
  insertUser.run('USR-ADM', 'Dr. Kavya Rao (Admin)', 'admin@smarttransit.in', hashPassword('Admin@123'), 'admin', 'I1', '+91 98452 20001', now);
  insertUser.run('USR-AUT', 'R. Prakash (Transport Authority)', 'authority@smarttransit.in', hashPassword('Authority@123'), 'authority', 'V8', '+91 98453 30001', now);

  // 2. Nodes
  const insertNode = db.prepare(
    'INSERT INTO nodes (id, name, type, x, y, population, demand_factor) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const n of INITIAL_NODES) {
    insertNode.run(n.id, n.name, n.type, n.x, n.y, n.population, n.demand_factor);
  }

  // 3. Roads
  const insertRoad = db.prepare(
    'INSERT INTO roads (id, from_node, to_node, distance_km, travel_minutes, is_blocked, is_flood_corridor) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const r of INITIAL_ROADS) {
    insertRoad.run(r.id, r.from_node, r.to_node, r.distance_km, r.travel_minutes, r.is_blocked, r.is_flood_corridor);
  }

  // 4. Buses
  const insertBus = db.prepare(
    'INSERT INTO buses (id, name, reg_number, driver_name, driver_phone, capacity, route_stops, current_stop_idx, progress, status, delay_minutes, eta_minutes, base_travel_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const b of INITIAL_BUSES) {
    insertBus.run(
      b.id,
      b.name,
      b.reg_number,
      b.driver_name,
      b.driver_phone,
      b.capacity,
      b.route_stops,
      b.current_stop_idx,
      b.progress,
      b.status,
      b.delay_minutes,
      b.eta_minutes,
      b.base_travel_minutes
    );
  }

  // 5. 150 Students (30 Exam students)
  const villages = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'];
  const institutions = ['I1', 'I2', 'I3'];
  const insertStudent = db.prepare(
    'INSERT INTO students (id, name, village_id, institution_id, is_exam_student, exam_subject, exam_deadline_minutes, is_crisis_surge) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (let i = 1; i <= 150; i++) {
    const fn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const vIdx = Math.floor(rand() * villages.length);
    const iIdx = Math.floor(rand() * institutions.length);
    const isExam = i <= 30 ? 1 : 0;
    const examSubject = isExam ? EXAM_SUBJECTS[Math.floor(rand() * EXAM_SUBJECTS.length)] : null;
    const examDeadline = isExam ? Math.floor(55 + rand() * 55) : null; // 55..110 mins (within 2 hrs)
    insertStudent.run(
      `STU-${String(i).padStart(3, '0')}`,
      `${fn} ${ln}`,
      villages[vIdx],
      institutions[iIdx],
      isExam,
      examSubject,
      examDeadline,
      0
    );
  }

  // 6. 5 Verified Parent Vehicles
  const insertParentVehicle = db.prepare(
    'INSERT INTO parent_vehicles (id, parent_name, phone, vehicle_model, reg_number, origin_node_id, destination_node_id, seats_total, seats_available, departure_minutes, verified, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const pv of INITIAL_PARENT_VEHICLES) {
    insertParentVehicle.run(
      pv.id,
      pv.parent_name,
      pv.phone,
      pv.vehicle_model,
      pv.reg_number,
      pv.origin_node_id,
      pv.destination_node_id,
      pv.seats_total,
      pv.seats_available,
      pv.departure_minutes,
      pv.verified,
      pv.status
    );
  }

  // Seed 3 initial ParentRide requests
  const insertReq = db.prepare(
    'INSERT INTO parent_ride_requests (id, vehicle_id, student_name, student_email, pickup_node_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insertReq.run('REQ-01', 'PR-01', 'Divya Kulkarni', 'divya.k@student.in', 'V1', 'accepted', now);
  insertReq.run('REQ-02', 'PR-03', 'Aarav Gowda', 'student@smarttransit.in', 'V6', 'pending', now);
  insertReq.run('REQ-03', 'PR-02', 'Karthik Naik', 'karthik.n@student.in', 'V2', 'picked_up', now);

  // Update PR-01 and PR-02 seats_available for the 2 accepted/picked_up requests
  db.prepare('UPDATE parent_vehicles SET seats_available = seats_available - 1 WHERE id IN (?, ?)').run('PR-01', 'PR-02');

  // 7. Initial Alerts
  const insertAlert = db.prepare(
    'INSERT INTO alerts (id, title, message, severity, target_bus_id, target_role, affected_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertAlert.run(
    'ALT-01',
    'Minor Fog Delay on Nandi Hill Connect 105',
    'SIMULATED ALERT: BUS-05 (KA-42-G-1105) is running 6 minutes behind schedule near Magadi Gate due to morning fog.',
    'warning',
    'BUS-05',
    'all',
    18,
    now
  );
  insertAlert.run(
    'ALT-02',
    'Examination Corridor Priority Active',
    'SIMULATED ALERT: 30 examination candidates scheduled within the next 2 hours have been flagged for priority boarding across Taluk routes.',
    'info',
    null,
    'all',
    30,
    now
  );

  // 8. Initial SOS Record
  db.prepare(
    'INSERT INTO sos_reports (id, user_name, user_role, phone, emergency_number, location_node_id, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'SOS-001',
    'Meghana Bhat',
    'student',
    '+91 98451 10044',
    '112',
    'V3',
    'SIMULATED DRILL: Bus stop shelter lighting outage reported at Ramanagara Cross.',
    'resolved',
    now
  );

  // 9. Crisis State row (id = 1)
  db.prepare(
    'INSERT INTO crisis_state (id, active, triggered_at, exam_countdown_seconds, blocked_road_id, broken_bus_ids, demand_increase_pct, before_metrics, after_metrics) VALUES (1, 0, NULL, 7200, ?, ?, 0, NULL, NULL)'
  ).run('R15', JSON.stringify(['BUS-01', 'BUS-04']));
}
