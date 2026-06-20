"use client";

import { fmtToken, shortAddr, toRaw } from "@/lib/format";
import type { ParsedRow } from "@/lib/csv";

export function RecipientPreview({ rows }: { rows: ParsedRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 160,
          display: "grid",
          placeItems: "center",
          color: "var(--fg-faint)",
          fontSize: 13,
          border: "1px dashed var(--border)",
          borderRadius: 12,
          marginBottom: 14,
          textAlign: "center",
          padding: 16,
        }}
      >
        Add recipients to preview the encrypted distribution.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        maxHeight: 280,
        marginBottom: 14,
        border: "1px solid var(--border-soft)",
        borderRadius: 12,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ position: "sticky", top: 0, background: "var(--bg-elev)" }}>
            <th style={th}>Recipient</th>
            <th style={{ ...th, textAlign: "right" }}>Allocation</th>
            <th style={{ ...th, textAlign: "right" }}>On-chain</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.recipient} style={{ borderTop: "1px solid var(--border-soft)" }}>
              <td style={{ ...td }} className="cd-mono">
                {shortAddr(r.recipient, 5)}
              </td>
              <td style={{ ...td, textAlign: "right" }}>{fmtToken(toRaw(r.amount))}</td>
              <td style={{ ...td, textAlign: "right" }}>
                <span className="cd-badge cd-badge-accent" style={{ fontSize: 10.5 }}>
                  🔒 encrypted
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.7rem",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--fg-faint)",
  fontWeight: 600,
};
const td: React.CSSProperties = {
  padding: "0.5rem 0.7rem",
  color: "var(--fg)",
};
