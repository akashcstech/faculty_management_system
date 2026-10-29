import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware.js";

const router = Router();

// Returns the full DB snapshot — same shape as the frontend DB interface
router.get("/", requireAuth, (req, res) => {
  const user = (req as any).user;

  const departments = (db.prepare("SELECT * FROM departments").all() as any[]).map((d) => ({
    ...d,
    active: d.active === 1,
  }));

  const faculty = (
    db.prepare("SELECT _id, faculty_id, name, department_id, subject, semester, role, active FROM faculty").all() as any[]
  ).map((f) => ({ ...f, active: f.active === 1 }));

  const timetable = db.prepare("SELECT * FROM timetable").all();

  const attendance = db.prepare("SELECT * FROM attendance").all();

  const leaves = (
    db.prepare("SELECT _id, faculty_id, from_date, to_date, reason, status, substitute_faculty_id FROM leaves").all() as any[]
  ).map((l) => ({
    _id: l._id,
    faculty_id: l.faculty_id,
    from: l.from_date,
    to: l.to_date,
    reason: l.reason,
    status: l.status,
    substitute_faculty_id: l.substitute_faculty_id,
  }));

  const notices = db.prepare("SELECT * FROM notices ORDER BY date DESC").all();

  const audit = db.prepare("SELECT * FROM audit ORDER BY at DESC LIMIT 200").all();

  res.json({
    departments,
    faculty,
    timetable,
    attendance,
    leaves,
    notices,
    audit,
    session: {
      role: user.role,
      faculty_id: user.faculty_id,
      last: Date.now(),
    },
  });
});

export default router;

