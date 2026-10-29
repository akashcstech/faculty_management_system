import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "./db.js";
import { oid } from "./db.js";

export const JWT_SECRET = process.env.JWT_SECRET ?? "fms-dev-secret-change-in-production";

export interface JwtPayload {
  role: "admin" | "teacher" | "hod";
  faculty_id?: string;
  iat?: number;
  exp?: number;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as JwtPayload;
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as JwtPayload;
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function addAudit(user: JwtPayload, action: string) {
  const who = user.faculty_id ?? "admin";
  db.prepare("INSERT INTO audit (_id, user, action, at) VALUES (?, ?, ?, ?)").run(
    oid(),
    `${who} (${user.role})`,
    action,
    new Date().toISOString()
  );
}

