import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../middleware.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), (_req, res) => {
  res.json(db.prepare("SELECT * FROM audit ORDER BY at DESC LIMIT 500").all());
});

export default router;

