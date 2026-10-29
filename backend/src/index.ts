import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import snapshotRouter from "./routes/snapshot.js";
import departmentsRouter from "./routes/departments.js";
import facultyRouter from "./routes/faculty.js";
import timetableRouter from "./routes/timetable.js";
import attendanceRouter from "./routes/attendance.js";
import leavesRouter from "./routes/leaves.js";
import noticesRouter from "./routes/notices.js";
import auditRouter from "./routes/audit.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(
  cors({
    origin: ["http://localhost:8080", "http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

// API Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/db", snapshotRouter);
app.use("/api/v1/departments", departmentsRouter);
app.use("/api/v1/faculty", facultyRouter);
app.use("/api/v1/timetable", timetableRouter);
app.use("/api/v1/attendance", attendanceRouter);
app.use("/api/v1/leaves", leavesRouter);
app.use("/api/v1/notices", noticesRouter);
app.use("/api/v1/audit", auditRouter);

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`✅ FMS Backend running on http://localhost:${PORT}`);
});

export default app;

