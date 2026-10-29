import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Users, CalendarDays, ScrollText } from "lucide-react";
import { Shell, Tabs, Stat } from "@/components/kit";
import { Departments, FacultyManager, TimetableManager, AuditLog } from "@/components/modules";
import { useDB } from "@/lib/store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Faculty Management System" },
      { name: "description", content: "Manage departments, add or remove faculty and edit teacher timetables." },
      { property: "og:title", content: "Admin Panel — FMS" },
      { property: "og:description", content: "Departments, faculty and timetable management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type T = "departments" | "faculty" | "timetable" | "audit";

function Admin() {
  const [tab, setTab] = useState<T>("departments");
  return (
    <Shell role="admin">
      <AdminStats />
      <Tabs<T> value={tab} onChange={setTab} tabs={[{ id: "departments", label: "Departments" }, { id: "faculty", label: "Faculty" }, { id: "timetable", label: "Teacher timetables" }, { id: "audit", label: "Audit log" }]} />
      <div className="mt-6">
        {tab === "departments" && <Departments />}
        {tab === "faculty" && <FacultyManager mode="admin" />}
        {tab === "timetable" && <TimetableManager />}
        {tab === "audit" && <AuditLog />}
      </div>
    </Shell>
  );
}

function AdminStats() {
  const db = useDB();
  return (
    <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
      <Stat label="Departments" value={db.departments.filter((d) => d.active).length} icon={<Building2 />} />
      <Stat label="Faculty" value={db.faculty.filter((f) => f.active).length} icon={<Users />} />
      <Stat label="Timetable slots" value={db.timetable.length} icon={<CalendarDays />} />
      <Stat label="Logged changes" value={db.audit.length} icon={<ScrollText />} />
    </div>
  );
}