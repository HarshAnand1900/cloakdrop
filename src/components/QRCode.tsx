"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  size?: number;
}

export function QRCode({ value, size = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const QRCodeLib = await import("qrcode");
        if (!alive || !canvasRef.current) return;
        await QRCodeLib.toCanvas(canvasRef.current, value, {
          width: size,
          margin: 1,
          color: {
            dark: document.documentElement.getAttribute("data-mode") === "dark" ? "#F4EAD4" : "#12100D",
            light: document.documentElement.getAttribute("data-mode") === "dark" ? "#1C1610" : "#F6F2E8",
          },
          errorCorrectionLevel: "M",
        });
      } catch {
        if (alive) setFallback(true);
      }
    })();
    return () => { alive = false; };
  }, [value, size]);

  if (fallback) {
    return (
      <div style={{ width: size, height: size, background: "var(--card)", borderRadius: 4, display: "grid", placeItems: "center", border: "1px solid var(--line)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--soft)", textAlign: "center", padding: 8 }}>QR unavailable</span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ borderRadius: 4, display: "block" }}
      aria-label={`QR code for ${value}`}
    />
  );
}
