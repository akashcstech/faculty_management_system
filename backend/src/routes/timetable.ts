import { Router } from "express";
import db, { oid, checkConflicts, generateTimetable } from "../db.js";
import { requireAuth, requireRole, addAudit } from "../middleware.js";

const router = Router();

router.get("/", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM timetable").all());
});

router.post("/generate", requireAuth, requireRole("admin", "hod"), (req, res) => {
  const { department_id } = req.body as { department_id: string };
  if (!department_id) { res.status(400).json({ error: "department_id required" }); return; }

  const facultyList = db.prepare("SELECT * FROM faculty WHERE active = 1").all() as any[];
  const departments = db.prepare("SELECT * FROM departments").all() as any[];
  const existing = db.prepare("SELECT * FROM timetable").all() as any[];
  const newTimetable = generateTimetable(facultyList, departments, existing, department_id, 6);

  const deptFacultyIds = facultyList
    .filter((f) => f.department_id === department_id)
    .map((f) => f.faculty_id);

  const ins = db.prepare(
    "INSERT INTO timetable (_id, faculty_id, day, period, room, subject, semester, class) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  db.exec("BEGIN");
  try {
    for (const fid of deptFacultyIds) {
      db.prepare("DELETE FROM timetable WHERE faculty_id = ?").run(fid);
    }
    for (const t of newTimetable.filter((x: any) => deptFacultyIds.includes(x.faculty_id))) {
      ins.run(t._id, t.faculty_id, t.day, t.period, t.room, t.subject, t.semester, t.class);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  addAudit((req as any).user, `timetable auto-generate ${department_id}`);
  res.json(db.prepare("SELECT * FROM timetable").all());
});

router.post("/", requireAuth, requireRole("admin", "hod"), (req, res) => {
  const { faculty_id, day, period, room, subject, semester, class: cls } = req.body as any;
  if (!faculty_id || !day || !period || !room || !subject || !cls) {
    res.status(400).json({ error: "All fields required" }); return;
  }
  const all = db.prepare("SELECT * FROM timetable").all() as any[];
  const e = { faculty_id, day, period: Number(period), room, subject, semester: Number(semester), class: cls };
  const conflicts = checkConflicts(all, e);
  if (conflicts.length) { res.status(409).json({ error: conflicts.join("; ") }); return; }
  const _id = oid();
  db.prepare(
    "INSERT INTO timetable (_id, faculty_id, day, period, room, subject, semester, class) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(_id, faculty_id, day, Number(period), room, subject, Number(semester), cls);
  addAudit((req as any).user, `timetable add ${faculty_id} ${day} P${period}`);
  res.status(201).json({ _id, ...e });
});

router.put("/:id", requireAuth, requireRole("admin", "hod"), (req, res) => {
  const { id } = req.params;
  const { faculty_id, day, period, room, subject, semester, class: cls } = req.body as any;
  const existing = db.prepare("SELECT * FROM timetable WHERE _id = ?").get(id);
  if (!existing) { res.status(404).json({ error: "Slot not found" }); return; }
  const all = db.prepare("SELECT * FROM timetable").all() as any[];
  const e = { faculty_id, day, period: Number(period), room, subject, semester: Number(semester), class: cls };
  const conflicts = checkConflicts(all, e, id);
  if (conflicts.length) { res.status(409).json({ error: conflicts.join("; ") }); return; }
  db.prepare(
    "UPDATE timetable SET faculty_id=?, day=?, period=?, room=?, subject=?, semester=?, class=? WHERE _id=?"
  ).run(faculty_id, day, Number(period), room, subject, Number(semester), cls, id);
  addAudit((req as any).user, `timetable edit ${faculty_id} ${day} P${period}`);
  res.json({ _id: id, ...e });
});

router.delete("/:id", requireAuth, requireRole("admin", "hod"), (req, res) => {
  const t = db.prepare("SELECT * FROM timetable WHERE _id = ?").get(req.params.id) as any;
  if (!t) { res.status(404).json({ error: "Slot not found" }); return; }
  db.prepare("DELETE FROM timetable WHERE _id = ?").run(req.params.id);
  addAudit((req as any).user, `timetable delete ${t.faculty_id} ${t.day} P${t.period}`);
  res.json({ ok: true });
});

export default router;

