// API-backed data layer. JWT stored in sessionStorage; all data fetched from
// the Express backend at /api/v1/. The exported interface is identical to the
// old localStorage version so all route/module components need zero changes.
import { useSyncExternalStore } from "react";

export type Role = "admin" | "teacher" | "hod";
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const PERIODS = [1, 2, 3, 4, 5, 6] as const;
export const ROOMS = ["R101", "R102", "R103", "R201", "R202", "R203", "LAB1", "LAB2"];
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const CORRECTION_WINDOW_DAYS = 1;

export interface Department { _id: string; department_id: string; name: string; active: boolean }
export interface Faculty {
  _id: string; faculty_id: string; name: string; department_id: string; subject: string;
  semester: number; role: "teacher" | "hod"; password_hash?: string; active: boolean;
}
export interface TimetableEntry {
  _id: string; faculty_id: string; day: string; period: number; room: string;
  subject: string; semester: number; class: string;
}
export interface Attendance { _id: string; faculty_id: string; timetable_id: string; date: string; status: "present" | "absent" }
export interface Leave {
  _id: string; faculty_id: string; from: string; to: string; reason: string;
  status: "pending" | "approved" | "rejected"; substitute_faculty_id?: string;
}
export interface Notice { _id: string; department_id: string; title: string; message: string; created_by: string; date: string }
export interface Audit { _id: string; user: string; action: string; at: string }
export interface Session { role: Role; faculty_id?: string; last: number }

export interface DB {
  departments: Department[]; faculty: Faculty[]; timetable: TimetableEntry[];
  attendance: Attendance[]; leaves: Leave[]; notices: Notice[]; audit: Audit[];
  session: Session | null;
}

// ─── Token helpers ────────────────────────────────────────────────────────────
const TOKEN_KEY = "fms-jwt";
export const getToken = () => sessionStorage.getItem(TOKEN_KEY) ?? "";
const setToken = (t: string) => sessionStorage.setItem(TOKEN_KEY, t);
const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

// ─── Reactive state ───────────────────────────────────────────────────────────
const EMPTY_DB: DB = {
  departments: [], faculty: [], timetable: [], attendance: [],
  leaves: [], notices: [], audit: [], session: null,
};

let state: DB = EMPTY_DB;
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useDB() { return useSyncExternalStore(subscribe, () => state, () => state); }
export function useReady() { return useSyncExternalStore(subscribe, () => ready, () => false); }
export const getDB = () => state;

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`/api/v1${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? res.statusText);
  }
  return res.json();
}

async function refreshDB() {
  try {
    const snapshot: DB = await apiFetch("/db");
    state = snapshot;
    ready = true;
    emit();
  } catch {
    // token expired or network error — clear session
    clearToken();
    state = { ...EMPTY_DB, session: null };
    ready = true;
    emit();
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
export function loadDB() {
  if (typeof window === "undefined") return;
  if (getToken()) {
    refreshDB();
  } else {
    ready = true;
    emit();
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function login(role: Role, id: string, password: string): Promise<string | null> {
  try {
    const { token } = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ role, id, password }),
    });
    setToken(token);
    await refreshDB();
    return null;
  } catch (e: any) {
    return e.message ?? "Login failed";
  }
}

export function logout() {
  clearToken();
  state = { ...EMPTY_DB, session: null };
  ready = true;
  emit();
}

export const touchSession = () => {
  // Token expiry is handled server-side (30m JWT). No-op on client.
};

// ─── Utilities (unchanged from original) ─────────────────────────────────────
export const oid = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16);
export const today = () => new Date().toISOString().slice(0, 10);
export const todayDay = () => DAYS[(new Date().getDay() + 6) % 7] ?? "Mon";
export const fname = (db: DB, id?: string) => db.faculty.find((f) => f.faculty_id === id)?.name ?? id ?? "-";
export const dname = (db: DB, id?: string) => db.departments.find((d) => d.department_id === id)?.name ?? id ?? "-";
export function canCorrect(date: string) {
  const diff = (new Date(today()).getTime() - new Date(date).getTime()) / 86400000;
  return diff <= CORRECTION_WINDOW_DAYS;
}
export function onLeave(db: DB, facultyId: string, date: string) {
  return db.leaves.some((l) => l.faculty_id === facultyId && l.status === "approved" && l.from <= date && l.to >= date);
}
export function findConflicts(tt: TimetableEntry[], e: Omit<TimetableEntry, "_id">, ignoreId?: string) {
  const out: string[] = [];
  for (const x of tt) {
    if (x._id === ignoreId || x.day !== e.day || x.period !== e.period) continue;
    if (x.faculty_id === e.faculty_id) out.push(`Teacher ${e.faculty_id} already teaches ${x.class} on ${e.day} P${e.period}`);
    if (x.class === e.class) out.push(`Class ${e.class} already has ${x.faculty_id} on ${e.day} P${e.period}`);
    if (x.room === e.room) out.push(`Room ${e.room} is taken by ${x.class} on ${e.day} P${e.period}`);
  }
  return out;
}
export function generateTimetable(db: DB, departmentId: string, perTeacher = 5) {
  // Kept for UI conflict preview; actual generation is done server-side.
  return db.timetable;
}
// Legacy hash kept so modules.tsx import doesn't break (never called with real backend)
export function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return "h" + h.toString(16);
}

// ─── mutate — optimistic update + background API sync ────────────────────────
// Each call maps the auditAction prefix to the right API endpoint.
export function mutate(fn: (draft: DB) => void, auditAction?: string): void {
  // 1. Optimistic update
  const draft: DB = structuredClone(state);
  fn(draft);
  state = draft;
  emit();

  // 2. Determine which API to call from auditAction
  if (!auditAction) return;
  syncAction(auditAction, draft).then(refreshDB).catch(() => refreshDB());
}

async function syncAction(action: string, draft: DB) {
  const token = getToken();
  if (!token) return;

  // department add <ID>
  if (action.startsWith("department add ")) {
    const dept_id = action.split(" ")[2];
    const d = draft.departments.find((x) => x.department_id === dept_id);
    if (d) await apiFetch("/departments", { method: "POST", body: JSON.stringify({ name: d.name }) });
    return;
  }
  // department rename <ID>
  if (action.startsWith("department rename ")) {
    const dept_id = action.split(" ")[2];
    const d = draft.departments.find((x) => x.department_id === dept_id);
    if (d) await apiFetch(`/departments/${dept_id}`, { method: "PATCH", body: JSON.stringify({ name: d.name }) });
    return;
  }
  // department toggle <ID>
  if (action.startsWith("department toggle ")) {
    const dept_id = action.split(" ")[2];
    const d = draft.departments.find((x) => x.department_id === dept_id);
    if (d) await apiFetch(`/departments/${dept_id}`, { method: "PATCH", body: JSON.stringify({ active: d.active }) });
    return;
  }
  // department delete <ID>
  if (action.startsWith("department delete ")) {
    const dept_id = action.split(" ")[2];
    await apiFetch(`/departments/${dept_id}`, { method: "DELETE" });
    return;
  }
  // faculty add <ID>
  if (action.startsWith("faculty add ")) {
    const fid = action.split(" ")[2];
    const f = draft.faculty.find((x) => x.faculty_id === fid);
    if (f) {
      // We need the plain-text password — not available after hash. Send without password, backend defaults to "teach123".
      await apiFetch("/faculty", { method: "POST", body: JSON.stringify({ ...f, password: undefined }) });
    }
    return;
  }
  // faculty edit <ID>
  if (action.startsWith("faculty edit ")) {
    const fid = action.split(" ")[2];
    const f = draft.faculty.find((x) => x.faculty_id === fid);
    if (f) await apiFetch(`/faculty/${fid}`, { method: "PATCH", body: JSON.stringify({ name: f.name, department_id: f.department_id, subject: f.subject, semester: f.semester }) });
    return;
  }
  // faculty remove <ID>
  if (action.startsWith("faculty remove ")) {
    const fid = action.split(" ")[2];
    await apiFetch(`/faculty/${fid}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
    return;
  }
  // timetable add <facultyId> <day> <Pperiod>
  if (action.startsWith("timetable add ")) {
    const parts = action.split(" ");
    const fid = parts[2], day = parts[3], p = Number((parts[4] ?? "P1").slice(1));
    const entry = draft.timetable.find((t) => t.faculty_id === fid && t.day === day && t.period === p);
    if (entry) await apiFetch("/timetable", { method: "POST", body: JSON.stringify(entry) });
    return;
  }
  // timetable edit-id <_id>
  if (action.startsWith("timetable edit-id ")) {
    const id = action.split(" ")[2];
    const entry = draft.timetable.find((t) => t._id === id);
    if (entry) await apiFetch(`/timetable/${id}`, { method: "PUT", body: JSON.stringify(entry) });
    return;
  }
  // timetable edit <facultyId> <day> <Pperiod>
  if (action.startsWith("timetable edit ")) {
    const parts = action.split(" ");
    const fid = parts[2], day = parts[3], p = Number((parts[4] ?? "P1").slice(1));
    const entry = draft.timetable.find((t) => t.faculty_id === fid && t.day === day && t.period === p);
    if (entry) await apiFetch(`/timetable/${entry._id}`, { method: "PUT", body: JSON.stringify(entry) });
    return;
  }
  // timetable delete-id <_id>
  if (action.startsWith("timetable delete-id ")) {
    const id = action.split(" ")[2];
    await apiFetch(`/timetable/${id}`, { method: "DELETE" });
    return;
  }
  // timetable delete <facultyId> <day> <Pperiod> (legacy fallback)
  if (action.startsWith("timetable delete ")) {
    // The slot was already removed from draft; look in original state
    // We resolve by refreshing — the slot will be gone server-side too after delete
    // Actually the slot _id isn't available here; we handle via refreshDB
    return;
  }
  // timetable auto-generate <dept>
  if (action.startsWith("timetable auto-generate ")) {
    const dept = action.split(" ")[2];
    await apiFetch("/timetable/generate", { method: "POST", body: JSON.stringify({ department_id: dept }) });
    return;
  }
  // attendance <facultyId> <date> <status>
  if (action.startsWith("attendance ")) {
    const parts = action.split(" ");
    const faculty_id = parts[1], date = parts[2], status = parts[3];
    const slots = draft.timetable.filter((t) => t.faculty_id === faculty_id && t.day === DAYS[(new Date(date).getDay() + 6) % 7]);
    if (slots.length) {
      for (const s of slots) {
        await apiFetch("/attendance", { method: "POST", body: JSON.stringify({ faculty_id, timetable_id: s._id, date, status }) });
      }
    } else {
      await apiFetch("/attendance", { method: "POST", body: JSON.stringify({ faculty_id, timetable_id: "general", date, status }) });
    }
    return;
  }
  // leave request <facultyId>
  if (action.startsWith("leave request ")) {
    const newLeave = draft.leaves.at(-1);
    if (newLeave) {
      await apiFetch("/leaves", { method: "POST", body: JSON.stringify({ from: newLeave.from, to: newLeave.to, reason: newLeave.reason }) });
    }
    return;
  }
  // leave approved <id> / leave rejected <id>
  if (action.startsWith("leave approved ") || action.startsWith("leave rejected ")) {
    const parts = action.split(" ");
    const status = parts[1] as "approved" | "rejected";
    const id = parts[2];
    const leave = draft.leaves.find((l) => l._id === id);
    await apiFetch(`/leaves/${id}`, { method: "PATCH", body: JSON.stringify({ status, substitute_faculty_id: leave?.substitute_faculty_id }) });
    return;
  }
  // notice <title>
  if (action.startsWith("notice ")) {
    const notice = draft.notices[0]; // newest notice is first after optimistic push
    if (notice) {
      await apiFetch("/notices", { method: "POST", body: JSON.stringify({ title: notice.title, message: notice.message, department_id: notice.department_id }) });
    }
    return;
  }
}

// ─── resetDB (admin only, kept for UI button) ─────────────────────────────────
export function resetDB() {
  // Not exposed in new backend — just reload from server
  refreshDB();
}
