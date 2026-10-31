import { useState } from "react";
import { Trash2, Pencil, Wand2 } from "lucide-react";
import {
  useDB, mutate, oid, hash, findConflicts, generateTimetable, DAYS, PERIODS, ROOMS, today, todayDay,
  fname, dname, onLeave, type TimetableEntry, type Faculty,
} from "@/lib/store";
import { Card, Btn, Field, Input, Select, Table, Badge, Flash, useFlash } from "./kit";

/* ---------- Departments (FR-A1) ---------- */
export function Departments() {
  const db = useDB();
  const f = useFlash();
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const add = () => {
    const n = name.trim();
    if (!n) return f.err("Department name is required");
    const id = n.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (db.departments.some((d) => d.department_id === id)) return f.err("Department already exists");
    mutate((d) => { d.departments.push({ _id: oid(), department_id: id, name: n, active: true }); }, `department add ${id}`);
    setName(""); f.ok(`Added ${n}`);
  };
  const deleteDept = (d: { department_id: string; name: string }) => {
    const facultyCount = db.faculty.filter((x) => x.department_id === d.department_id).length;
    const msg = facultyCount > 0
      ? `Delete "${d.name}"? This will permanently remove ${facultyCount} faculty member(s), their timetable slots, attendance records and all department notices. This cannot be undone.`
      : `Delete "${d.name}" permanently? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    mutate(
      (x) => {
        // cascade remove in local state
        const fids = x.faculty.filter((f) => f.department_id === d.department_id).map((f) => f.faculty_id);
        x.timetable = x.timetable.filter((t) => !fids.includes(t.faculty_id));
        x.attendance = x.attendance.filter((a) => !fids.includes(a.faculty_id));
        x.leaves = x.leaves.filter((l) => !fids.includes(l.faculty_id));
        x.faculty = x.faculty.filter((f) => f.department_id !== d.department_id);
        x.notices = x.notices.filter((n) => n.department_id !== d.department_id);
        x.departments = x.departments.filter((dep) => dep.department_id !== d.department_id);
      },
      `department delete ${d.department_id}`
    );
    f.ok(`Deleted ${d.name}`);
  };
  return (
    <Card title="Departments">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="New department"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. BBA" /></Field>
        <Btn onClick={add}>Add department</Btn>
      </div>
      <Table head={["ID", "Name", "Faculty", "Status", ""]} rows={db.departments.map((d) => [
        d.department_id,
        edit?.id === d.department_id
          ? <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          : d.name,
        db.faculty.filter((x) => x.active && x.department_id === d.department_id).length,
        <Badge tone={d.active ? "ok" : "bad"}>{d.active ? "Active" : "Inactive"}</Badge>,
        <div className="flex gap-2">
          {edit?.id === d.department_id
            ? <Btn variant="soft" onClick={() => { mutate((x) => { const t = x.departments.find((y) => y.department_id === d.department_id); if (t) t.name = edit.name.trim() || t.name; }, `department rename ${d.department_id}`); setEdit(null); }}>Save</Btn>
            : <Btn variant="ghost" onClick={() => setEdit({ id: d.department_id, name: d.name })}><Pencil className="h-4 w-4" /> Rename</Btn>}
          <Btn variant="ghost" onClick={() => mutate((x) => { const t = x.departments.find((y) => y.department_id === d.department_id); if (t) t.active = !t.active; }, `department toggle ${d.department_id}`)}>{d.active ? "Deactivate" : "Activate"}</Btn>
          <Btn variant="ghost" onClick={() => deleteDept(d)}><Trash2 className="h-4 w-4 text-red-500" /></Btn>
        </div>,
      ])} />
      <Flash msg={f.msg} />
    </Card>
  );
}

/* ---------- Faculty (FR-A2, FR-A3, FR-H1) ---------- */
const blank = { faculty_id: "", name: "", department_id: "", subject: "", semester: "1", password: "teach123" };

export function FacultyManager({ lockDept, mode }: { lockDept?: string; mode: "admin" | "hod" }) {
  const db = useDB();
  const f = useFlash();
  const [form, setForm] = useState({ ...blank, department_id: lockDept ?? "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [rm, setRm] = useState({ id: "", dept: lockDept ?? "" });
  const list = db.faculty.filter((x) => x.active && (!lockDept || x.department_id === lockDept));

  const save = () => {
    const id = form.faculty_id.trim().toUpperCase();
    if (!id || !form.name.trim() || !form.department_id || !form.subject.trim() || !form.semester) return f.err("All fields are required");
    if (editing) {
      mutate((d) => { const t = d.faculty.find((x) => x.faculty_id === editing); if (t) Object.assign(t, { name: form.name.trim(), department_id: form.department_id, subject: form.subject.trim(), semester: Number(form.semester) }); }, `faculty edit ${editing}`);
      f.ok(`Updated ${editing}`); setEditing(null);
    } else {
      if (db.faculty.some((x) => x.faculty_id === id)) return f.err(`Faculty ID ${id} already exists`);
      const doc: Faculty = { _id: oid(), faculty_id: id, name: form.name.trim(), department_id: form.department_id, subject: form.subject.trim(), semester: Number(form.semester), role: "teacher", password_hash: hash(form.password || "teach123"), active: true };
      mutate((d) => { d.faculty.push(doc); }, `faculty add ${id}`);
      f.ok(`Added ${id}. Login password: ${form.password || "teach123"}`);
    }
    setForm({ ...blank, department_id: lockDept ?? "" });
  };

  const remove = (id: string, dept: string) => {
    const t = db.faculty.find((x) => x.active && x.faculty_id === id.trim().toUpperCase() && x.department_id === dept);
    if (!t) return f.err("No active faculty matches that ID and department");
    if (t.role === "hod" && mode === "hod") return f.err("A HOD cannot remove themselves");
    if (!window.confirm(`Remove ${t.name} (${t.faculty_id})? Their history will be kept.`)) return;
    mutate((d) => { const x = d.faculty.find((y) => y.faculty_id === t.faculty_id); if (x) x.active = false; }, `faculty remove ${t.faculty_id}`);
    f.ok(`Removed ${t.faculty_id}`); setRm({ id: "", dept: lockDept ?? "" });
  };

  const freeNow = (fid: string) => !db.timetable.some((t) => t.faculty_id === fid && t.day === todayDay()) ? "Free today" : `${db.timetable.filter((t) => t.faculty_id === fid && t.day === todayDay()).length} classes today`;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card title={mode === "admin" ? "All faculty" : "Department teachers"}>
          <Table head={["ID", "Name", "Dept", "Subject", "Sem", "Availability", ""]} rows={list.map((x) => [
            <span className="font-mono">{x.faculty_id}</span>, <>{x.name} {x.role === "hod" && <Badge tone="warn">HOD</Badge>}</>,
            dname(db, x.department_id), x.subject, x.semester,
            onLeave(db, x.faculty_id, today()) ? <Badge tone="bad">On leave</Badge> : <span className="text-xs text-muted-foreground">{freeNow(x.faculty_id)}</span>,
            <div className="flex gap-1">
              <Btn variant="ghost" title="Edit" onClick={() => { setEditing(x.faculty_id); setForm({ faculty_id: x.faculty_id, name: x.name, department_id: x.department_id, subject: x.subject, semester: String(x.semester), password: "" }); }}><Pencil className="h-4 w-4" /></Btn>
              <Btn variant="ghost" title="Remove" onClick={() => remove(x.faculty_id, x.department_id)}><Trash2 className="h-4 w-4" /></Btn>
            </div>,
          ])} />
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card title={editing ? `Edit ${editing}` : "Add faculty"}>
          <div className="flex flex-col gap-3">
            <Field label="Faculty ID"><Input value={form.faculty_id} disabled={!!editing} onChange={(e) => setForm({ ...form, faculty_id: e.target.value })} placeholder="T104" /></Field>
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Department">
              <Select value={form.department_id} disabled={!!lockDept} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">Select…</option>
                {db.departments.filter((d) => d.active).map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Subject (assigned)"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
            <Field label="Semester"><Select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>{[1, 2, 3, 4, 5, 6].map((s) => <option key={s}>{s}</option>)}</Select></Field>
            {!editing && <Field label="Login password"><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>}
            <div className="flex gap-2"><Btn onClick={save}>{editing ? "Save changes" : "Add faculty"}</Btn>{editing && <Btn variant="ghost" onClick={() => { setEditing(null); setForm({ ...blank, department_id: lockDept ?? "" }); }}>Cancel</Btn>}</div>
          </div>
        </Card>
        <Card title="Remove faculty">
          <div className="flex flex-col gap-3">
            <Field label="Faculty ID"><Input value={rm.id} onChange={(e) => setRm({ ...rm, id: e.target.value })} /></Field>
            <Field label="Department">
              <Select value={rm.dept} disabled={!!lockDept} onChange={(e) => setRm({ ...rm, dept: e.target.value })}>
                <option value="">Select…</option>
                {db.departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
              </Select>
            </Field>
            <Btn variant="danger" onClick={() => remove(rm.id, rm.dept)}>Remove</Btn>
          </div>
        </Card>
        <Flash msg={f.msg} />
      </div>
    </div>
  );
}

/* ---------- Timetable (FR-A4, FR-H2, FR-H6, FR-H8) ---------- */
export function TimetableManager({ lockDept }: { lockDept?: string }) {
  const db = useDB();
  const f = useFlash();
  const [dept, setDept] = useState(lockDept ?? db.departments[0]?.department_id ?? "");
  const teachers = db.faculty.filter((x) => x.active && x.department_id === dept);
  const empty = { faculty_id: "", day: "Mon", period: "1", room: ROOMS[0] ?? "R101", subject: "", semester: "1", class: "" };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [view, setView] = useState<string>("all");
  const entries = db.timetable.filter((t) => teachers.some((x) => x.faculty_id === t.faculty_id) && (view === "all" || t.faculty_id === view));

  const save = () => {
    if (!form.faculty_id || !form.subject.trim() || !form.class.trim()) return f.err("Teacher, subject and class are required");
    const e: Omit<TimetableEntry, "_id"> = { faculty_id: form.faculty_id, day: form.day, period: Number(form.period), room: form.room, subject: form.subject.trim(), semester: Number(form.semester), class: form.class.trim() };
    const c = findConflicts(db.timetable, e, editId ?? undefined);
    if (c.length) return f.err("Conflict: " + c.join("; "));
    if (editId) mutate((d) => { const t = d.timetable.find((x) => x._id === editId); if (t) Object.assign(t, e); }, `timetable edit-id ${editId}`);
    else mutate((d) => { d.timetable.push({ _id: oid(), ...e }); }, `timetable add ${e.faculty_id} ${e.day} P${e.period}`);
    f.ok(editId ? "Slot updated" : "Slot added"); setEditId(null); setForm(empty);
  };
  const pickTeacher = (id: string) => {
    const t = db.faculty.find((x) => x.faculty_id === id);
    setForm({ ...form, faculty_id: id, subject: t?.subject ?? "", semester: String(t?.semester ?? 1), class: t ? `${dname(db, t.department_id)}-S${t.semester}` : "" });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        {!lockDept && <Field label="Department"><Select value={dept} onChange={(e) => { setDept(e.target.value); setView("all"); }}>{db.departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}</Select></Field>}
        <Field label="Show"><Select value={view} onChange={(e) => setView(e.target.value)}><option value="all">All teachers</option>{teachers.map((t) => <option key={t.faculty_id} value={t.faculty_id}>{t.name}</option>)}</Select></Field>
        <Btn variant="soft" onClick={() => { if (window.confirm("Regenerate this department's timetable automatically? Existing slots will be replaced.")) { mutate((d) => { d.timetable = generateTimetable(d, dept); }, `timetable auto-generate ${dept}`); f.ok("Timetable generated without conflicts"); } }}><Wand2 className="h-4 w-4" /> Auto-generate</Btn>
      </div>
      <Card title="Weekly grid">
        <WeekGrid entries={entries} showTeacher />
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={editId ? "Edit slot" : "Add slot"}>
          <div className="flex flex-col gap-3">
            <Field label="Teacher"><Select value={form.faculty_id} onChange={(e) => pickTeacher(e.target.value)}><option value="">Select…</option>{teachers.map((t) => <option key={t.faculty_id} value={t.faculty_id}>{t.name} ({t.faculty_id})</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Day"><Select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>{DAYS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
              <Field label="Period"><Select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>{PERIODS.map((p) => <option key={p}>{p}</option>)}</Select></Field>
              <Field label="Room"><Select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>{ROOMS.map((r) => <option key={r}>{r}</option>)}</Select></Field>
              <Field label="Semester"><Select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>{[1, 2, 3, 4, 5, 6].map((s) => <option key={s}>{s}</option>)}</Select></Field>
            </div>
            <Field label="Subject"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
            <Field label="Class"><Input value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} placeholder="BCA-S3" /></Field>
            <div className="flex gap-2"><Btn onClick={save}>{editId ? "Save" : "Add slot"}</Btn>{editId && <Btn variant="ghost" onClick={() => { setEditId(null); setForm(empty); }}>Cancel</Btn>}</div>
            <Flash msg={f.msg} />
          </div>
        </Card>
        <div className="lg:col-span-2">
          <Card title="Slots">
            <Table head={["Day", "P", "Teacher", "Class", "Subject", "Room", ""]} rows={[...entries].sort((a, b) => DAYS.indexOf(a.day as never) - DAYS.indexOf(b.day as never) || a.period - b.period).map((t) => [
              t.day, t.period, fname(db, t.faculty_id), t.class, t.subject, t.room,
              <div className="flex gap-1">
                <Btn variant="ghost" onClick={() => { setEditId(t._id); setForm({ faculty_id: t.faculty_id, day: t.day, period: String(t.period), room: t.room, subject: t.subject, semester: String(t.semester), class: t.class }); }}><Pencil className="h-4 w-4" /></Btn>
                <Btn variant="ghost" onClick={() => { if (window.confirm("Delete this slot?")) mutate((d) => { d.timetable = d.timetable.filter((x) => x._id !== t._id); }, `timetable delete-id ${t._id}`); }}><Trash2 className="h-4 w-4" /></Btn>
              </div>,
            ])} />
          </Card>
        </div>
      </div>
    </div>
  );
}

export function WeekGrid({ entries, showTeacher }: { entries: TimetableEntry[]; showTeacher?: boolean }) {
  const db = useDB();
  return (
    <div className="overflow-x-auto">
      <table className="grid-table">
        <thead><tr><th>Day</th>{PERIODS.map((p) => <th key={p}>P{p}</th>)}</tr></thead>
        <tbody>
          {DAYS.map((d) => (
            <tr key={d}>
              <th>{d}</th>
              {PERIODS.map((p) => {
                const cell = entries.filter((e) => e.day === d && e.period === p);
                return (
                  <td key={p}>
                    {cell.map((e) => (
                      <div key={e._id} className="slot">
                        <div className="font-medium">{e.subject}</div>
                        <div className="text-xs text-muted-foreground">{e.class} · {e.room}{showTeacher ? ` · ${fname(db, e.faculty_id).split(" ").slice(-1)[0]}` : ""}</div>
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- HOD attendance (FR-H3) ---------- */
export function HodAttendance({ dept }: { dept: string }) {
  const db = useDB();
  const [date, setDate] = useState(today());
  const day = DAYS[(new Date(date).getDay() + 6) % 7] ?? "Mon";
  const teachers = db.faculty.filter((x) => x.active && x.department_id === dept);
  const status = (fid: string) => {
    const recs = db.attendance.filter((a) => a.faculty_id === fid && a.date === date);
    if (onLeave(db, fid, date)) return "leave";
    if (recs.some((r) => r.status === "present")) return "present";
    if (recs.some((r) => r.status === "absent")) return "absent";
    return "unmarked";
  };
  const mark = (fid: string, st: "present" | "absent") => {
    const slots = db.timetable.filter((t) => t.faculty_id === fid && t.day === day);
    mutate((d) => {
      d.attendance = d.attendance.filter((a) => !(a.faculty_id === fid && a.date === date));
      (slots.length ? slots : [{ _id: "general" }]).forEach((s) => d.attendance.push({ _id: oid(), faculty_id: fid, timetable_id: s._id, date, status: st }));
    }, `attendance ${fid} ${date} ${st}`);
  };
  const present = teachers.filter((t) => status(t.faculty_id) === "present");
  const absent = teachers.filter((t) => ["absent", "leave"].includes(status(t.faculty_id)));
  return (
    <Card title="Teacher attendance" action={<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />}>
      <p className="mb-3 text-sm text-muted-foreground">Present: {present.length} · Absent / on leave: {absent.length} · Unmarked: {teachers.length - present.length - absent.length}</p>
      <Table head={["Teacher", "Classes on " + day, "Status", "Record"]} rows={teachers.map((t) => {
        const st = status(t.faculty_id);
        return [t.name, db.timetable.filter((x) => x.faculty_id === t.faculty_id && x.day === day).length,
          <Badge tone={st === "present" ? "ok" : st === "unmarked" ? "neutral" : "bad"}>{st}</Badge>,
          <div className="flex gap-2"><Btn variant="soft" onClick={() => mark(t.faculty_id, "present")}>Present</Btn><Btn variant="ghost" onClick={() => mark(t.faculty_id, "absent")}>Absent</Btn></div>];
      })} />
    </Card>
  );
}

/* ---------- Leave (FR-H4) ---------- */
export function LeaveManager({ dept }: { dept: string }) {
  const db = useDB();
  const [subs, setSubs] = useState<Record<string, string>>({});
  const leaves = db.leaves.filter((l) => db.faculty.find((x) => x.faculty_id === l.faculty_id)?.department_id === dept);
  const teachers = db.faculty.filter((x) => x.active && x.department_id === dept);
  const decide = (id: string, status: "approved" | "rejected") =>
    mutate((d) => { const l = d.leaves.find((x) => x._id === id); if (l) { l.status = status; if (status === "approved") l.substitute_faculty_id = subs[id] || ""; } }, `leave ${status} ${id}`);
  return (
    <Card title="Leave requests">
      <Table head={["Teacher", "From", "To", "Reason", "Status", "Substitute", ""]} rows={leaves.map((l) => [
        fname(db, l.faculty_id), l.from, l.to, l.reason,
        <Badge tone={l.status === "approved" ? "ok" : l.status === "rejected" ? "bad" : "warn"}>{l.status}</Badge>,
        l.status === "pending"
          ? <Select value={subs[l._id] ?? ""} onChange={(e) => setSubs({ ...subs, [l._id]: e.target.value })}><option value="">None</option>{teachers.filter((t) => t.faculty_id !== l.faculty_id).map((t) => <option key={t.faculty_id} value={t.faculty_id}>{t.name}</option>)}</Select>
          : fname(db, l.substitute_faculty_id),
        l.status === "pending" ? <div className="flex gap-2"><Btn variant="soft" onClick={() => decide(l._id, "approved")}>Approve</Btn><Btn variant="ghost" onClick={() => decide(l._id, "rejected")}>Reject</Btn></div> : "",
      ])} />
    </Card>
  );
}

/* ---------- Notices (FR-H5) ---------- */
export function NoticeBoard({ dept, canPost, author }: { dept: string; canPost: boolean; author?: string | undefined }) {
  const db = useDB();
  const f = useFlash();
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const list = db.notices.filter((n) => n.department_id === dept).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {canPost && (
        <Card title="Post notice">
          <div className="flex flex-col gap-3">
            <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Timetable change / Meeting" /></Field>
            <Field label="Message"><textarea className="field min-h-28" value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
            <Btn onClick={() => { if (!title.trim() || !msg.trim()) return f.err("Title and message required"); mutate((d) => { d.notices.push({ _id: oid(), department_id: dept, title: title.trim(), message: msg.trim(), created_by: author ?? "-", date: today() }); }, `notice ${title.trim()}`); setTitle(""); setMsg(""); f.ok("Notice sent to department"); }}>Send notice</Btn>
            <Flash msg={f.msg} />
          </div>
        </Card>
      )}
      <div className={canPost ? "lg:col-span-2" : "lg:col-span-3"}>
        <Card title="Notices">
          <div className="flex flex-col gap-3">
            {list.length === 0 && <p className="text-sm text-muted-foreground">No notices yet.</p>}
            {list.map((n) => (
              <article key={n._id} className="notice">
                <div className="flex justify-between gap-2"><h4 className="font-medium">{n.title}</h4><span className="text-xs text-muted-foreground">{n.date}</span></div>
                <p className="mt-1 text-sm">{n.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">— {fname(db, n.created_by)}</p>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Audit log ---------- */
export function AuditLog() {
  const db = useDB();
  return (
    <Card title="Audit log">
      <Table head={["Time", "User", "Action"]} rows={db.audit.slice(0, 100).map((a) => [new Date(a.at).toLocaleString(), a.user, a.action])} empty="No changes recorded yet" />
    </Card>
  );
}