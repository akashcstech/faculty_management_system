import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Eye, EyeOff, User, Lock, ArrowRight, Check } from "lucide-react";
import { login, useDB, useReady, resetDB, type Role } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Faculty Management System — Sign in" },
      { name: "description", content: "Manage faculty, departments, timetables, attendance, leave and notices for BCA, B.Com and BSc." },
      { property: "og:title", content: "Faculty Management System" },
      { property: "og:description", content: "Admin, Teacher and HOD portals for college faculty management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

const ROLES: { id: Role; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "teacher", label: "Teacher" },
  { id: "hod", label: "HOD" },
];

const DEMO: Record<Role, [string, string]> = {
  admin: ["admin", "admin123"],
  teacher: ["T101", "teach123"],
  hod: ["H100", "hod123"],
};

const DEEP_GREEN = "#0e3e2b";
const BG_CREAM = "#faf7f2";

/* ── Left Hero Timetable Preview Card ── */
function TimetablePreview() {
  const days = ["Mon", "Tue", "Wed", "Thu"];
  const rows = [
    [
      { label: "Python", bg: "#dcfce7", color: "#166534" },
      { label: "Maths", bg: "#fef3c7", color: "#92400e" },
      { label: "DBMS", bg: "#e0e7ff", color: "#3730a3" },
      { label: "Lab", bg: "#ccfbf1", color: "#115e59" },
    ],
    [
      { label: "DBMS", bg: "#e0e7ff", color: "#3730a3" },
      { label: "Python", bg: "#dcfce7", color: "#166534" },
      { label: "Maths", bg: "#fef3c7", color: "#92400e" },
      { label: "Free", bg: "#f1f5f9", color: "#64748b" },
    ],
  ];

  return (
    <div style={{ position: "relative", width: 440, margin: "10px 0", paddingLeft: 64 }}>
      {/* Timetable Card + Floating "No clashes found" Badge Container */}
      <div style={{ position: "relative", width: 250 }}>
        {/* 1. Main Timetable Card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            padding: "14px 16px",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.25)",
            width: 250,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>Weekly timetable</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8" }}>P1</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5, marginBottom: 6 }}>
            {days.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>
                {d}
              </div>
            ))}
          </div>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5, marginBottom: 5 }}>
              {row.map((item, ci) => (
                <div
                  key={ci}
                  style={{
                    background: item.bg,
                    color: item.color,
                    borderRadius: 6,
                    padding: "5px 2px",
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 2. Floating "No clashes found" Badge (anchored to Timetable Card) */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 175,
            background: "#ffffff",
            borderRadius: 14,
            padding: "9px 14px",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.22)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: 175,
            border: "1px solid rgba(0, 0, 0, 0.04)",
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "#ecfdf5",
              border: "1.5px solid #a7f3d0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Check style={{ width: 13, height: 13, color: "#059669", strokeWidth: 3 }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#1e293b", lineHeight: 1.2 }}>No clashes found</p>
            <p style={{ margin: "2px 0 0 0", fontSize: 9.5, color: "#64748b", lineHeight: 1.1 }}>Rooms and teachers checked</p>
          </div>
        </div>
      </div>

      {/* 3. Floating "Teacher attendance" Badge (positioned below, shifted right) */}
      <div
        style={{
          position: "relative",
          marginTop: 14,
          marginLeft: 110,
          background: "#ffffff",
          borderRadius: 14,
          padding: "9px 12px",
          boxShadow: "0 14px 34px rgba(0, 0, 0, 0.22)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: 180,
          border: "1px solid rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ position: "relative", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="32" height="32" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="18" cy="18" r="14" fill="none" stroke="#d1fae5" strokeWidth="3" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="88" strokeDashoffset="24" strokeLinecap="round" />
          </svg>
          <User style={{ width: 13, height: 13, color: "#047857", position: "absolute" }} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: "#1e293b", lineHeight: 1.2 }}>Teacher attendance</p>
          <p style={{ margin: "2px 0 0 0", fontSize: 9.5, color: "#64748b", lineHeight: 1.1 }}>Marked period by period</p>
        </div>
      </div>
    </div>
  );
}

function Login() {
  const [role, setRole] = useState<Role>("admin");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const db = useDB();
  const ready = useReady();

  useEffect(() => {
    if (ready && db.session) nav({ to: `/${db.session.role}` as "/admin" });
  }, [ready, db.session, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !pw) {
      setErr("ID and password are required");
      return;
    }
    setLoading(true);
    setErr("");
    const r = await login(role, id, pw);
    setLoading(false);
    if (r) setErr(r);
    else nav({ to: `/${role}` as "/admin" });
  };

  const idLabel = role === "admin" ? "Username" : role === "hod" ? "HOD ID" : "Teacher ID";
  const idPlaceholder = "Enter your ID";

  return (
    <div style={{ display: "grid", minHeight: "100vh", gridTemplateColumns: "1fr" }} className="lg-two-col">
      {/* ══════════════════════════════════════════════════════
          LEFT HERO PANEL
      ══════════════════════════════════════════════════════ */}
      <aside
        className="login-hero"
        style={{
          background: "linear-gradient(160deg, #0e3d2a 0%, #08291b 100%)",
          display: "none",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 56px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle decorative curved background glows */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(52, 211, 153, 0.12) 0%, rgba(52, 211, 153, 0) 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 440,
            height: 440,
            borderRadius: "50%",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(52, 211, 153, 0.09) 0%, rgba(52, 211, 153, 0) 70%)",
            pointerEvents: "none",
          }}
        />

        {/* 1. Header Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#e59b24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(229, 155, 36, 0.35)",
            }}
          >
            <GraduationCap style={{ width: 22, height: 22, color: "#ffffff" }} />
          </div>
          <span
            className="font-display"
            style={{ fontSize: 22, color: "#ffffff", fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            FMS
          </span>
        </div>

        {/* 2. Middle Content (Title + Preview Cards) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26, margin: "auto 0", position: "relative", zIndex: 1 }}>
          <div>
            <h1
              className="font-display"
              style={{
                fontSize: "2.75rem",
                lineHeight: 1.15,
                color: "#ffffff",
                margin: 0,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              One register for every<br />
              faculty, class and<br />
              period.
            </h1>
            <p
              style={{
                marginTop: 16,
                maxWidth: 380,
                fontSize: 14,
                lineHeight: 1.55,
                color: "rgba(255, 255, 255, 0.72)",
              }}
            >
              Departments, clash-free timetables, teacher attendance, leave and notices, together for BCA, BCom and BSc.
            </p>
          </div>

          <TimetablePreview />
        </div>

        {/* 3. Bottom Role Tags */}
        <div style={{ display: "flex", gap: 10, position: "relative", zIndex: 1 }}>
          {["Admin", "Teacher", "HOD"].map((r) => (
            <span
              key={r}
              style={{
                border: "1px solid rgba(255, 255, 255, 0.22)",
                borderRadius: 9999,
                padding: "5px 16px",
                fontSize: 12,
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.75)",
                letterSpacing: "0.01em",
              }}
            >
              {r}
            </span>
          ))}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════
          RIGHT LOGIN PANEL
      ══════════════════════════════════════════════════════ */}
      <main
        style={{
          background: BG_CREAM,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          minHeight: "100vh",
        }}
      >
        <div style={{ width: "100%", maxWidth: 430 }}>
          {/* Main Card */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 24,
              padding: "36px 34px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)",
              border: "1px solid #f0ede6",
            }}
          >
            <h2
              className="font-display"
              style={{ fontSize: 29, color: "#111827", margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}
            >
              Welcome back
            </h2>
            <p style={{ marginTop: 6, marginBottom: 24, fontSize: 13.5, color: "#6b7280", lineHeight: 1.4 }}>
              Choose your role, then sign in to your faculty workspace.
            </p>

            {/* Segmented Role Pills Track */}
            <div
              style={{
                display: "flex",
                background: "#f0ece4",
                borderRadius: 14,
                padding: 4,
                marginBottom: 24,
                gap: 3,
              }}
            >
              {ROLES.map((r) => {
                const active = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setRole(r.id);
                      setErr("");
                    }}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      padding: "8px 0",
                      fontSize: 13.5,
                      fontWeight: active ? 600 : 500,
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      background: active ? DEEP_GREEN : "transparent",
                      color: active ? "#ffffff" : "#6b7280",
                      boxShadow: active ? "0 2px 6px rgba(14, 62, 43, 0.25)" : "none",
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Username Field */}
              <div>
                <label style={{ display: "block", marginBottom: 7, fontSize: 13.5, fontWeight: 500, color: "#374151" }}>
                  {idLabel}
                </label>
                <div style={{ position: "relative" }}>
                  <User
                    style={{
                      position: "absolute",
                      left: 13,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 16,
                      height: 16,
                      color: "#9ca3af",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder={idPlaceholder}
                    autoComplete="username"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "11px 14px 11px 40px",
                      border: "1px solid #e5e0d8",
                      borderRadius: 10,
                      background: "#ffffff",
                      fontSize: 14,
                      color: "#111827",
                      outline: "none",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = DEEP_GREEN;
                      e.currentTarget.style.boxShadow = `0 0 0 3px rgba(14, 62, 43, 0.15)`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e5e0d8";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label style={{ display: "block", marginBottom: 7, fontSize: 13.5, fontWeight: 500, color: "#374151" }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <Lock
                    style={{
                      position: "absolute",
                      left: 13,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 16,
                      height: 16,
                      color: "#9ca3af",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type={showPw ? "text" : "password"}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "11px 42px 11px 40px",
                      border: "1px solid #e5e0d8",
                      borderRadius: 10,
                      background: "#ffffff",
                      fontSize: 14,
                      color: "#111827",
                      outline: "none",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = DEEP_GREEN;
                      e.currentTarget.style.boxShadow = `0 0 0 3px rgba(14, 62, 43, 0.15)`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e5e0d8";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9ca3af",
                      display: "flex",
                      padding: 0,
                    }}
                  >
                    {showPw ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                  </button>
                </div>
              </div>

              {/* Remember me + Forgot password */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: -2 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4b5563", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    style={{
                      width: 15,
                      height: 15,
                      accentColor: DEEP_GREEN,
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    color: DEEP_GREEN,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {/* Error message */}
              {err && (
                <p style={{ margin: "-4px 0 0 0", fontSize: 13, fontWeight: 500, color: "#dc2626" }}>
                  {err}
                </p>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: 10,
                  background: DEEP_GREEN,
                  color: "#ffffff",
                  fontSize: 15,
                  fontWeight: 600,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  boxShadow: "0 4px 12px rgba(14, 62, 43, 0.25)",
                  transition: "filter 0.15s ease",
                  marginTop: 4,
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.filter = "brightness(1.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = "none";
                }}
              >
                {loading ? "Signing in…" : (
                  <>
                    Sign in <ArrowRight style={{ width: 16, height: 16 }} />
                  </>
                )}
              </button>

              {/* Footer Utility Links */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setId(DEMO[role][0]);
                    setPw(DEMO[role][1]);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: DEEP_GREEN,
                    fontWeight: 600,
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Fill demo {role} login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Reset all data to the sample data?")) resetDB();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: DEEP_GREEN,
                    fontWeight: 600,
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Reset sample data
                </button>
              </div>
            </form>
          </div>

          {/* Under-card text */}
          <p style={{ marginTop: 22, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
            Faculty Management System · BCA · BCom · BSc
          </p>
        </div>
      </main>
    </div>
  );
}
