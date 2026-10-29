import { Router } from "express";
import db, { oid, today } from "../db.js";
import { requireAuth, requireRole, addAudit } from "../middleware.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  const user = (req as any).user;
  let rows: any[];
  if (user.role === "admin") {
    rows = db.prepare("SELECT * FROM notices ORDER BY date DESC").all() as any[];
  } else {
    const f = db.prepare("SELECT department_id FROM faculty WHERE faculty_id = ?").get(user.faculty_id) as any;
    rows = db.prepare("SELECT * FROM notices WHERE department_id = ? ORDER BY date DESC").all(f?.department_id) as any[];
  }
  res.json(rows);
});

router.post("/", requireAuth, requireRole("hod"), (req, res) => {
  const user = (req as any).user;
  const { title, message, department_id } = req.body as { title: string; message: string; department_id?: string };
  if (!title?.trim() || !message?.trim()) {
    res.status(400).json({ error: "title and message are required" }); return;
  }
  const dept = department_id ?? (db.prepare("SELECT department_id FROM faculty WHERE faculty_id = ?").get(user.faculty_id) as any)?.department_id;
  const _id = oid();
  const d = today();
  db.prepare(
    "INSERT INTO notices (_id, department_id, title, message, created_by, date) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(_id, dept, title.trim(), message.trim(), user.faculty_id, d);
  addAudit(user, `notice ${title.trim()}`);
  res.status(201).json({ _id, department_id: dept, title: title.trim(), message: message.trim(), created_by: user.faculty_id, date: d });
});

export default router;

