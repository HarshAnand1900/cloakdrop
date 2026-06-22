"use client";

import { useEffect, useRef } from "react";

type Variant = "landing" | "flow" | "converge";

interface Props {
  variant: Variant;
  style?: React.CSSProperties;
}

export function CanvasBackground({ variant, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    raf: number;
    mouse: { x: number; y: number; active: boolean; last: number };
    t: number;
    parts: { x: number; y: number }[];
    cols: number;
    rows: number;
    cw: number;
    ch: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const CW = 22, CH = 26;

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.offsetWidth : window.innerWidth;
      const h = parent ? parent.offsetHeight : window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const parts = Array.from({ length: Math.floor((w * h) / 7200) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
      }));
      stateRef.current = {
        raf: 0, t: 0,
        mouse: { x: -9999, y: -9999, active: false, last: 0 },
        cols: Math.ceil(w / CW) + 1, rows: Math.ceil(h / CH) + 1,
        cw: CW, ch: CH, w, h, parts,
      };
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (e: MouseEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const rect = canvas.getBoundingClientRect();
      s.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true, last: performance.now() };
    };
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && stateRef.current) stateRef.current.mouse.active = false;
    };
    (canvas.parentElement || window).addEventListener("mousemove", onMouseMove as EventListener);
    window.addEventListener("mouseout", onMouseOut);

    const HEX = "0123456789ABCDEF";
    const isDark = () => document.documentElement.getAttribute("data-mode") === "dark";

    function drawLanding() {
      const s = stateRef.current;
      if (!s) return;
      const dk = isDark();
      const { w, h, cols, rows, cw, ch, mouse } = s;
      s.t++;
      ctx.clearRect(0, 0, w, h);

      let fx: number, fy: number;
      const idle = performance.now() - mouse.last;
      if (mouse.active && idle < 2400) { fx = mouse.x; fy = mouse.y; }
      else {
        const a = s.t * 0.0038;
        fx = w * (0.5 + 0.3 * Math.sin(a));
        fy = h * (0.42 + 0.22 * Math.cos(a * 0.77));
      }

      // Background grid of hex chars
      ctx.font = `11px 'IBM Plex Mono', monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const bgA = dk ? 0.055 : 0.038;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = c * cw + cw / 2, cy = r * ch + ch / 2;
          const k = r * 53 + c * 17;
          const drift = Math.sin((cx + cy) * 0.008 + s.t * 0.006) * 0.5 + 0.5;
          ctx.fillStyle = dk
            ? `rgba(200,71,43,${bgA * drift})`
            : `rgba(80,70,55,${bgA * drift})`;
          ctx.fillText(HEX[(k + (s.t >> 2)) % 16], cx, cy);
        }
      }

      // Reveal zone around cursor/beacon
      const R = 260;
      ctx.font = `13px 'IBM Plex Mono', monospace`;
      const c0 = Math.max(0, Math.floor((fx - R) / cw));
      const c1 = Math.min(cols, Math.ceil((fx + R) / cw));
      const r0 = Math.max(0, Math.floor((fy - R) / ch));
      const r1 = Math.min(rows, Math.ceil((fy + R) / ch));
      for (let r = r0; r < r1; r++) {
        for (let c = c0; c < c1; c++) {
          const cx = c * cw + cw / 2, cy = r * ch + ch / 2;
          const d = Math.hypot(cx - fx, cy - fy);
          if (d > R) continue;
          const prog = Math.pow(1 - d / R, 1.3);
          const bA = Math.max(0, (0.55 - prog)) * Math.min(1, prog * 9) * (dk ? 0.35 : 0.18);
          if (bA > 0.01) {
            ctx.fillStyle = dk
              ? `rgba(15,10,6,${bA})`
              : `rgba(255,252,244,${bA * 2.2})`;
            ctx.fillRect(cx - cw / 2 + 1, cy - ch / 2 + 3, cw - 2, ch - 6);
          }
          const cA = Math.max(0, (prog - 0.28) * 1.9);
          if (cA > 0.02) {
            const k = r * 53 + c * 17;
            const ch2 = prog < 0.75 ? HEX[(k + (s.t >> 1)) % 16] : HEX[k % 16];
            ctx.fillStyle = d < R * 0.28
              ? `rgba(200,71,43,${Math.min(cA, 0.95)})`
              : dk
                ? `rgba(244,234,212,${Math.min(cA, 0.75)})`
                : `rgba(60,50,38,${Math.min(cA, 0.55)})`;
            ctx.fillText(ch2, cx, cy);
          }
        }
      }
    }

    function drawFlow() {
      const s = stateRef.current;
      if (!s) return;
      const dk = isDark();
      const { w, h, parts, mouse } = s;
      s.t++;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = dk ? "rgba(200,71,43,.12)" : "rgba(18,16,13,.05)";
      for (const p of parts) {
        const a = Math.sin(p.x * 0.0038 + s.t * 0.0026) + Math.cos(p.y * 0.0038 - s.t * 0.002);
        let vx = Math.cos(a * 1.5) * 0.35, vy = Math.sin(a * 1.5) * 0.35;
        if (mouse.active) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y, dd = Math.hypot(dx, dy);
          if (dd < 170) { const f = (1 - dd / 170) * 0.5; vx += dx / (dd || 1) * f; vy += dy / (dd || 1) * f; }
        }
        p.x += vx; p.y += vy;
        if (p.x < 0) p.x += w; if (p.x > w) p.x -= w;
        if (p.y < 0) p.y += h; if (p.y > h) p.y -= h;
        ctx.fillRect(p.x, p.y, 1.5, 1.5);
      }
    }

    function drawConverge() {
      const s = stateRef.current;
      if (!s) return;
      const dk = isDark();
      const { w, h, parts } = s;
      s.t++;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      for (const p of parts) {
        const dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy);
        p.x += dx / (d || 1) * Math.max(0.12, 190 / (d + 1)) * 0.12;
        p.y += dy / (d || 1) * Math.max(0.12, 190 / (d + 1)) * 0.12;
        if (d < 9) { p.x = Math.random() * w; p.y = Math.random() * h; }
        const al = Math.min(0.65, 52 / (d + 1));
        ctx.fillStyle = `rgba(200,71,43,${al * (dk ? 1 : 0.65)})`;
        ctx.fillRect(p.x, p.y, 1.5, 1.5);
      }
    }

    const draw = variant === "landing" ? drawLanding : variant === "converge" ? drawConverge : drawFlow;
    let animating = true;

    function loop() {
      if (!animating) return;
      draw();
      const s = stateRef.current;
      if (s) s.raf = requestAnimationFrame(loop);
    }
    const s = stateRef.current;
    if (s) s.raf = requestAnimationFrame(loop);

    return () => {
      animating = false;
      const s2 = stateRef.current;
      if (s2) cancelAnimationFrame(s2.raf);
      window.removeEventListener("resize", resize);
      (canvas.parentElement || window).removeEventListener("mousemove", onMouseMove as EventListener);
      window.removeEventListener("mouseout", onMouseOut);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
        ...style,
      }}
    />
  );
}
