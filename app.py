"""
SmartTransit AI - Streamlit Companion Application
AI-Powered Rural Student Transportation & Safety Platform (SIMULATED DATA)
Run with: streamlit run app.py
"""

from __future__ import annotations

import hashlib
import heapq
import json
import os
import random
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

DB_PATH = "smarttransit_streamlit.db"
SEED = 42026


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return f"{salt}:{digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split(":")
        return hash_password(password, salt) == stored
    except ValueError:
        return False


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_and_seed_db(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE,
            password_hash TEXT, role TEXT, village_id TEXT, phone TEXT
        );
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY, name TEXT, type TEXT, x REAL, y REAL,
            population INTEGER, demand_factor REAL
        );
        CREATE TABLE IF NOT EXISTS roads (
            id TEXT PRIMARY KEY, from_node TEXT, to_node TEXT,
            distance_km REAL, travel_minutes REAL, is_blocked INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS buses (
            id TEXT PRIMARY KEY, name TEXT, reg_number TEXT, driver_name TEXT,
            driver_phone TEXT, capacity INTEGER, route_stops TEXT,
            status TEXT, delay_minutes INTEGER, eta_minutes INTEGER
        );
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY, name TEXT, village_id TEXT, institution_id TEXT,
            is_exam_student INTEGER, exam_subject TEXT, exam_deadline_minutes INTEGER,
            is_crisis_surge INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS parent_vehicles (
            id TEXT PRIMARY KEY, parent_name TEXT, phone TEXT, vehicle_model TEXT,
            reg_number TEXT, origin_node_id TEXT, destination_node_id TEXT,
            seats_total INTEGER, seats_available INTEGER, departure_minutes INTEGER, verified INTEGER
        );
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY, title TEXT, message TEXT, severity TEXT, created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS sos_reports (
            id TEXT PRIMARY KEY, user_name TEXT, emergency_number TEXT,
            location_node_id TEXT, notes TEXT, status TEXT, created_at TEXT
        );
        """
    )

    if cur.execute("SELECT COUNT(*) FROM nodes").fetchone()[0] > 0:
        conn.commit()
        return

    rng = random.Random(SEED)

    users = [
        ("USR-STU", "Aarav Gowda", "student@smarttransit.in", hash_password("Student@123"), "student", "V6", "+91 98451 10001"),
        ("USR-PAR", "Anitha Deshmukh", "parent@smarttransit.in", hash_password("Parent@123"), "parent", "V1", "+91 99001 44101"),
        ("USR-ADM", "Dr. Kavya Rao", "admin@smarttransit.in", hash_password("Admin@123"), "admin", "I1", "+91 98452 20001"),
        ("USR-AUT", "R. Prakash", "authority@smarttransit.in", hash_password("Authority@123"), "authority", "V8", "+91 98453 30001"),
    ]
    cur.executemany("INSERT INTO users VALUES (?,?,?,?,?,?,?)", users)

    nodes = [
        ("V1", "Kengeri Rural", "village", 110, 290, 3400, 1.05),
        ("V2", "Bidadi Hobli", "village", 240, 400, 4100, 1.18),
        ("V3", "Ramanagara Cross", "village", 460, 415, 3850, 1.12),
        ("V4", "Channapatna East", "village", 675, 390, 3200, 0.96),
        ("V5", "Magadi Gate", "village", 215, 155, 2950, 0.92),
        ("V6", "Tavarekere", "village", 415, 205, 3650, 1.15),
        ("V7", "Nelamangala North", "village", 350, 78, 3100, 0.98),
        ("V8", "Kanakapura Road", "village", 590, 255, 4300, 1.24),
        ("I1", "Govt Polytechnic College", "institution", 770, 145, 1200, 1.0),
        ("I2", "Rural Engineering Institute", "institution", 845, 300, 1500, 1.0),
        ("I3", "District Junior College", "institution", 605, 95, 1100, 1.0),
    ]
    cur.executemany("INSERT INTO nodes VALUES (?,?,?,?,?,?,?)", nodes)

    roads = [
        ("R1", "V1", "V2", 9.5, 12, 0), ("R2", "V1", "V5", 11.0, 14, 0),
        ("R3", "V1", "V6", 15.5, 19, 0), ("R4", "V2", "V3", 12.0, 15, 0),
        ("R5", "V2", "V6", 13.5, 17, 0), ("R6", "V3", "V4", 13.0, 16, 0),
        ("R7", "V3", "V8", 11.5, 15, 0), ("R8", "V3", "V6", 12.5, 16, 0),
        ("R9", "V4", "V8", 10.5, 14, 0), ("R10", "V4", "I2", 11.0, 13, 0),
        ("R11", "V5", "V7", 10.0, 12, 0), ("R12", "V5", "V6", 11.5, 14, 0),
        ("R13", "V7", "I3", 14.0, 17, 0), ("R14", "V6", "I3", 12.0, 15, 0),
        ("R15", "V6", "V8", 10.0, 11, 0), ("R16", "V8", "I1", 13.0, 16, 0),
        ("R17", "V8", "I2", 14.5, 18, 0), ("R18", "V8", "I3", 11.0, 14, 0),
        ("R19", "I3", "I1", 9.5, 12, 0), ("R20", "I1", "I2", 10.5, 13, 0),
    ]
    cur.executemany("INSERT INTO roads VALUES (?,?,?,?,?,?)", roads)

    buses = [
        ("BUS-01", "KSRTC Grama Express 101", "KA-42-G-1101", "Ramesh Gowda", "+91 98450 11011", 26, json.dumps(["V1", "V6", "V8", "I1"]), "on_time", 0, 18),
        ("BUS-02", "KSRTC Vidya Vahini 102", "KA-42-G-1102", "Mahesh Naik", "+91 98450 11022", 24, json.dumps(["V2", "V3", "V8", "I2"]), "on_time", 0, 22),
        ("BUS-03", "Sahyadri Rural Shuttle 103", "KA-42-G-1103", "Suresh Kulkarni", "+91 98450 11033", 22, json.dumps(["V5", "V7", "I3", "I1"]), "on_time", 0, 16),
        ("BUS-04", "Cauvery Student Special 104", "KA-42-G-1104", "Venkatesh Murthy", "+91 98450 11044", 24, json.dumps(["V1", "V2", "V3", "V4", "I2"]), "on_time", 0, 24),
        ("BUS-05", "Nandi Hill Connect 105", "KA-42-G-1105", "Prakash Shetty", "+91 98450 11055", 20, json.dumps(["V5", "V6", "I3", "I1"]), "delayed", 6, 21),
        ("BUS-06", "Kanakapura Corridor 106", "KA-42-G-1106", "Kiran Kumar", "+91 98450 11066", 22, json.dumps(["V3", "V8", "I1", "I2"]), "on_time", 0, 19),
        ("BUS-07", "Channapatna Express 107", "KA-42-G-1107", "Basavaraj Patil", "+91 98450 11077", 20, json.dumps(["V4", "V8", "I3", "I1"]), "on_time", 0, 17),
        ("BUS-08", "Tavarekere Link 108", "KA-42-G-1108", "Manjunath Rao", "+91 98450 11088", 18, json.dumps(["V2", "V6", "V8", "I2"]), "on_time", 0, 20),
        ("BUS-09", "North Taluk Feeder 109", "KA-42-G-1109", "Harish Babu", "+91 98450 11099", 18, json.dumps(["V1", "V5", "V7", "I3"]), "on_time", 0, 14),
        ("BUS-10", "District Campus Loop 110", "KA-42-G-1110", "Shankarappa D", "+91 98450 11100", 20, json.dumps(["V6", "V3", "V4", "I2"]), "on_time", 0, 23),
    ]
    cur.executemany("INSERT INTO buses VALUES (?,?,?,?,?,?,?,?,?,?)", buses)

    villages = ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8"]
    insts = ["I1", "I2", "I3"]
    subjects = ["Engineering Math II", "Applied Physics", "Digital Electronics", "Computer Networks"]
    students = []
    for i in range(1, 151):
        is_exam = 1 if i <= 30 else 0
        students.append((
            f"STU-{i:03d}",
            f"Student {i:03d}",
            rng.choice(villages),
            rng.choice(insts),
            is_exam,
            rng.choice(subjects) if is_exam else None,
            rng.randint(55, 110) if is_exam else None,
            0,
        ))
    cur.executemany("INSERT INTO students VALUES (?,?,?,?,?,?,?,?)", students)

    parent_vehicles = [
        ("PR-01", "Anitha Deshmukh", "+91 99001 44101", "Maruti Ertiga", "KA-05-MJ-4821", "V1", "I1", 4, 4, 10, 1),
        ("PR-02", "Rajeshwari Hegde", "+91 99001 44102", "Tata Nexon EV", "KA-42-N-9014", "V2", "I2", 4, 4, 12, 1),
        ("PR-03", "Srinivasulu Reddy", "+91 99001 44103", "Mahindra Bolero", "KA-42-B-3372", "V6", "I3", 5, 5, 8, 1),
        ("PR-04", "Kavitha Narayan", "+91 99001 44104", "Hyundai Creta", "KA-01-Z-7729", "V3", "I1", 3, 3, 15, 1),
        ("PR-05", "Mohammed Irfan", "+91 99001 44105", "Toyota Innova", "KA-42-P-5510", "V8", "I2", 4, 4, 9, 1),
    ]
    cur.executemany("INSERT INTO parent_vehicles VALUES (?,?,?,?,?,?,?,?,?,?,?)", parent_vehicles)
    conn.commit()


def dijkstra_heapq(
    nodes: List[Dict[str, Any]],
    roads: List[Dict[str, Any]],
    start: str,
    end: str,
) -> Tuple[bool, float, List[str]]:
    """Shortest travel time path using Python heapq min-heap priority queue."""
    if start == end:
        return True, 0.0, [start]
    adj: Dict[str, List[Tuple[str, float]]] = {n["id"]: [] for n in nodes}
    for r in roads:
        if r["is_blocked"]:
            continue
        adj[r["from_node"]].append((r["to_node"], float(r["travel_minutes"])))
        adj[r["to_node"]].append((r["from_node"], float(r["travel_minutes"])))

    dist = {n["id"]: float("inf") for n in nodes}
    prev: Dict[str, Optional[str]] = {n["id"]: None for n in nodes}
    dist[start] = 0.0
    pq: List[Tuple[float, str]] = [(0.0, start)]

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        if u == end:
            break
        for v, w in adj[u]:
            if d + w < dist[v]:
                dist[v] = d + w
                prev[v] = u
                heapq.heappush(pq, (dist[v], v))

    if dist[end] == float("inf"):
        return False, 999.0, []
    path: List[str] = []
    cur: Optional[str] = end
    while cur:
        path.append(cur)
        cur = prev[cur]
    path.reverse()
    return True, dist[end], path


def main() -> None:
    st.set_page_config(page_title="SmartTransit AI", layout="wide")
    conn = get_conn()
    init_and_seed_db(conn)

    st.title("SmartTransit AI — Rural Student Transportation & Safety Platform")
    st.caption("SIMULATED DATA · Python + Streamlit + SQLite + Pandas + NumPy + Plotly + heapq")

    nodes = [dict(r) for r in conn.execute("SELECT * FROM nodes").fetchall()]
    roads = [dict(r) for r in conn.execute("SELECT * FROM roads").fetchall()]
    buses = [dict(r) for r in conn.execute("SELECT * FROM buses").fetchall()]
    students = [dict(r) for r in conn.execute("SELECT * FROM students").fetchall()]

    tab1, tab2, tab3 = st.tabs(["Exam-Day Crisis Command", "Live Network Map", "Demand Analytics"])

    with tab1:
        col_a, col_b = st.columns(2)
        if col_a.button("TRIGGER EXAM-DAY CRISIS", type="primary"):
            conn.execute("UPDATE roads SET is_blocked = 1 WHERE id = 'R15'")
            conn.execute("UPDATE buses SET status = 'unavailable' WHERE id IN ('BUS-01', 'BUS-04')")
            conn.commit()
            st.rerun()
        if col_b.button("RESET CRISIS"):
            conn.execute("UPDATE roads SET is_blocked = 0")
            conn.execute("UPDATE buses SET status = 'on_time'")
            conn.commit()
            st.rerun()

        ok, mins, path = dijkstra_heapq(nodes, roads, "V6", "I1")
        st.metric("Dijkstra Route V6 -> I1", f"{mins:.1f} min" if ok else "Blocked", " -> ".join(path))

    with tab2:
        fig = go.Figure()
        node_map = {n["id"]: n for n in nodes}
        for r in roads:
            a, b = node_map[r["from_node"]], node_map[r["to_node"]]
            fig.add_trace(
                go.Scatter(
                    x=[a["x"], b["x"]],
                    y=[a["y"], b["y"]],
                    mode="lines",
                    line=dict(color="red" if r["is_blocked"] else "royalblue", width=3 if r["is_blocked"] else 1.5),
                    showlegend=False,
                )
            )
        fig.add_trace(
            go.Scatter(
                x=[n["x"] for n in nodes],
                y=[n["y"] for n in nodes],
                mode="markers+text",
                text=[n["name"] for n in nodes],
                textposition="top center",
                marker=dict(size=12, color="indigo"),
                showlegend=False,
            )
        )
        st.plotly_chart(fig, use_container_width=True)

    with tab3:
        df = pd.DataFrame(students)
        demand = df.groupby("village_id").size().reset_index(name="demand")
        demand["exam_peak_forecast"] = np.ceil(demand["demand"] * 1.4).astype(int)
        st.plotly_chart(px.bar(demand, x="village_id", y=["demand", "exam_peak_forecast"], barmode="group"), use_container_width=True)
        st.download_button("Download Demand CSV", demand.to_csv(index=False), "demand_forecast.csv", "text/csv")


if __name__ == "__main__":
    main()
