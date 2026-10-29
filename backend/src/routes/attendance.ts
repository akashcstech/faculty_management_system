import { Router } from "express";
import db, { oid, today } from "../db.js";
import { requireAuth, addAudit } from "../middleware.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  const user = (req as any).user;
  if (user.role === "teacher") {
    res.json(db.prepare("SELECT * FROM attendance WHERE faculty_id = ?").all(user.faculty_id));
  } else {
    res.json(db.prepare("SELECT * FROM attendance").all());
  }
});

router.post("/", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { timetable_id, date, status, faculty_id: bodyFacultyId } = req.body as any;
  const faculty_id: string = user.role === "teacher" ? user.faculty_id : bodyFacultyId;

  if (!timetable_id || !date || !status || !faculty_id) {
    res.status(400).json({ error: "timetable_id, date, status and faculty_id are required" }); return;
  }
  if (date > today()) {
    res.status(400).json({ error: "Cannot record attendance for a future date" }); return;
  }

  // Upsert: delete existing then insert
  db.prepare("DELETE FROM attendance WHERE timetable_id = ? AND date = ? AND faculty_id = ?").run(timetable_id, date, faculty_id);
  const _id = oid();
  db.prepare(
    "INSERT INTO attendance (_id, faculty_id, timetable_id, date, status) VALUES (?, ?, ?, ?, ?)"
  ).run(_id, faculty_id, timetable_id, date, status);
  addAudit(user, `attendance ${faculty_id} ${date} ${status}`);
  res.status(201).json({ _id, faculty_id, timetable_id, date, status });
});

export default router;

