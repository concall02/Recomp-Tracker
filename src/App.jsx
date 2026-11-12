import { useState, useEffect, useMemo } from "react";

// ═════════════════════════════════════════════════════════════════════════════
// Storage
// Works in two places:
//   • As a Claude artifact  → uses window.storage (and localStorage if allowed)
//   • As a normal web app   → uses localStorage
// Everything lives under one key so a save is a single atomic write.
// ═════════════════════════════════════════════════════════════════════════════
const STORE_KEY = "recomp:v2";

async function storeGet(key) {
  if (typeof window !== "undefined" && window.storage?.get) {
    try {
      const r = await window.storage.get(key);
      if (r?.value) return JSON.parse(r.value);
    } catch { /* missing key or storage unavailable */ }
  }
  try {
    const v = window.localStorage.getItem(key);
    if (v) return JSON.parse(v);
  } catch { /* localStorage blocked */ }
  return null;
}

async function storeSet(key, value) {
  const json = JSON.stringify(value);
  let ok = false;
  if (window.storage?.set) {
    try { await window.storage.set(key, json); ok = true; } catch { /* ignore */ }
  }
  try { window.localStorage.setItem(key, json); ok = true; } catch { /* ignore */ }
  return ok;
}

// v1 of this app stored one array per exercise under "pl:<name>"
function toKey(name) {
  return "pl:" + name.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

// ═════════════════════════════════════════════════════════════════════════════
// Program
// ═════════════════════════════════════════════════════════════════════════════
const program = [
  {
    day: "Day 1", label: "Upper A", focus: "Horizontal Push · Triceps",
    color: "#C8A96E", tag: "MON",
    exercises: [
      { name: "Barbell Bench Press",       sets: 4, reps: "6–8",       rest: "3 min", category: "compound",  note: "Lead compound — control the descent" },
      { name: "Incline DB Press",          sets: 3, reps: "10–12",     rest: "90s",   category: "compound",  note: "Upper chest emphasis" },
      { name: "Cable Chest Fly",           sets: 3, reps: "12–15",     rest: "60s",   category: "isolation", note: "Stretch-focused, slow eccentric" },
      { name: "Seated DB Overhead Press",  sets: 3, reps: "10–12",     rest: "90s",   category: "compound",  note: "" },
      { name: "Lateral Raise",             sets: 4, reps: "15–20",     rest: "30s",   category: "isolation", superset: true, note: "Superset ↓" },
      { name: "Face Pull",                 sets: 4, reps: "15–20",     rest: "60s",   category: "isolation", superset: true, note: "Superset with above — shoulder health" },
      { name: "Overhead Tricep Extension", sets: 3, reps: "12–15",     rest: "60s",   category: "isolation", note: "Long head emphasis" },
      { name: "Cable Pushdown",            sets: 3, reps: "12–15",     rest: "45s",   category: "isolation", note: "Squeeze at lockout" },
    ],
  },
  {
    day: "Day 2", label: "Lower A", focus: "Quads · Glutes",
    color: "#9B7FD4", tag: "TUE",
    exercises: [
      { name: "Barbell Back Squat",    sets: 4, reps: "6–8",       rest: "3 min", category: "compound",  note: "Depth matters — break parallel" },
      { name: "Barbell Hip Thrust",    sets: 4, reps: "10–12",     rest: "90s",   category: "compound",  note: "Full hip extension, 1s squeeze at top" },
      { name: "Bulgarian Split Squat", sets: 3, reps: "10–12 ea.", rest: "90s",   category: "compound",  note: "Torso upright for quad bias" },
      { name: "Abductor Machine",      sets: 3, reps: "15–20",     rest: "60s",   category: "glute",     note: "Hip width & stability" },
      { name: "Leg Extension",         sets: 3, reps: "12–15",     rest: "60s",   category: "isolation", note: "Controlled, peak contraction" },
      { name: "Seated Calf Raise",     sets: 4, reps: "15–20",     rest: "45s",   category: "isolation", note: "Pause at full stretch" },
    ],
  },
  {
    day: "Day 3", label: "Upper B", focus: "Vertical Pull · Biceps",
    color: "#5B9E7A", tag: "THU",
    exercises: [
      { name: "Weighted Pull-Up",                sets: 4, reps: "6–8",   rest: "3 min", category: "compound",  note: "Add load if bodyweight is easy" },
      { name: "Barbell Bent-Over Row",           sets: 3, reps: "8–10",  rest: "2 min", category: "compound",  note: "Chest to bar, hard brace" },
      { name: "Seated Cable Row (Neutral Grip)", sets: 3, reps: "10–12", rest: "90s",   category: "compound",  note: "Elbows tight, full stretch at front" },
      { name: "Face Pull",                       sets: 3, reps: "15–20", rest: "45s",   category: "isolation", note: "External rotation at peak" },
      { name: "Incline DB Curl",                 sets: 3, reps: "10–12", rest: "60s",   category: "arms",      superset: true, note: "Superset ↓ — full bicep stretch" },
      { name: "Hammer Curl",                     sets: 3, reps: "12–15", rest: "60s",   category: "arms",      superset: true, note: "Superset with above — brachialis" },
      { name: "Cable Curl",                      sets: 3, reps: "15",    rest: "45s",   category: "arms",      note: "Constant tension — slow eccentric" },
    ],
  },
  {
    day: "Day 4", label: "Lower B", focus: "Posterior Chain · Hip Stability",
    color: "#D4716B", tag: "FRI",
    exercises: [
      { name: "Romanian Deadlift",      sets: 4, reps: "8–10",         rest: "3 min", category: "compound",   note: "Hip hinge — hamstring stretch is the goal" },
      { name: "Sumo Romanian Deadlift", sets: 3, reps: "10–12",        rest: "90s",   category: "compound",   note: "Wider stance hits glutes + inner hamstring" },
      { name: "Seated Leg Curl",        sets: 4, reps: "10–12",        rest: "90s",   category: "isolation",  note: "3-second eccentric — no momentum" },
      { name: "Single-Leg Press",       sets: 3, reps: "12 ea.",       rest: "90s",   category: "compound",   note: "Hip stability demand — keep pelvis neutral" },
      { name: "Copenhagen Plank",       sets: 3, reps: "20–30s ea.",   rest: "45s",   category: "stabilizer", superset: true, note: "Superset ↓ — adductor & core" },
      { name: "Lateral Band Walk",      sets: 3, reps: "15 steps ea.", rest: "45s",   category: "stabilizer", superset: true, note: "Superset with above — glute med" },
      { name: "Standing Calf Raise",    sets: 4, reps: "12–15",        rest: "45s",   category: "isolation",  note: "Full ROM, pause at bottom" },
    ],
  },
];

const categoryColors = {
  compound:   "#C8A96E14",
  isolation:  "transparent",
  glute:      "#9B7FD414",
  arms:       "#5B9E7A14",
  stabilizer: "#D4716B14",
};

// ═════════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════════
const mono = { fontFamily: "'Courier New', monospace" };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
const byNewest = (a, b) => (b.startedAt || "").localeCompare(a.startedAt || "");

const parseRest = s => {
  const m = String(s).match(/(\d+)\s*(min|s)/);
  if (!m) return 60;
  return m[2] === "min" ? Number(m[1]) * 60 : Number(m[1]);
};
const isTimed = reps => /\d\s*s\b/.test(reps);         // "20–30s ea." → seconds
const topOfRange = reps => {
  const n = String(reps).match(/\d+/g);
  return n ? Number(n[n.length - 1]) : null;
};

// Score used for PRs: estimated 1RM (Epley) when weighted, plain reps for bodyweight.
const setScore = s => {
  if (s.reps == null) return 0;
  return s.weight ? s.weight * (1 + s.reps / 30) : s.reps;
};
const fmtSet = (s, timed) =>
  `${s.weight ? s.weight : "BW"}×${s.reps ?? "—"}${timed ? "s" : ""}`;
const volume = sets => sets.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0);

const fmtDate = iso =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtDuration = (a, b) => {
  if (!a || !b) return null;
  const m = Math.round((new Date(b) - new Date(a)) / 60000);
  return m > 0 && m < 600 ? `${m} min` : null;
};

// Every saved session that includes this exercise, newest first.
function historyFor(sessions, name) {
  return sessions
    .filter(s => s.entries?.[name]?.length)
    .map(s => ({ id: s.id, date: s.startedAt, day: s.day, sets: s.entries[name] }));
}
function bestScore(sessions, name) {
  let best = 0;
  for (const s of sessions) for (const set of s.entries?.[name] || []) best = Math.max(best, setScore(set));
  return best;
}

// Convert v1 per-exercise logs into v2 sessions (grouped by day + date).
function legacyToSessions(logsByKey) {
  const keyToEx = {};
  program.forEach((d, di) =>
    d.exercises.forEach(ex => {
      const k = toKey(ex.name);
      if (!keyToEx[k]) keyToEx[k] = { name: ex.name, day: di };
    })
  );
  const now = new Date();
  const groups = {};
  for (const [k, entries] of Object.entries(logsByKey || {})) {
    const info = keyToEx[k];
    if (!info || !Array.isArray(entries)) continue;
    for (const e of entries) {
      let d = new Date(`${e.date} ${now.getFullYear()}`);
      if (isNaN(d)) continue;
      if (d > now) d.setFullYear(d.getFullYear() - 1);
      const gk = `${info.day}|${d.toDateString()}`;
      if (!groups[gk]) {
        groups[gk] = {
          id: "legacy:" + gk, day: info.day, legacy: true,
          startedAt: d.toISOString(), finishedAt: d.toISOString(), entries: {},
        };
      }
      (groups[gk].entries[info.name] ||= []).push({ weight: e.weight ?? null, reps: e.reps ?? null });
    }
  }
  // v1 stored newest-first; put sets back in the order they were done
  const out = Object.values(groups);
  out.forEach(s => Object.values(s.entries).forEach(arr => arr.reverse()));
  return out.sort(byNewest);
}

function mergeSessions(existing, incoming) {
  const map = new Map(existing.map(s => [s.id, s]));
  for (const s of incoming) map.set(s.id, s);
  return [...map.values()].sort(byNewest);
}

function blankWorkout(dayIndex) {
  return {
    id: uid(),
    day: dayIndex,
    startedAt: new Date().toISOString(),
    entries: Object.fromEntries(
      program[dayIndex].exercises.map(ex => [
        ex.name,
        Array.from({ length: ex.sets }, () => ({ weight: "", reps: "", done: false })),
      ])
    ),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Small UI pieces
// ═════════════════════════════════════════════════════════════════════════════
const labelStyle = {
  fontSize: 9, ...mono, letterSpacing: 3, color: "#555", textTransform: "uppercase",
};

function Btn({ children, onClick, color = "#3A3A3A", solid = false, small = false, disabled = false, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? "4px 10px" : "8px 16px",
        background: solid ? color : "transparent",
        border: `1px solid ${color}`, borderRadius: 4,
        color: solid ? "#111" : color,
        fontSize: small ? 10 : 11, ...mono, letterSpacing: 1.5, textTransform: "uppercase",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
        transition: "all 0.15s", ...style,
      }}
    >
      {children}
    </button>
  );
}

// Two-tap confirm (window.confirm is blocked in some sandboxes)
function ConfirmBtn({ label, confirmLabel, onConfirm, color = "#D4716B", small = true }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Btn small={small} color={color} solid={armed}
      onClick={e => { e.stopPropagation(); armed ? onConfirm() : setArmed(true); }}>
      {armed ? confirmLabel : label}
    </Btn>
  );
}

// Number input that edits a stored number without fighting the user's typing.
function NumberField({ value, onCommit, placeholder, width = 64 }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => { setText(value == null ? "" : String(value)); }, [value]);
  return (
    <input
      type="number" inputMode="decimal" value={text} placeholder={placeholder}
      onChange={e => setText(e.target.value)}
      onBlur={() => onCommit(num(text))}
      onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
      style={{ ...inputStyle, width, padding: "4px 8px", fontSize: 14 }}
    />
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "8px 8px",
  background: "#161616", border: "1px solid #2A2A2A", borderRadius: 4,
  color: "#E2D9C8", fontSize: 16, ...mono, outline: "none", textAlign: "center",
};

// ═════════════════════════════════════════════════════════════════════════════
// Workout mode: one card per exercise with a row per set
// ═════════════════════════════════════════════════════════════════════════════
function ExerciseLogger({ ex, color, sets, prev, best, onChange, onAdd, onRemove, onCheck }) {
  const timed = isTimed(ex.reps);
  const top = topOfRange(ex.reps);
  const prevSets = prev?.sets || [];
  const doneCount = sets.filter(s => s.done).length;

  // Progression cue: last time every working set hit the top of the range
  const readyToProgress =
    !timed && top && prevSets.length >= ex.sets &&
    prevSets.every(s => (s.reps || 0) >= top);

  return (
    <div style={{ borderBottom: "1px solid #1C1C1C", background: categoryColors[ex.category] || "transparent" }}>
      <div style={{ padding: "14px 12px 8px", display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, color: ex.superset ? color : "#E2D9C8", lineHeight: 1.3 }}>{ex.name}</div>
          <div style={{ fontSize: 10, color: "#666", ...mono, marginTop: 2 }}>
            {ex.sets} × {ex.reps} · {ex.rest} rest{ex.note ? ` · ${ex.note}` : ""}
          </div>
          {readyToProgress && (
            <div style={{ fontSize: 10, color: "#7BC47B", ...mono, marginTop: 4 }}>
              ↑ Hit {top} on every set last time — add weight
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, ...mono, color: doneCount >= ex.sets ? "#7BC47B" : "#555", whiteSpace: "nowrap" }}>
          {doneCount}/{sets.length}
        </div>
      </div>

      <div style={{ padding: "0 12px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "26px 1fr 1fr 1fr 40px", gap: 6, marginBottom: 4 }}>
          {["Set", "Last", "lb", timed ? "sec" : "Reps", ""].map((h, i) => (
            <div key={i} style={{ ...labelStyle, letterSpacing: 1.5, textAlign: i ? "center" : "left" }}>{h}</div>
          ))}
        </div>

        {sets.map((s, i) => {
          const p = prevSets[i] || prevSets[prevSets.length - 1];
          const filled = { weight: num(s.weight), reps: num(s.reps) };
          const isPR = s.done && best > 0 && setScore(filled) > best;
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "26px 1fr 1fr 1fr 40px", gap: 6,
              alignItems: "center", marginBottom: 5, padding: "3px 0",
              opacity: s.done ? 1 : 0.95,
            }}>
              <div style={{ ...mono, fontSize: 13, color: s.done ? color : "#666" }}>{i + 1}</div>
              <div style={{ ...mono, fontSize: 11, color: "#555", textAlign: "center" }}>
                {prevSets[i] ? fmtSet(prevSets[i], timed) : "—"}
              </div>
              <input
                type="number" inputMode="decimal" value={s.weight}
                placeholder={p?.weight != null ? String(p.weight) : "lb"}
                onChange={e => onChange(i, { weight: e.target.value })}
                style={{ ...inputStyle, borderColor: s.done ? color + "66" : "#2A2A2A" }}
              />
              <input
                type="number" inputMode="numeric" value={s.reps}
                placeholder={p?.reps != null ? String(p.reps) : timed ? "sec" : "reps"}
                onChange={e => onChange(i, { reps: e.target.value })}
                style={{ ...inputStyle, borderColor: s.done ? color + "66" : "#2A2A2A" }}
              />
              <button
                onClick={() => onCheck(i, p)}
                title={s.done ? "Mark not done" : "Complete set"}
                style={{
                  height: 36, borderRadius: 4, cursor: "pointer", fontSize: 15,
                  border: `1px solid ${s.done ? color : "#333"}`,
                  background: s.done ? color : "transparent",
                  color: s.done ? "#111" : "#555",
                }}
              >
                {isPR ? "★" : "✓"}
              </button>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <Btn small color="#444" onClick={onAdd}>+ Set</Btn>
          {sets.length > 1 && <Btn small color="#444" onClick={onRemove}>− Set</Btn>}
          {prev && (
            <span style={{ marginLeft: "auto", fontSize: 10, ...mono, color: "#444", alignSelf: "center" }}>
              last: {fmtDate(prev.date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Browse mode: exercise row with expandable session history
// ═════════════════════════════════════════════════════════════════════════════
function ExerciseSummary({ ex, color, history }) {
  const [open, setOpen] = useState(false);
  const timed = isTimed(ex.reps);
  const last = history[0];

  return (
    <div style={{ borderBottom: "1px solid #1C1C1C" }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: "grid", gridTemplateColumns: "1fr 40px 84px 22px", padding: "13px 12px",
          background: categoryColors[ex.category] || "transparent", cursor: "pointer", alignItems: "start",
        }}
      >
        <div>
          <div style={{ fontSize: 14, color: ex.superset ? color : "#DDD", lineHeight: 1.3, marginBottom: 2 }}>{ex.name}</div>
          <div style={{ fontSize: 10, color: "#555", ...mono }}>
            {ex.note ? `${ex.note} · ` : ""}{ex.rest} rest
          </div>
          {last && (
            <div style={{ marginTop: 5, display: "inline-flex", gap: 6, background: "#1A1A1A", borderRadius: 3, padding: "2px 7px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: "#555", ...mono }}>LAST</span>
              <span style={{ fontSize: 10, color, ...mono }}>
                {last.sets.map(s => fmtSet(s, timed)).join(", ")} · {fmtDate(last.date)}
              </span>
            </div>
          )}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, fontStyle: "italic", color }}>{ex.sets}</div>
        <div style={{ fontSize: 12, color: "#888", ...mono }}>{ex.reps}</div>
        <div style={{ fontSize: 11, color: open ? color : "#444", textAlign: "right", paddingTop: 2 }}>{open ? "▲" : "▼"}</div>
      </div>

      {open && (
        <div style={{ background: "#0C0C0C", borderTop: "1px solid #181818", padding: "12px 12px 14px" }}>
          {history.length === 0 ? (
            <div style={{ ...mono, fontSize: 11, color: "#555" }}>No sessions yet. Start a workout to log sets.</div>
          ) : (
            <>
              <div style={{ ...labelStyle, marginBottom: 8 }}>History</div>
              {history.slice(0, 10).map((h, i) => {
                const prevH = history[i + 1];
                const top = Math.max(...h.sets.map(setScore));
                const gained = prevH && top > Math.max(...prevH.sets.map(setScore));
                const vol = volume(h.sets);
                return (
                  <div key={h.id} style={{
                    display: "flex", gap: 10, alignItems: "baseline", padding: "6px 8px", marginBottom: 4,
                    background: i === 0 ? "#141414" : "transparent", borderRadius: 4, flexWrap: "wrap",
                  }}>
                    <span style={{ ...mono, fontSize: 10, color: "#555", width: 78, flexShrink: 0 }}>{fmtDate(h.date)}</span>
                    <span style={{ ...mono, fontSize: 12, color: i === 0 ? color : "#888", flex: 1 }}>
                      {h.sets.map(s => fmtSet(s, timed)).join("  ")}
                    </span>
                    {vol > 0 && <span style={{ ...mono, fontSize: 9, color: "#444" }}>{vol.toLocaleString()} lb</span>}
                    {gained && <span style={{ fontSize: 11, color: "#7BC47B" }}>↑</span>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// History tab: every saved session, editable
// ═════════════════════════════════════════════════════════════════════════════
function SessionCard({ session, onEditSet, onRemoveSet, onDelete }) {
  const [open, setOpen] = useState(false);
  const d = program[session.day] || program[0];
  const names = Object.keys(session.entries);
  const allSets = names.flatMap(n => session.entries[n]);
  const dur = fmtDuration(session.startedAt, session.finishedAt);

  return (
    <div style={{ background: "#141414", border: `1px solid ${open ? d.color + "44" : "#1E1E1E"}`, borderRadius: 8, marginBottom: 10, overflow: "hidden" }}>
      <div onClick={() => setOpen(v => !v)} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, fontStyle: "italic", fontWeight: 700, color: d.color }}>{d.label}</span>
        <span style={{ ...mono, fontSize: 11, color: "#888" }}>{fmtDate(session.startedAt)}</span>
        <span style={{ ...mono, fontSize: 10, color: "#555", marginLeft: "auto" }}>
          {names.length} ex · {allSets.length} sets · {volume(allSets).toLocaleString()} lb{dur ? ` · ${dur}` : ""}
        </span>
      </div>
      {open && (
        <div style={{ borderTop: "1px solid #1E1E1E", padding: "10px 14px 14px", background: "#0E0E0E" }}>
          {names.map(name => {
            const timed = isTimed(program.flatMap(p => p.exercises).find(e => e.name === name)?.reps || "");
            return (
              <div key={name} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#CCC", marginBottom: 5 }}>{name}</div>
                {session.entries[name].map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ ...mono, fontSize: 11, color: "#555", width: 18 }}>{i + 1}</span>
                    <NumberField value={s.weight} placeholder="BW" width={70}
                      onCommit={v => onEditSet(name, i, { weight: v })} />
                    <span style={{ ...mono, fontSize: 10, color: "#555" }}>lb ×</span>
                    <NumberField value={s.reps} placeholder={timed ? "sec" : "reps"} width={58}
                      onCommit={v => onEditSet(name, i, { reps: v })} />
                    <span style={{ ...mono, fontSize: 10, color: "#555" }}>{timed ? "sec" : "reps"}</span>
                    <button onClick={() => onRemoveSet(name, i)} title="Remove set" style={{
                      marginLeft: "auto", background: "transparent", border: "1px solid #2A2A2A",
                      color: "#666", borderRadius: 3, cursor: "pointer", fontSize: 10, padding: "2px 7px", ...mono,
                    }}>✕</button>
                  </div>
                ))}
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <ConfirmBtn label="Delete session" confirmLabel="Tap again to delete" onConfirm={onDelete} />
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Rest timer bar
// ═════════════════════════════════════════════════════════════════════════════
function RestTimer({ rest, onAdjust, onSkip }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((rest.end - Date.now()) / 1000));
  const pct = Math.min(100, (1 - left / rest.total) * 100);
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, "0");
  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 10,
      background: "#0B0B0B", borderTop: `1px solid ${rest.color}55`,
      padding: "10px 16px calc(10px + env(safe-area-inset-bottom))",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, height: 2, width: `${pct}%`, background: rest.color, transition: "width 0.25s linear" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 720, margin: "0 auto" }}>
        <div>
          <div style={{ ...labelStyle, letterSpacing: 2 }}>{left ? "Rest" : "Go"}</div>
          <div style={{ fontSize: 26, ...mono, color: left ? rest.color : "#7BC47B", fontWeight: 700 }}>{mm}:{ss}</div>
        </div>
        <div style={{ ...mono, fontSize: 10, color: "#555", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {rest.label}
        </div>
        <Btn small color="#444" onClick={() => onAdjust(-15)}>−15</Btn>
        <Btn small color="#444" onClick={() => onAdjust(15)}>+15</Btn>
        <Btn small color={rest.color} onClick={onSkip}>{left ? "Skip" : "Done"}</Btn>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// App
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [data, setData]       = useState({ sessions: [], active: null });
  const [loaded, setLoaded]   = useState(false);
  const [saveOk, setSaveOk]   = useState(null);
  const [view, setView]       = useState(0);            // 0–3 = day, "history"
  const [panel, setPanel]     = useState(null);         // "protocol" | "backup" | null
  const [rest, setRest]       = useState(null);         // { end, total, label, color }
  const [summary, setSummary] = useState(null);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg]   = useState(null);

  // ── Load (and migrate v1 data on first run) ──
  useEffect(() => {
    (async () => {
      navigator.storage?.persist?.().catch(() => {});
      const stored = (await storeGet(STORE_KEY)) || { sessions: [], active: null };
      let sessions = stored.sessions || [];
      // One-time import of logs from v1 of this app ("pl:<exercise>" keys)
      if (!stored.migratedV1) {
        const legacy = {};
        for (const ex of program.flatMap(d => d.exercises)) {
          const v = await storeGet(toKey(ex.name));
          if (Array.isArray(v)) legacy[toKey(ex.name)] = v;
        }
        sessions = mergeSessions(sessions, legacyToSessions(legacy));
      }
      setData({ sessions: sessions.sort(byNewest), active: stored.active || null });
      if (stored.active) setView(stored.active.day);
      setLoaded(true);
    })();
  }, []);

  // ── Save on every change ──
  useEffect(() => {
    if (!loaded) return;
    storeSet(STORE_KEY, { version: 2, migratedV1: true, ...data }).then(setSaveOk);
  }, [data, loaded]);

  // ── Auto-dismiss rest timer a few seconds after it hits zero ──
  useEffect(() => {
    if (!rest) return;
    const ms = rest.end - Date.now();
    const t1 = setTimeout(() => navigator.vibrate?.([200, 100, 200]), Math.max(0, ms));
    const t2 = setTimeout(() => setRest(null), Math.max(0, ms) + 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [rest]);

  const { sessions, active } = data;

  // ── Workout actions ──
  const patchActive = fn => setData(d => (d.active ? { ...d, active: fn(d.active) } : d));
  const setExerciseSets = (name, fn) =>
    patchActive(a => ({ ...a, entries: { ...a.entries, [name]: fn(a.entries[name] || []) } }));

  function startWorkout(di) {
    setSummary(null);
    setData(d => ({ ...d, active: blankWorkout(di) }));
  }

  function checkSet(ex, i, prevSet, color) {
    const cur = active.entries[ex.name][i];
    const nowDone = !cur.done;
    setExerciseSets(ex.name, sets => sets.map((s, idx) => {
      if (idx !== i) return s;
      if (!nowDone) return { ...s, done: false };
      // Empty fields take last session's numbers (the placeholders)
      return {
        ...s, done: true,
        weight: s.weight !== "" ? s.weight : prevSet?.weight != null ? String(prevSet.weight) : "",
        reps:   s.reps   !== "" ? s.reps   : prevSet?.reps   != null ? String(prevSet.reps)   : "",
      };
    }));
    if (nowDone) {
      const secs = parseRest(ex.rest);
      setRest({ end: Date.now() + secs * 1000, total: secs, label: `after ${ex.name} · set ${i + 1}`, color });
    }
  }

  function finishWorkout() {
    const a = active;
    const entries = {};
    for (const [name, sets] of Object.entries(a.entries)) {
      const kept = sets
        .filter(s => s.done || s.reps !== "")
        .map(s => ({ weight: num(s.weight), reps: num(s.reps) }))
        .filter(s => s.reps != null || s.weight != null);
      if (kept.length) entries[name] = kept;
    }
    setRest(null);
    if (!Object.keys(entries).length) {
      setData(d => ({ ...d, active: null }));
      return;
    }
    const session = { id: a.id, day: a.day, startedAt: a.startedAt, finishedAt: new Date().toISOString(), entries };
    const prs = Object.entries(entries)
      .filter(([name, sets]) => {
        const best = bestScore(sessions, name);
        return best > 0 && Math.max(...sets.map(setScore)) > best;
      })
      .map(([name]) => name);
    const all = Object.values(entries).flat();
    setSummary({ day: a.day, exercises: Object.keys(entries).length, sets: all.length, volume: volume(all), prs, dur: fmtDuration(a.startedAt, session.finishedAt) });
    setData(d => ({ sessions: [session, ...d.sessions].sort(byNewest), active: null }));
  }

  // ── History edits ──
  const patchSession = (id, fn) =>
    setData(d => ({ ...d, sessions: d.sessions.map(s => (s.id === id ? fn(s) : s)) }));
  const editSet = (id, name, i, patch) =>
    patchSession(id, s => ({ ...s, entries: { ...s.entries, [name]: s.entries[name].map((x, j) => (j === i ? { ...x, ...patch } : x)) } }));
  const removeSet = (id, name, i) =>
    patchSession(id, s => {
      const left = s.entries[name].filter((_, j) => j !== i);
      const entries = { ...s.entries };
      if (left.length) entries[name] = left; else delete entries[name];
      return { ...s, entries };
    });
  const deleteSession = id => setData(d => ({ ...d, sessions: d.sessions.filter(s => s.id !== id) }));

  // ── Backup ──
  const exportJson = () => JSON.stringify({ version: 2, exported: new Date().toISOString(), sessions }, null, 2);

  function downloadBackup() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `recomp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setImportMsg({ ok: true, text: "✓ Backup downloaded" });
  }
  function copyBackup() {
    navigator.clipboard?.writeText(exportJson())
      .then(() => setImportMsg({ ok: true, text: "✓ Copied to clipboard" }))
      .catch(() => setImportMsg({ ok: false, text: "Clipboard blocked — use Download instead." }));
  }
  function importBackup(text) {
    try {
      const parsed = JSON.parse(text.trim());
      let incoming;
      if (Array.isArray(parsed.sessions)) incoming = parsed.sessions;
      else incoming = legacyToSessions(parsed.logs || parsed);         // v1 export
      incoming = incoming.filter(s => s && s.id && s.entries && typeof s.day === "number");
      if (!incoming.length) throw new Error();
      setData(d => ({ ...d, sessions: mergeSessions(d.sessions, incoming) }));
      setImportText("");
      setImportMsg({ ok: true, text: `✓ Restored ${incoming.length} session${incoming.length === 1 ? "" : "s"}` });
    } catch {
      setImportMsg({ ok: false, text: "Couldn't read that — paste or choose an exported backup." });
    }
  }
  function importFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(importBackup);
    e.target.value = "";
  }

  // ── Derived ──
  const historyByName = useMemo(() => {
    const out = {};
    for (const ex of program.flatMap(d => d.exercises)) out[ex.name] = historyFor(sessions, ex.name);
    return out;
  }, [sessions]);

  const thisWeek = useMemo(() => {
    const now = new Date();
    const monday = new Date(now); monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return new Set(sessions.filter(s => new Date(s.startedAt) >= monday).map(s => s.day));
  }, [sessions]);

  const isHistory = view === "history";
  const day = isHistory ? null : program[view];
  const inThisWorkout = active && !isHistory && active.day === view;

  const status = saveOk == null
    ? { color: "#444", label: "loading…" }
    : saveOk
      ? { color: "#7BC47B", label: `● auto-saving on this device · ${sessions.length} session${sessions.length === 1 ? "" : "s"} logged` }
      : { color: "#D4716B", label: "● storage unavailable — download a backup before closing" };

  if (!loaded) {
    return <div style={{ minHeight: "100vh", background: "#111", color: "#555", padding: 24, ...mono, fontSize: 12 }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#111", fontFamily: "'Palatino Linotype', Palatino, serif", color: "#E2D9C8", paddingBottom: rest ? 120 : 60 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ padding: "24px 20px 18px", background: "#0E0E0E", borderBottom: "1px solid #222" }}>
          <div style={{ fontSize: 10, letterSpacing: 5, color: "#666", textTransform: "uppercase", marginBottom: 8, ...mono }}>
            4-Day Recomp · Upper / Lower
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: "clamp(24px, 5vw, 38px)", fontWeight: 700, fontStyle: "italic", lineHeight: 1.1 }}>
            Build Muscle.<br />Lean Out.
          </h1>
          <div style={{ marginTop: 10, fontSize: 10, ...mono, color: status.color, letterSpacing: 1 }}>{status.label}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <Btn color="#C8A96E" solid={panel === "protocol"} onClick={() => setPanel(p => (p === "protocol" ? null : "protocol"))}>
              {panel === "protocol" ? "Hide" : "Show"} Protocol
            </Btn>
            <Btn color="#666" solid={panel === "backup"} onClick={() => { setPanel(p => (p === "backup" ? null : "backup")); setImportMsg(null); }}>
              Backup / Restore
            </Btn>
          </div>
        </div>

        {/* Protocol */}
        {panel === "protocol" && (
          <div style={{ padding: "16px 16px 20px", background: "#0E0E0E", borderBottom: "1px solid #1A1A1A" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: 10 }}>
              {[
                { icon: "⚖️", title: "Calorie Target",      body: "Maintenance or –150–200 cal deficit. Too aggressive and you sacrifice muscle." },
                { icon: "🥩", title: "Protein",              body: "0.8–1g per lb of bodyweight. Spread across 3–4 meals." },
                { icon: "🔥", title: "Cardio",               body: "2–3×/week on off days. 30–40 min Zone 2 (conversational pace)." },
                { icon: "⏱️", title: "Rest Periods",         body: "Compounds: 2–3 min. Supersets: 60s between pairs." },
                { icon: "📈", title: "Progressive Overload", body: "Add reps before weight. Hit the top rep range on all sets → bump load 2.5–5%." },
                { icon: "🔗", title: "Supersets",            body: "Non-competing pairs save time and raise metabolic demand without sacrificing quality." },
              ].map((r, i) => (
                <div key={i} style={{ background: "#141414", border: "1px solid #222", borderRadius: 6, padding: 14 }}>
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{r.icon}</div>
                  <div style={{ fontSize: 10, ...mono, letterSpacing: 2, color: "#C8A96E", marginBottom: 5, textTransform: "uppercase" }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>{r.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Backup / Restore */}
        {panel === "backup" && (
          <div style={{ padding: 20, background: "#0E0E0E", borderBottom: "1px solid #1A1A1A" }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Export</div>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#888", lineHeight: 1.6 }}>
              Your log saves automatically in this browser. Download a backup now and then — it's the only way to move your history to another device or browser.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
              <Btn color="#CCC" onClick={downloadBackup}>Download backup</Btn>
              <Btn color="#888" onClick={copyBackup}>Copy as text</Btn>
            </div>

            <div style={{ ...labelStyle, marginBottom: 8 }}>Restore</div>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#888", lineHeight: 1.6 }}>
              Merges into your current log (nothing is overwritten). Backups from the old version of this app work too.
            </p>
            <label style={{ display: "inline-block", marginBottom: 10 }}>
              <input type="file" accept="application/json,.json,.txt" onChange={importFile} style={{ display: "none" }} />
              <span style={{ display: "inline-block", padding: "8px 16px", border: "1px solid #888", borderRadius: 4, color: "#888", fontSize: 11, ...mono, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
                Choose backup file
              </span>
            </label>
            <textarea
              value={importText}
              onChange={e => { setImportText(e.target.value); setImportMsg(null); }}
              placeholder="…or paste backup text here"
              rows={4}
              style={{ ...inputStyle, textAlign: "left", fontSize: 12, resize: "vertical", lineHeight: 1.5 }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <Btn color="#CCC" disabled={!importText.trim()} onClick={() => importBackup(importText)}>Restore</Btn>
              {importMsg && <span style={{ fontSize: 11, ...mono, color: importMsg.ok ? "#7BC47B" : "#D4716B" }}>{importMsg.text}</span>}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", background: "#0E0E0E", borderBottom: "1px solid #1E1E1E", overflowX: "auto" }}>
          {program.map((d, i) => {
            const on = view === i;
            return (
              <button key={i} onClick={() => setView(i)} style={{
                flex: 1, minWidth: 76, padding: "13px 6px",
                background: on ? "#141414" : "transparent", border: "none",
                borderBottom: on ? `2px solid ${d.color}` : "2px solid transparent",
                color: on ? d.color : "#555", cursor: "pointer",
                ...mono, letterSpacing: 1.5, fontSize: 11, textTransform: "uppercase",
              }}>
                <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 4 }}>
                  {d.tag}{thisWeek.has(i) ? " ✓" : ""}{active?.day === i ? " ●" : ""}
                </div>
                {d.label}
              </button>
            );
          })}
          <button onClick={() => setView("history")} style={{
            flex: 1, minWidth: 76, padding: "13px 6px",
            background: isHistory ? "#141414" : "transparent", border: "none",
            borderBottom: isHistory ? "2px solid #CCC" : "2px solid transparent",
            color: isHistory ? "#CCC" : "#555", cursor: "pointer",
            ...mono, letterSpacing: 1.5, fontSize: 11, textTransform: "uppercase",
          }}>
            <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 4 }}>{sessions.length}</div>
            History
          </button>
        </div>

        {/* Workout-in-progress banner (when looking at another tab) */}
        {active && !inThisWorkout && (
          <div style={{ margin: "12px 16px 0", padding: "10px 12px", border: `1px solid ${program[active.day].color}55`, borderRadius: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...mono, fontSize: 11, color: program[active.day].color }}>● {program[active.day].label} in progress</span>
            <Btn small color={program[active.day].color} style={{ marginLeft: "auto" }} onClick={() => setView(active.day)}>Resume</Btn>
          </div>
        )}

        {/* Post-workout summary */}
        {summary && (
          <div style={{ margin: "12px 16px 0", padding: "14px", background: "#141A14", border: "1px solid #2E4A2E", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 17, fontStyle: "italic", fontWeight: 700, color: "#7BC47B" }}>Workout saved</span>
              <span style={{ ...mono, fontSize: 10, color: "#5A7A5A" }}>{program[summary.day].label}{summary.dur ? ` · ${summary.dur}` : ""}</span>
              <button onClick={() => setSummary(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#5A7A5A", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            <div style={{ ...mono, fontSize: 12, color: "#9BC49B", marginTop: 6 }}>
              {summary.exercises} exercises · {summary.sets} sets · {summary.volume.toLocaleString()} lb volume
            </div>
            {summary.prs.length > 0 && (
              <div style={{ ...mono, fontSize: 11, color: "#FFD700", marginTop: 6 }}>★ New best: {summary.prs.join(", ")}</div>
            )}
          </div>
        )}

        {/* ── Day view ── */}
        {day && (
          <>
            <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: "clamp(20px, 4vw, 28px)", fontStyle: "italic", fontWeight: 700, color: day.color }}>{day.label}</span>
              <span style={{ fontSize: 11, ...mono, letterSpacing: 2, color: "#666", textTransform: "uppercase" }}>{day.focus}</span>
            </div>

            {inThisWorkout ? (
              <>
                <div style={{ margin: "0 16px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ ...mono, fontSize: 10, color: "#666" }}>
                    Started {new Date(active.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ·
                    {" "}{Object.values(active.entries).flat().filter(s => s.done).length} sets done
                  </span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <ConfirmBtn label="Discard" confirmLabel="Tap to discard" onConfirm={() => { setRest(null); setData(d => ({ ...d, active: null })); }} />
                  </span>
                </div>
                <div style={{ margin: "0 16px", background: "#141414", border: `1px solid ${day.color}33`, borderRadius: 8, overflow: "hidden" }}>
                  {day.exercises.map(ex => (
                    <ExerciseLogger
                      key={ex.name}
                      ex={ex}
                      color={day.color}
                      sets={active.entries[ex.name] || []}
                      prev={historyByName[ex.name][0]}
                      best={bestScore(sessions, ex.name)}
                      onChange={(i, patch) => setExerciseSets(ex.name, sets => sets.map((s, j) => (j === i ? { ...s, ...patch } : s)))}
                      onAdd={() => setExerciseSets(ex.name, sets => [...sets, { weight: sets[sets.length - 1]?.weight || "", reps: "", done: false }])}
                      onRemove={() => setExerciseSets(ex.name, sets => sets.slice(0, -1))}
                      onCheck={(i, prevSet) => checkSet(ex, i, prevSet, day.color)}
                    />
                  ))}
                </div>
                <div style={{ margin: "14px 16px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                  <Btn solid color={day.color} onClick={finishWorkout} style={{ padding: "14px", fontSize: 13 }}>Finish & save workout</Btn>
                  <div style={{ ...mono, fontSize: 10, color: "#555", textAlign: "center" }}>
                    Saves every set you checked or entered reps for. Progress is kept if you close the app mid-workout.
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ margin: "0 16px 12px" }}>
                  <Btn solid color={day.color} disabled={!!active} onClick={() => startWorkout(view)} style={{ width: "100%", padding: "13px", fontSize: 12 }}>
                    {active ? "Finish the current workout first" : `Start ${day.label} workout`}
                  </Btn>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 84px 22px", padding: "6px 28px 4px" }}>
                  {["Exercise", "Sets", "Reps", ""].map((h, i) => <div key={i} style={labelStyle}>{h}</div>)}
                </div>
                <div style={{ margin: "0 16px", background: "#141414", border: "1px solid #1E1E1E", borderRadius: 8, overflow: "hidden" }}>
                  {day.exercises.map(ex => (
                    <ExerciseSummary key={ex.name} ex={ex} color={day.color} history={historyByName[ex.name]} />
                  ))}
                </div>
                <div style={{ margin: "6px 16px 0", fontSize: 10, color: "#444", ...mono, textAlign: "right" }}>
                  {day.exercises.length} exercises · {day.exercises.reduce((a, e) => a + e.sets, 0)} total sets
                </div>
              </>
            )}
          </>
        )}

        {/* ── History view ── */}
        {isHistory && (
          <div style={{ padding: "16px 16px 0" }}>
            {sessions.length === 0 ? (
              <div style={{ ...mono, fontSize: 12, color: "#555", padding: 8 }}>No workouts saved yet.</div>
            ) : (
              sessions.map(s => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onEditSet={(name, i, patch) => editSet(s.id, name, i, patch)}
                  onRemoveSet={(name, i) => removeSet(s.id, name, i)}
                  onDelete={() => deleteSession(s.id)}
                />
              ))
            )}
          </div>
        )}

        {/* Weekly layout */}
        {!isHistory && (
          <div style={{ padding: "28px 16px 0" }}>
            <div style={{ ...labelStyle, letterSpacing: 4, marginBottom: 12 }}>This week</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {[
                { d: "Mon", type: "train", which: 0 }, { d: "Tue", type: "train", which: 1 },
                { d: "Wed", type: "cardio" },           { d: "Thu", type: "train", which: 2 },
                { d: "Fri", type: "train", which: 3 }, { d: "Sat", type: "cardio" },
                { d: "Sun", type: "rest" },
              ].map((item, i) => {
                const train = item.type === "train";
                const c = train ? program[item.which].color : null;
                const done = train && thisWeek.has(item.which);
                return (
                  <div key={i} style={{
                    background: done ? c + "40" : train ? c + "14" : "#0E0E0E",
                    border: train ? `1px solid ${c}${done ? "AA" : "33"}` : "1px solid #1A1A1A",
                    borderRadius: 6, padding: "10px 2px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 9, ...mono, color: train ? c : "#444", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>
                      {item.d}{done ? " ✓" : ""}
                    </div>
                    <div style={{ fontSize: 8, color: train ? "#888" : "#444", ...mono }}>
                      {train ? program[item.which].label : item.type === "cardio" ? "Cardio" : "Rest"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {rest && (
        <RestTimer
          rest={rest}
          onAdjust={d => setRest(r => {
            const end = Math.max(Date.now(), r.end + d * 1000);
            return { ...r, end, total: Math.max(r.total, Math.ceil((end - Date.now()) / 1000)) };
          })}
          onSkip={() => setRest(null)}
        />
      )}
    </div>
  );
}
