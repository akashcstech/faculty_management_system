// Uses the built-in node:sqlite module (Node.js v22.5+, stable in v24).
// Zero native dependencies — no compilation required.
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.join(__dirname, "../../fms.db");

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

export const oid = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16);
export const today = () => new Date().toISOString().slice(0, 10);

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const PERIODS = [1, 2, 3, 4, 5, 6] as const;

// Fixed room per class: one dedicated classroom for each (department, semester) pair.
// Rule: 18 classes total — do NOT share rooms across semesters.
export const CLASS_ROOM: Record<string, Record<number, string>> = {
  BCA:  { 1: "R101", 2: "R102", 3: "R103", 4: "R104", 5: "R105", 6: "R106" },
  BCOM: { 1: "R107", 2: "R108", 3: "R109", 4: "R110", 5: "R111", 6: "R112" },
  BSC:  { 1: "R113", 2: "R114", 3: "R115", 4: "R116", 5: "R117", 6: "R118" },
};
// Flat list for backward-compat (e.g. conflict checkers that display room names)
export const ROOMS = Object.values(CLASS_ROOM).flatMap(m => Object.values(m));

// Simple bcrypt-like hash using Node built-in crypto (no bcryptjs needed)
export function hashPassword(password: string): string {
  return createHash("sha256").update("fms-salt-v1:" + password).digest("hex");
}
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

function findConflictsInternal(entries: any[], e: any, ignoreId?: string): string[] {
  const out: string[] = [];
  for (const x of entries) {
    if (x._id === ignoreId || x.day !== e.day || x.period !== e.period) continue;
    if (x.faculty_id === e.faculty_id) out.push(`Teacher ${e.faculty_id} already teaches on ${e.day} P${e.period}`);
    if (x.class === e.class) out.push(`Class ${e.class} already has a slot on ${e.day} P${e.period}`);
    if (x.room === e.room) out.push(`Room ${e.room} is taken on ${e.day} P${e.period}`);
  }
  return out;
}

export function checkConflicts(entries: any[], e: any, ignoreId?: string): string[] {
  return findConflictsInternal(entries, e, ignoreId);
}

export function generateTimetable(
  facultyList: any[],
  departments: any[],
  existing: any[],
  departmentId: string,
  perTeacher = 6
): any[] {
  const kept = existing.filter((t: any) => {
    const f = facultyList.find((x: any) => x.faculty_id === t.faculty_id);
    return f?.department_id !== departmentId;
  });
  const dep = departments.find((d: any) => d.department_id === departmentId);
  const teachers = facultyList.filter((f: any) => (f.active === undefined || f.active === 1 || f.active === true) && f.department_id === departmentId);
  const created: any[] = [];
  let seed = 0;
  for (const t of teachers) {
    // Fixed room for this class — no room scanning needed
    const room = CLASS_ROOM[departmentId]?.[t.semester];
    if (!room) { seed += 3; continue; } // skip if no mapping defined
    let placed = 0;
    for (let k = 0; k < DAYS.length * PERIODS.length && placed < perTeacher; k++) {
      const idx = (k * 7 + seed) % (DAYS.length * PERIODS.length);
      const day = DAYS[idx % DAYS.length] ?? "Mon";
      const period = PERIODS[Math.floor(idx / DAYS.length)] ?? 1;
      const cls = `${dep?.name ?? departmentId}-S${t.semester}`;
      // Only block if the same teacher is already assigned at this day+period
      const teacherConflict = [...kept, ...created].some(
        (x) => x.day === day && x.period === period && x.faculty_id === t.faculty_id
      );
      if (teacherConflict) continue;
      // Also block duplicate slot for the same class at same day+period
      const classConflict = [...kept, ...created].some(
        (x) => x.day === day && x.period === period && x.class === cls
      );
      if (classConflict) continue;
      created.push({ _id: oid(), faculty_id: t.faculty_id, day, period, room, subject: t.subject, semester: t.semester, class: cls });
      placed++;
    }
    seed += 3;
  }
  return [...kept, ...created];
}

function setup() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      _id TEXT PRIMARY KEY,
      department_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS faculty (
      _id TEXT PRIMARY KEY,
      faculty_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      semester INTEGER NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS timetable (
      _id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      day TEXT NOT NULL,
      period INTEGER NOT NULL,
      room TEXT NOT NULL,
      subject TEXT NOT NULL,
      semester INTEGER NOT NULL,
      class TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attendance (
      _id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      timetable_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      UNIQUE(timetable_id, date, faculty_id)
    );
    CREATE TABLE IF NOT EXISTS leaves (
      _id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      substitute_faculty_id TEXT
    );
    CREATE TABLE IF NOT EXISTS notices (
      _id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_by TEXT NOT NULL,
      date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      _id TEXT PRIMARY KEY,
      user TEXT NOT NULL,
      action TEXT NOT NULL,
      at TEXT NOT NULL
    );
  `);

  const row = db.prepare("SELECT COUNT(*) as c FROM departments").get() as { c: number };
  if (row.c === 0) seedData();
}

function seedData() {
  const departments = [
    { _id: oid(), department_id: "BCA",  name: "BCA" },
    { _id: oid(), department_id: "BCOM", name: "B.Com" },
    { _id: oid(), department_id: "BSC",  name: "BSc" },
  ];

  const tHash = hashPassword("teach123");
  const hHash = hashPassword("hod123");

  const facultyData = [
    // ── BCA (R101–R106) ──────────────────────────────────────────────────────
    { _id: oid(), faculty_id: "T103", name: "Rohit Sharma",        department_id: "BCA",  subject: "Web Technologies",    semester: 1, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "T104", name: "Ananya Singh",        department_id: "BCA",  subject: "C Programming",       semester: 2, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "H100", name: "Dr. Meera Iyer",      department_id: "BCA",  subject: "Data Structures",     semester: 3, role: "hod",     password_hash: hHash, active: 1 },
    { _id: oid(), faculty_id: "T101", name: "Arjun Rao",           department_id: "BCA",  subject: "Java Programming",    semester: 3, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "T105", name: "Deepak Verma",        department_id: "BCA",  subject: "Operating Systems",   semester: 4, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "T102", name: "Kavya Nair",          department_id: "BCA",  subject: "DBMS",                semester: 5, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "T106", name: "Sneha Patel",         department_id: "BCA",  subject: "Software Engineering",semester: 6, role: "teacher", password_hash: tHash, active: 1 },
    // ── B.Com (R107–R112) ────────────────────────────────────────────────────
    { _id: oid(), faculty_id: "T201", name: "Priya Menon",         department_id: "BCOM", subject: "Business Law",        semester: 1, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "T203", name: "Suresh Kumar",        department_id: "BCOM", subject: "Financial Accounting",semester: 2, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "H200", name: "Dr. Sanjay Gupta",   department_id: "BCOM", subject: "Corporate Accounting",semester: 3, role: "hod",     password_hash: hHash, active: 1 },
    { _id: oid(), faculty_id: "T204", name: "Rekha Sharma",        department_id: "BCOM", subject: "Cost Accounting",     semester: 4, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "T202", name: "Imran Khan",          department_id: "BCOM", subject: "Income Tax",          semester: 5, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "T205", name: "Anita Roy",           department_id: "BCOM", subject: "Auditing",            semester: 6, role: "teacher", password_hash: tHash, active: 1 },
    // ── BSc (R113–R118) ──────────────────────────────────────────────────────
    { _id: oid(), faculty_id: "T301", name: "Neha Joshi",          department_id: "BSC",  subject: "Chemistry",           semester: 1, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "T303", name: "Arun Pillai",         department_id: "BSC",  subject: "Biology",             semester: 2, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "H300", name: "Dr. Lakshmi Pillai",  department_id: "BSC",  subject: "Physics",             semester: 3, role: "hod",     password_hash: hHash, active: 1 },
    { _id: oid(), faculty_id: "T304", name: "Ramesh Nair",         department_id: "BSC",  subject: "Zoology",             semester: 4, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "T302", name: "Vikram Das",          department_id: "BSC",  subject: "Mathematics",         semester: 5, role: "teacher", password_hash: tHash, active: 1 },
    { _id: oid(), faculty_id: "T305", name: "Pooja Krishnan",      department_id: "BSC",  subject: "Statistics",          semester: 6, role: "teacher", password_hash: tHash, active: 1 },
  ];

  for (const d of departments) {
    db.prepare("INSERT INTO departments (_id, department_id, name, active) VALUES (?, ?, ?, 1)").run(d._id, d.department_id, d.name);
  }
  for (const f of facultyData) {
    db.prepare("INSERT INTO faculty (_id, faculty_id, name, department_id, subject, semester, role, password_hash, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)")
      .run(f._id, f.faculty_id, f.name, f.department_id, f.subject, f.semester, f.role, f.password_hash);
  }

  let timetable: any[] = [];
  for (const d of departments) {
    timetable = generateTimetable(facultyData, departments, timetable, d.department_id, 6);
  }
  const ins = db.prepare("INSERT OR IGNORE INTO timetable (_id, faculty_id, day, period, room, subject, semester, class) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const t of timetable) ins.run(t._id, t.faculty_id, t.day, t.period, t.room, t.subject, t.semester, t.class);

  const td = today();
  db.prepare("INSERT INTO leaves (_id, faculty_id, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)")
    .run(oid(), "T102", td, td, "Medical appointment", "pending");
  db.prepare("INSERT INTO leaves (_id, faculty_id, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)")
    .run(oid(), "T201", td, td, "Family function", "pending");
  db.prepare("INSERT INTO notices (_id, department_id, title, message, created_by, date) VALUES (?, ?, ?, ?, ?, ?)")
    .run(oid(), "BCA", "Department meeting", "All BCA faculty meet in the seminar hall on Friday at 3 PM.", "H100", td);

  console.log("✅ Database seeded with demo data.");
}

setup();
export default db;
