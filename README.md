MULTIVERSE OF MADNESS

# SmartTransit AI — Rural Student Transportation & Safety Platform

Deployed URL Link:https://aistudio.google.com/apps/f3a9fb44-f7ea-47cf-a724-361377bf55ff?showAssistant=true&showPreview=true

**SmartTransit AI** connects rural students, verified parents, private carpool vehicles, and government buses into a unified, crisis-resilient campus transit orchestration system.

> **Disclaimer**: All GPS coordinates, bus schedules, demand curves, and emergency crisis metrics are **SIMULATED DATA** seeded deterministically for demonstration.

---

## Architecture & Live Preview

- **Live Web Application (Port 3000)**: Full-stack **React + TypeScript + Tailwind CSS + Express + SQLite (`node:sqlite`)** application running on port `3000` (`npm run dev`).
- **Streamlit Companion (`app.py`)**: Portable Python 3.10+ Streamlit version using `sqlite3`, `pandas`, `numpy`, `plotly`, and `heapq`.

### Key Modules
1. **Crisis Command Center (Exam-Day Crisis Management)**: Simulates 4 simultaneous shocks (2 bus breakdowns, +40% student surge `150 -> 210`, flooded road removal, 2-hour exam deadlines), recalculates paths with a Min-Heap Dijkstra router, enforces strict seating capacity, shows **BEFORE vs AFTER** impact (`Served + Unreachable = Total`), supports capacity-validated manual overrides, and exports CSV crisis reports.
2. **Live Bus Tracking**: Interactive rural road network map with automatic simulated bus movement and status markers.
3. **Smart Alerts**: Admin/Authority controls to mark buses delayed, cancelled, or unavailable with automated student/parent notifications.
4. **ParentRide**: Verified parent seat offers, student requests, and accept/reject/pickup/drop-off workflows.
5. **RouteRescue AI**: Ranks Direct Buses, Transfer Bus+Walk, Verified ParentRide vehicles, and Dijkstra unblocked detours by estimated travel time.
6. **Demand Analytics**: Village-wise demand, capacity, shortages, 7-day & exam-peak forecasts, and CSV export.
7. **AI Assistant**: Database-grounded transit chatbot (Gemini 4 Hydrogen + deterministic SQLite rule-based fallback; never invents timings).
8. **Bus Details**: Driver contacts, registration numbers, capacity, routes, and inline SVG bus illustrations.
9. **Multilingual UI**: English, Kannada (`ಕನ್ನಡ`), Hindi (`हिन्दी`), and Tamil (`தமிழ்`).
10. **Emergency SOS**: Always-visible SOS button with Indian helplines (`112`, `100`, `108`, `1098`, `1091`) persisted to the Admin SOS Dashboard.
11. **AI Video Studio**: 1280×720 HD animated presentation storyboard with WebM video export.

---

## Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@smarttransit.in` | `Admin@123` |
| **Transport Authority** | `authority@smarttransit.in` | `Authority@123` |
| **Parent** | `parent@smarttransit.in` | `Parent@123` |
| **Student** | `student@smarttransit.in` | `Student@123` |

---

## Setup Instructions

### Full-Stack Web App (Primary Runtime on Port 3000)
```bash
npm install
npm run dev
```

### Python / Streamlit Companion
```bash
pip install -r requirements.txt
streamlit run app.py
```

---

## Short Demonstration Guide

1. **Crisis Command Center**: Open the default **Crisis Command** tab, verify the BEFORE baseline (`150` students, `30` exam candidates), and click **TRIGGER EXAM-DAY CRISIS**. Inspect the red flooded corridor, green Dijkstra alternative detour, BEFORE vs AFTER comparison table, manual reassignment dropdown (try exceeding a bus's capacity to see validation), and download the CSV crisis report.
2. **Live Tracking & RouteRescue AI**: Switch to **Live Tracking** to watch buses move along the 8-village / 3-campus network, then open **RouteRescue AI** to compare ranked travel options.
3. **ParentRide & Fleet Alerts**: Sign in as `parent@smarttransit.in` in **Auth & Roles** to accept/confirm rides, or as `admin@smarttransit.in` in **Bus Fleet & Alerts** to dispatch delay alerts.
4. **Multilingual & SOS**: Switch languages in the top bar (`EN / ಕನ್ನಡ / हिन्दी / தமிழ்`) and click **Emergency SOS** to log an incident to **SOS Dashboard**.
