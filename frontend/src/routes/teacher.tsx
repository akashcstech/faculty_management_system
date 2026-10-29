import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, Tabs, Card, Table, Badge, Btn, Field, Input, Flash, useFlash } from "@/components/kit";
import { WeekGrid, NoticeBoard } from "@/components/modules";
import { useDB, mutate, oid, today, todayDay, canCorrect, CORRECTION_WINDOW_DAYS, fname, DAYS } from "@/lib/store";

export const Route = createFileRoute("/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher Portal — Faculty Management System" },
      { name: "description", content: "View your class schedule, record attendance and request leave." },
      { property: "og:title", content: "Teacher Portal — FMS" },
      { property: "og:description", content: "Your schedule, attendance and leave in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Teacher,
});

type T = "today" | "week" | "attendance" | "leave" | "notices";

function Teacher() {
  const [tab, setTab] = useState<T>("today");
  return (
    <Shell role="teacher">
      <Tabs<T> value={tab} onChange={setTab} tabs={[{ id: "today", label: "Today" }, { id: "week", label: "Weekly schedule" }, { id: "attendance", label: "My attendance" }, { id: "leave", label: "Leave" }, { id: "notices", label: "Notices" }]} />
      <div className="mt-6"><Body tab={tab} /></div>
    </Shell>
  );
}

function Body({ tab }: { tab: T }) {
  const db = useDB();
  const me = db.faculty.find((f) => f.faculty_id === db.session?.faculty_id);
  const f = useFlash();
  const [date, setDate] = useState(today());
  const [leave, setLeave] = useState({ from: today(), to: today(), reason: "" });
  if (!me) return null;
  const mine = db.timetable.filter((t) => t.faculty_id === me.faculty_id);
  const day = DAYS[(new Date(date).getDay() + 6) % 7] ?? "Mon";

  const record = (timetable_id: string, status: "present" | "absent") => {
    if (!canCorrect(date)) return f.err(`Records can only be changed within ${CORRECTION_WINDOW_DAYS} day(s)`);
    if (date > today()) return f.err("Cannot record attendance for a future date");
    mutate((d) => {
      d.attendance = d.attendance.filter((a) => !(a.timetable_id === timetable_id && a.date === date && a.faculty_id === me.faculty_id));
      d.attendance.push({ _id: oid(), faculty_id: me.faculty_id, timetable_id, date, status });
    }, `attendance ${me.faculty_id} ${date} ${status}`);
    f.ok("Attendance saved");
  };

  if (tab === "today") {
    const slots = mine.filter((t) => t.day === todayDay()).sort((a, b) => a.period - b.period);
    return (
      <Card title={`Today · ${todayDay()} ${today()}`}>
        <Table head={["Period", "Class", "Subject", "Semester", "Room"]} rows={slots.map((s) => [`P${s.period}`, s.class, s.subject, s.semester, s.room])} empty="No classes today" />
      </Card>
    );
  }
  if (tab === "week") return <Card title="Weekly schedule"><WeekGrid entries={mine} /></Card>;
  if (tab === "attendance") {
    const slots = mine.filter((t) => t.day === day).sort((a, b) => a.period - b.period);
    const hist = db.attendance.filter((a) => a.faculty_id === me.faculty_id).sort((a, b) => b.date.localeCompare(a.date));
    return (
      <div className="flex flex-col gap-6">
        <Card title="Record attendance for classes attended" action={<Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />}>
          <Table head={["Period", "Class", "Subject", "Status", ""]} rows={slots.map((s) => {
            const rec = db.attendance.find((a) => a.timetable_id === s._id && a.date === date && a.faculty_id === me.faculty_id);
            return [`P${s.period}`, s.class, s.subject,
              rec ? <Badge tone={rec.status === "present" ? "ok" : "bad"}>{rec.status}</Badge> : <Badge>unmarked</Badge>,
              <div className="flex gap-2"><Btn variant="soft" onClick={() => record(s._id, "present")}>Attended</Btn><Btn variant="ghost" onClick={() => record(s._id, "absent")}>Missed</Btn></div>];
          })} empty={`No classes scheduled on ${day}`} />
          <p className="mt-2 text-xs text-muted-foreground">Records can be corrected within {CORRECTION_WINDOW_DAYS} day of the class.</p>
          <Flash msg={f.msg} />
        </Card>
        <Card title="History">
          <Table head={["Date", "Class", "Subject", "Status"]} rows={hist.map((a) => {
            const s = db.timetable.find((t) => t._id === a.timetable_id);
            return [a.date, s?.class ?? "-", s?.subject ?? "-", <Badge tone={a.status === "present" ? "ok" : "bad"}>{a.status}</Badge>];
          })} />
        </Card>
      </div>
    );
  }
  if (tab === "leave") {
    const mineL = db.leaves.filter((l) => l.faculty_id === me.faculty_id);
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Request leave">
          <div className="flex flex-col gap-3">
            <Field label="From"><Input type="date" value={leave.from} onChange={(e) => setLeave({ ...leave, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={leave.to} onChange={(e) => setLeave({ ...leave, to: e.target.value })} /></Field>
            <Field label="Reason"><Input value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} /></Field>
            <Btn onClick={() => {
              if (!leave.reason.trim()) return f.err("Reason is required");
              if (leave.to < leave.from) return f.err("End date is before start date");
              mutate((d) => { d.leaves.push({ _id: oid(), faculty_id: me.faculty_id, from: leave.from, to: leave.to, reason: leave.reason.trim(), status: "pending" }); }, `leave request ${me.faculty_id}`);
              setLeave({ from: today(), to: today(), reason: "" }); f.ok("Leave request sent to HOD");
            }}>Submit</Btn>
            <Flash msg={f.msg} />
          </div>
        </Card>
        <div className="lg:col-span-2">
          <Card title="My requests">
            <Table head={["From", "To", "Reason", "Status", "Substitute"]} rows={mineL.map((l) => [l.from, l.to, l.reason, <Badge tone={l.status === "approved" ? "ok" : l.status === "rejected" ? "bad" : "warn"}>{l.status}</Badge>, fname(db, l.substitute_faculty_id)])} />
          </Card>
        </div>
      </div>
    );
  }
  return <NoticeBoard dept={me.department_id} canPost={false} />;
}