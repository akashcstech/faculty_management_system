import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, CalendarCheck, Coffee, UserX, Inbox, RefreshCw } from "lucide-react";
import { Shell, Tabs, Stat, Card, Table } from "@/components/kit";
import { FacultyManager, TimetableManager, HodAttendance, LeaveManager, NoticeBoard } from "@/components/modules";
import { useDB, today, todayDay, onLeave, dname, fname, findConflicts } from "@/lib/store";

export const Route = createFileRoute("/hod")({
  head: () => ({
    meta: [
      { title: "HOD Dashboard — Faculty Management System" },
      { name: "description", content: "Manage teachers, timetables, attendance, leave and notices for your department." },
      { property: "og:title", content: "HOD Dashboard — FMS" },
      { property: "og:description", content: "Department overview with conflict detection and leave approvals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Hod,
});

type T = "dashboard" | "teachers" | "timetable" | "attendance" | "leave" | "notices";

function Hod() {
  const [tab, setTab] = useState<T>("dashboard");
  const db = useDB();
  const me = db.faculty.find((f) => f.faculty_id === db.session?.faculty_id);
  const dept = me?.department_id ?? "";
  return (
    <Shell role="hod">
      <h1 className="mb-6 font-display text-3xl">{dname(db, dept)} department</h1>
      <Tabs<T> value={tab} onChange={setTab} tabs={[{ id: "dashboard", label: "Dashboard" }, { id: "teachers", label: "Teachers" }, { id: "timetable", label: "Timetable" }, { id: "attendance", label: "Attendance" }, { id: "leave", label: "Leave" }, { id: "notices", label: "Notices" }]} />
      <div className="mt-6">
        {tab === "dashboard" && <Dashboard dept={dept} />}
        {tab === "teachers" && <FacultyManager mode="hod" lockDept={dept} />}
        {tab === "timetable" && <TimetableManager lockDept={dept} />}
        {tab === "attendance" && <HodAttendance dept={dept} />}
        {tab === "leave" && <LeaveManager dept={dept} />}
        {tab === "notices" && <NoticeBoard dept={dept} canPost author={me?.faculty_id} />}
      </div>
    </Shell>
  );
}

function Dashboard({ dept }: { dept: string }) {
  const db = useDB();
  const teachers = db.faculty.filter((f) => f.active && f.department_id === dept);
  const ids = new Set(teachers.map((t) => t.faculty_id));
  const todays = db.timetable.filter((t) => ids.has(t.faculty_id) && t.day === todayDay());
  const busy = new Set(todays.map((t) => t.faculty_id));
  const absent = teachers.filter((t) => onLeave(db, t.faculty_id, today()) || db.attendance.some((a) => a.faculty_id === t.faculty_id && a.date === today() && a.status === "absent"));
  const pending = db.leaves.filter((l) => l.status === "pending" && ids.has(l.faculty_id)).length;
  const changes = db.audit.filter((a) => a.action.startsWith("timetable") && a.at.slice(0, 10) === today()).length;
  const deptSlots = db.timetable.filter((t) => ids.has(t.faculty_id));
  const conflicts = deptSlots.flatMap((s) => findConflicts(deptSlots, s, s._id));
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Total teachers" value={teachers.length} icon={<Users />} />
        <Stat label="Today's classes" value={todays.length} icon={<CalendarCheck />} />
        <Stat label="Free teachers" value={teachers.filter((t) => !busy.has(t.faculty_id)).length} icon={<Coffee />} />
        <Stat label="Absent teachers" value={absent.length} icon={<UserX />} />
        <Stat label="Pending leave requests" value={pending} icon={<Inbox />} />
        <Stat label="Timetable changes today" value={changes} icon={<RefreshCw />} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Today's classes · ${todayDay()}`}>
          <Table head={["P", "Teacher", "Class", "Room"]} rows={[...todays].sort((a, b) => a.period - b.period).map((t) => [t.period, fname(db, t.faculty_id), t.class, t.room])} empty="No classes today" />
        </Card>
        <Card title="Conflict check">
          {conflicts.length === 0 ? <p className="text-sm text-success">No teacher, class or room clashes in this department.</p>
            : <ul className="list-disc pl-5 text-sm text-destructive">{[...new Set(conflicts)].map((c) => <li key={c}>{c}</li>)}</ul>}
        </Card>
      </div>
    </div>
  );
}