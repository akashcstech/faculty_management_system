import { Router } from "express";
import db, { oid } from "../db.js";
import { requireAuth, requireRole, addAudit } from "../middleware.js";

const router = Router();

const mapLeave = (l: any) => ({
  _id: l._id,
  faculty_id: l.faculty_id,
  from: l.from_date,
  to: l.to_date,
  reason: l.reason,
  status: l.status,
  substitute_faculty_id: l.substitute_faculty_id,
});

router.get("/", requireAuth, (req, res) => {
  const user = (req as any).user;
  let rows: any[];
  if (user.role === "teacher") {
    rows = db.prepare("SELECT * FROM leaves WHERE faculty_id = ?").all(user.faculty_id) as any[];
  } else if (user.role === "hod") {
    const f = db.prepare("SELECT department_id FROM faculty WHERE faculty_id = ?").get(user.faculty_id) as any;
    rows = db.prepare(
      "SELECT l.* FROM leaves l JOIN faculty f ON f.faculty_id = l.faculty_id WHERE f.department_id = ?"
    ).all(f?.department_id) as any[];
  } else {
    rows = db.prepare("SELECT * FROM leaves").all() as any[];
  }
  res.json(rows.map(mapLeave));
});

router.post("/", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { from, to, reason } = req.body as { from: string; to: string; reason: string };
  if (!from || !to || !reason?.trim()) {
    res.status(400).json({ error: "from, to and reason are required" }); return;
  }
  if (to < from) { res.status(400).json({ error: "End date is before start date" }); return; }
  const faculty_id = user.faculty_id!;
  const _id = oid();
  db.prepare(
    "INSERT INTO leaves (_id, faculty_id, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?, 'pending')"
  ).run(_id, faculty_id, from, to, reason.trim());
  addAudit(user, `leave request ${faculty_id}`);
  res.status(201).json(mapLeave({ _id, faculty_id, from_date: from, to_date: to, reason: reason.trim(), status: "pending", substitute_faculty_id: null }));
});

router.patch("/:id", requireAuth, requireRole("hod", "admin"), (req, res) => {
  const { id } = req.params;
  const { status, substitute_faculty_id } = req.body as { status: "approved" | "rejected"; substitute_faculty_id?: string };
  const leave = db.prepare("SELECT * FROM leaves WHERE _id = ?").get(id);
  if (!leave) { res.status(404).json({ error: "Leave not found" }); return; }
  db.prepare("UPDATE leaves SET status = ?, substitute_faculty_id = ? WHERE _id = ?").run(status, substitute_faculty_id ?? null, id);
  addAudit((req as any).user, `leave ${status} ${id}`);
  const updated = db.prepare("SELECT * FROM leaves WHERE _id = ?").get(id) as any;
  res.json(mapLeave(updated));
});

export default router;

