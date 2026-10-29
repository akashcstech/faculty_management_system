import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { GraduationCap, LogOut } from "lucide-react";
import { logout, useDB, useReady, touchSession, SESSION_TIMEOUT_MS, type Role, fname } from "@/lib/store";

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h3 className="font-display text-lg">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" }) {
  return <button {...p} className={`btn btn-${variant} ${className}`} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`field ${p.className ?? ""}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`field ${p.className ?? ""}`} />;

export function Badge({ tone = "neutral", children }: { tone?: "ok" | "warn" | "bad" | "neutral"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Table({ head, rows, empty = "No records" }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={head.length} className="text-center text-muted-foreground">{empty}</td></tr>
            : rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={`tab ${value === t.id ? "tab-active" : ""}`}>{t.label}</button>
      ))}
    </div>
  );
}

export function Flash({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>;
}
export function useFlash() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return { msg, ok: (text: string) => setMsg({ ok: true, text }), err: (text: string) => setMsg({ ok: false, text }) };
}

export function Stat({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="font-display text-3xl">{value}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

/** Guards a role page and provides the header. */
export function Shell({ role, children }: { role: Role; children: ReactNode }) {
  const db = useDB();
  const ready = useReady();
  const nav = useNavigate();
  const s = db.session;
  const allowed = s?.role === role;

  useEffect(() => {
    if (ready && !allowed) nav({ to: "/" });
  }, [ready, allowed, nav]);

  useEffect(() => {
    const onAct = () => touchSession();
    window.addEventListener("click", onAct);
    const iv = setInterval(() => {
      const cur = db.session;
      if (cur && Date.now() - cur.last > SESSION_TIMEOUT_MS) logout();
    }, 30000);
    return () => { window.removeEventListener("click", onAct); clearInterval(iv); };
  }, [db.session]);

  if (!ready || !allowed) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  const label = role === "admin" ? "Administrator" : `${fname(db, s.faculty_id)} · ${s.faculty_id}`;
  return (
    <div className="min-h-screen">
      <header className="topbar">
        <Link to="/" className="flex items-center gap-2 font-display text-xl"><GraduationCap className="h-6 w-6 text-primary" /> FMS</Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="role-pill">{role.toUpperCase()}</span>
          <span className="hidden sm:inline text-muted-foreground">{label}</span>
          <Btn variant="ghost" onClick={() => { logout(); nav({ to: "/" }); }}><LogOut className="h-4 w-4" /> Logout</Btn>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}