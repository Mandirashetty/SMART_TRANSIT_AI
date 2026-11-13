export type UserRole = 'student' | 'parent' | 'admin' | 'authority';
export type LangCode = 'en' | 'kn' | 'hi' | 'ta';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  village_id: string | null;
  phone: string | null;
}

export interface TransitNode {
  id: string;
  name: string;
  type: 'village' | 'institution';
  x: number;
  y: number;
  population: number;
  demand_factor: number;
}

export interface TransitRoad {
  id: string;
  from_node: string;
  to_node: string;
  distance_km: number;
  travel_minutes: number;
  is_blocked: number;
  is_flood_corridor: number;
}

export interface TransitBus {
  id: string;
  name: string;
  reg_number: string;
  driver_name: string;
  driver_phone: string;
  capacity: number;
  route_stops: string[];
  current_stop_idx: number;
  progress: number;
  status: 'on_time' | 'delayed' | 'cancelled' | 'unavailable';
  delay_minutes: number;
  eta_minutes: number;
  base_travel_minutes: number;
}

export interface ParentVehicle {
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

export interface ParentRideRequest {
  id: string;
  vehicle_id: string;
  student_name: string;
  student_email: string;
  pickup_node_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'picked_up' | 'dropped_off';
  created_at: string;
}

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  target_bus_id: string | null;
  target_role: string;
  affected_count: number;
  created_at: string;
}

export interface SosReport {
  id: string;
  user_name: string;
  user_role: string;
  phone: string;
  emergency_number: string;
  location_node_id: string;
  notes: string;
  status: 'active' | 'dispatched' | 'resolved';
  created_at: string;
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

export interface DemandAnalyticsRow {
  village_id: string;
  village_name: string;
  population: number;
  current_demand: number;
  exam_students: number;
  bus_capacity: number;
  parent_ride_capacity: number;
  available_capacity: number;
  shortage: number;
  forecast_next_week: number;
  forecast_exam_peak: number;
}

export interface VehicleSeatMetric {
  vehicle_id: string;
  vehicle_name: string;
  type: 'bus' | 'parent_ride';
  seats_used: number;
  capacity: number;
  utilization_pct: number;
  status: string;
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
  seats_used_per_vehicle: VehicleSeatMetric[];
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

export interface CrisisStatePayload {
  simulated: boolean;
  active: boolean;
  triggered_at: string | null;
  exam_countdown_seconds: number;
  blocked_road_id: string | null;
  broken_bus_ids: string[];
  demand_increase_pct: number;
  before: CrisisMetricsSummary;
  after: CrisisMetricsSummary | null;
  assignments: AssignmentRow[];
}
