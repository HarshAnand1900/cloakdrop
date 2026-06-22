import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sotto — Confidential token distribution";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          background: "#EDE8DC",
          display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "flex-start",
          padding: "72px 80px",
          position: "relative",
          fontFamily: "serif",
        }}
      >
        {/* Background pattern */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(148% 128% at 76% -8%,#F5F0E4 0%,#EDE8DC 46%,#E4DDCE 100%)", display: "flex" }} />

        {/* Red accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "#C8472B", display: "flex" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 56, position: "relative" }}>
          <div style={{ width: 28, height: 28, background: "#12100D", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 12, height: 3, background: "#EDE8DC", display: "flex" }} />
          </div>
          <span style={{ fontSize: 32, fontFamily: "serif", color: "#12100D", fontWeight: 400 }}>Sotto</span>
        </div>

        {/* Headline */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 96, lineHeight: 0.95, color: "#12100D", fontFamily: "serif", fontWeight: 400, letterSpacing: "-2px", display: "flex" }}>Pay everyone.</span>
          <span style={{ fontSize: 96, lineHeight: 0.95, color: "#12100D", fontFamily: "serif", fontWeight: 400, letterSpacing: "-2px", display: "flex", marginTop: 8 }}>
            Publish{" "}
            <span style={{ color: "#C8472B", fontStyle: "italic", marginLeft: 18, display: "flex" }}>nothing.</span>
          </span>
        </div>

        {/* Sub */}
        <div style={{ marginTop: 36, fontSize: 22, color: "#5C5144", lineHeight: 1.5, maxWidth: 680, fontFamily: "sans-serif", fontWeight: 300, display: "flex" }}>
          FHE-encrypted confidential distributions. Only each recipient can decrypt what&apos;s theirs.
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: 12, marginTop: 44 }}>
          {["ERC-7984", "Zama Protocol", "TokenOps SDK", "Sepolia"].map(b => (
            <div key={b} style={{ background: "rgba(18,16,13,.07)", border: "1px solid rgba(18,16,13,.15)", borderRadius: 3, padding: "8px 16px", fontSize: 14, color: "#5C5144", fontFamily: "monospace", display: "flex" }}>
              {b}
            </div>
          ))}
        </div>

        {/* Right: mock card */}
        <div style={{ position: "absolute", right: 72, top: "50%", transform: "translateY(-50%)", width: 320, background: "#F7F3E9", border: "1px solid rgba(18,16,13,.1)", borderRadius: 6, overflow: "hidden", boxShadow: "0 24px 48px -16px rgba(18,16,13,.35)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(18,16,13,.09)", display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 18, color: "#12100D", fontFamily: "serif" }}>Distribution #0427</span>
            <span style={{ fontSize: 12, color: "#8A8273", marginTop: 4 }}>142 recipients</span>
          </div>
          {[80, 60, 100].map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 22px", borderBottom: "1px solid rgba(18,16,13,.05)" }}>
              <span style={{ fontSize: 11, color: "#4A4438", flex: 1, fontFamily: "monospace" }}>0x4f…{i}A{i}1</span>
              <div style={{ height: 10, width: w, background: "#12100D", borderRadius: 1, opacity: 0.8, display: "flex" }} />
            </div>
          ))}
          <div style={{ padding: "12px 22px", background: "rgba(18,16,13,.025)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "#8A8273", letterSpacing: "0.06em" }}>TOTAL ONCHAIN · ENCRYPTED</span>
            <div style={{ height: 10, width: 60, background: "#12100D", borderRadius: 1, opacity: 0.8, display: "flex" }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
