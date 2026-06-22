"use client";

interface Step { n: string; label: string; }

export function StepRail({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 4 }}>
      {steps.map((step, i) => {
        const idx = i + 1;
        const done = current > idx;
        const active = current === idx;
        const mark = done ? "✓" : step.n;
        const fg = active ? "#C8472B" : done ? "#6FAF8E" : "var(--soft)";
        const bd = active ? "#C8472B" : done ? "#6FAF8E" : "var(--line)";
        const bg = active ? "rgba(200,71,43,.08)" : done ? "rgba(111,175,142,.08)" : "transparent";
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 13px", border: `1px solid ${bd}`, background: bg, borderRadius: 999, transition: "all .3s" }}>
              <span style={{ width: 17, height: 17, borderRadius: "50%", border: `1.5px solid ${fg}`, color: fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 9, transition: "all .3s", flexShrink: 0 }}>
                {mark}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".07em", color: fg, transition: "color .3s", whiteSpace: "nowrap" }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 18, height: 1, background: done ? "#6FAF8E" : "var(--line)", transition: "background .3s", flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
