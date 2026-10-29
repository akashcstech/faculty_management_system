import { Router } from "express";
import jwt from "jsonwebtoken";
import db, { verifyPassword } from "../db.js";
import { JWT_SECRET } from "../middleware.js";

const router = Router();

router.post("/login", (req, res) => {
  const { role, id, password } = req.body as { role: string; id: string; password: string };

  if (!role || !id || !password) {
    res.status(400).json({ error: "ID and password are required" });
    return;
  }

  if (role === "admin") {
    if (id === "admin" && password === "admin123") {
      const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "30m" });
      res.json({ token });
      return;
    }
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }

  const faculty = db
    .prepare("SELECT * FROM faculty WHERE faculty_id = ? AND active = 1")
    .get(id.trim().toUpperCase()) as any;

  if (!faculty) { res.status(401).json({ error: "Invalid ID or password" }); return; }
  if (!verifyPassword(password, faculty.password_hash)) { res.status(401).json({ error: "Invalid ID or password" }); return; }
  if (role === "hod" && faculty.role !== "hod") { res.status(401).json({ error: "This ID is not a HOD account" }); return; }
  if (role === "teacher" && faculty.role === "hod") { res.status(401).json({ error: "Please login using the HOD tab" }); return; }

  const token = jwt.sign({ role, faculty_id: faculty.faculty_id }, JWT_SECRET, { expiresIn: "30m" });
  res.json({ token });
});

export default router;
