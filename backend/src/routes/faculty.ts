import { Router } from "express";
import db, { oid, hashPassword } from "../db.js";
import { requireAuth, requireRole, addAudit } from "../middleware.js";

const router = Router();

router.get("/", requireAuth, (_req, res) => {
  const rows = (
    db.prepare("SELECT _id, faculty_id, name, department_id, subject, semester, role, active FROM faculty").all() as any[]
  ).map((f) => ({ ...f, active: f.active === 1 }));
  res.json(rows);
});

router.post("/", requireAuth, requireRole("admin", "hod"), (req, res) => {
  const { faculty_id, name, department_id, subject, semester, role, password } = req.body as any;
  const id = faculty_id?.trim().toUpperCase();
  if (!id || !name?.trim() || !department_id || !subject?.trim() || !semester) {
    res.status(400).json({ error: "All fields are required" }); return;
  }
  const existing = db.prepare("SELECT 1 FROM faculty WHERE faculty_id = ?").get(id);
  if (existing) { res.status(409).json({ error: `Faculty ID ${id} already exists` }); return; }
  const _id = oid();
  const password_hash = hashPassword(password || "teach123");
  db.prepare(
    "INSERT INTO faculty (_id, faculty_id, name, department_id, subject, semester, role, password_hash, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"
  ).run(_id, id, name.trim(), department_id, subject.trim(), Number(semester), role ?? "teacher", password_hash);
  addAudit((req as any).user, `faculty add ${id}`);
  res.status(201).json({ _id, faculty_id: id, name: name.trim(), department_id, subject: subject.trim(), semester: Number(semester), role: role ?? "teacher", active: true });
});

router.patch("/:id", requireAuth, requireRole("admin", "hod"), (req, res) => {
  const { id } = req.params;
  const { name, department_id, subject, semester, active } = req.body as any;
  const f = db.prepare("SELECT * FROM faculty WHERE faculty_id = ?").get(id) as any;
  if (!f) { res.status(404).json({ error: "Faculty not found" }); return; }
  db.prepare("UPDATE faculty SET name = ?, department_id = ?, subject = ?, semester = ?, active = ? WHERE faculty_id = ?").run(
    name?.trim() ?? f.name,
    department_id ?? f.department_id,
    subject?.trim() ?? f.subject,
    semester ?? f.semester,
    active !== undefined ? (active ? 1 : 0) : f.active,
    id
  );
  addAudit((req as any).user, active === false ? `faculty remove ${id}` : `faculty edit ${id}`);
  const updated = db.prepare("SELECT _id, faculty_id, name, department_id, subject, semester, role, active FROM faculty WHERE faculty_id = ?").get(id) as any;
  res.json({ ...updated, active: updated.active === 1 });
});

export default router;

