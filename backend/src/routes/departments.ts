import { Router } from "express";
import db, { oid } from "../db.js";
import { requireAuth, requireRole, addAudit } from "../middleware.js";

const router = Router();

router.get("/", requireAuth, (_req, res) => {
  const rows = (db.prepare("SELECT * FROM departments").all() as any[]).map((d) => ({
    ...d,
    active: d.active === 1,
  }));
  res.json(rows);
});

router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const { name } = req.body as { name: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const n = name.trim();
  const department_id = n.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const existing = db.prepare("SELECT 1 FROM departments WHERE department_id = ?").get(department_id);
  if (existing) { res.status(409).json({ error: `Department ${department_id} already exists` }); return; }
  const _id = oid();
  db.prepare("INSERT INTO departments (_id, department_id, name, active) VALUES (?, ?, ?, 1)").run(_id, department_id, n);
  addAudit((req as any).user, `department add ${department_id}`);
  res.status(201).json({ _id, department_id, name: n, active: true });
});

router.patch("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const { name, active } = req.body as { name?: string; active?: boolean };
  const dept = db.prepare("SELECT * FROM departments WHERE department_id = ?").get(id) as any;
  if (!dept) { res.status(404).json({ error: "Department not found" }); return; }
  const newName = name?.trim() ?? dept.name;
  const newActive = active !== undefined ? (active ? 1 : 0) : dept.active;
  db.prepare("UPDATE departments SET name = ?, active = ? WHERE department_id = ?").run(newName, newActive, id);
  if (name !== undefined) addAudit((req as any).user, `department rename ${id}`);
  if (active !== undefined) addAudit((req as any).user, `department toggle ${id}`);
  res.json({ ...dept, name: newName, active: newActive === 1 });
});

export default router;

