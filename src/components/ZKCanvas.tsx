"use client";

import { useEffect, useRef } from "react";

interface Props {
  execProgress: number;
  execPhaseIdx: number;
  recipients: { addr: string }[];
}

export function ZKCanvas({ execProgress, execPhaseIdx, recipients }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ t: 0, raf: 0 });
  // Refs so the animation loop always sees the latest values without re-running the effect
  const phaseRef = useRef(execPhaseIdx);
  const progressRef = useRef(execProgress);
  const recipientsRef = useRef(recipients);

  useEffect(() => { phaseRef.current = execPhaseIdx; }, [execPhaseIdx]);
  useEffect(() => { progressRef.current = execProgress; }, [execProgress]);
  useEffect(() => { recipientsRef.current = recipients; }, [recipients]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;
    const cvs = canvas; // stable ref for closure

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      cvs.width = cvs.offsetWidth * dpr;
      cvs.height = cvs.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const isDark = () => document.documentElement.getAttribute("data-mode") === "dark";

    const activeC = "rgba(200,71,43,.85)";
    const doneC = "rgba(111,175,142,.85)";

    let animating = true;
    function draw() {
      if (!animating) return;
      const W = cvs.offsetWidth, H = cvs.offsetHeight;
      const dk = isDark();
      stateRef.current.t++;
      const t = stateRef.current.t;

      ctx.clearRect(0, 0, W, H);
      const bgColor = dk ? "rgba(20,14,10,1)" : "rgba(253,250,244,1)";
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H);

      // Read from refs so the loop always sees the latest values
      const phase = phaseRef.current;
      const recs = recipientsRef.current;

      const c0 = W * 0.08, c1 = W * 0.34, c2 = W * 0.60, c3 = W * 0.86;
      const centerY = H / 2;
      const inCount = 6;
      const inSp = Math.min(30, (H - 44) / inCount);
      const inStart = centerY - (inCount - 1) * inSp / 2;

      const inputNodes = Array.from({ length: inCount }, (_, i) => ({ x: c0, y: inStart + i * inSp }));
      const midNodes = [
        { x: c1, y: centerY - H * 0.14, label: "ENC" },
        { x: c1, y: centerY, label: "ZK" },
        { x: c1, y: centerY + H * 0.14, label: "∑" },
      ];
      const circuitNode = { x: c2, y: centerY };
      const proofNode = { x: c3, y: centerY };

      const idleC = dk ? "rgba(244,234,212,.15)" : "rgba(18,16,13,.1)";
      const flowC = "rgba(200,71,43,";

      // p0=enc, p1=zk, p2=broadcast, p3=confirm
      const p0done = phase > 0, p0active = phase === 0;
      const p1done = phase > 1, p1active = phase === 1;
      const p2done = phase > 2, p2active = phase === 2;
      const p3done = phase > 3, p3active = phase === 3;

      const drawLine = (x1: number, y1: number, x2: number, y2: number, progress: number, color: string) => {
        if (progress <= 0) return;
        const clamp = Math.min(1, progress);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (x2 - x1) * clamp, y1 + (y2 - y1) * clamp);
        ctx.strokeStyle = color; ctx.lineWidth = 1.4;
        ctx.stroke();
      };

      const drawNode = (x: number, y: number, r: number, color: string, label: string | null, pulse: boolean) => {
        if (pulse) {
          const pr = r + 4 + Math.sin(t * 0.08) * 3;
          ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(200,71,43,.12)"; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        if (label) {
          ctx.font = `500 9px 'IBM Plex Mono', monospace`;
          ctx.fillStyle = dk ? "#100C09" : "#F0EBE0";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(label, x, y);
        }
      };

      // connections: input → mid
      inputNodes.forEach((n, i) => {
        const m = midNodes[i % 3];
        const lp = p0done ? 1 : p0active ? Math.min(1, (t % 80) / 40 + i * 0.1) : 0;
        drawLine(n.x, n.y, m.x, m.y, lp, p0done ? doneC : flowC + "0.5)");
      });
      // mid → circuit
      midNodes.forEach((n, i) => {
        const lp = p1done ? 1 : p1active ? Math.min(1, ((t - 30) % 90) / 45 + i * 0.15) : 0;
        drawLine(n.x, n.y, circuitNode.x, circuitNode.y, lp, p1done ? doneC : flowC + "0.5)");
      });
      // circuit → proof
      const lp2 = p2done ? 1 : p2active ? Math.min(1, ((t - 60) % 100) / 50) : 0;
      drawLine(circuitNode.x, circuitNode.y, proofNode.x, proofNode.y, lp2, p2done ? doneC : flowC + "0.6)");

      // flowing particles along active lines
      if (p0active || p0done) {
        inputNodes.forEach((n, i) => {
          const m = midNodes[i % 3];
          const tt = ((t * 1.4 + i * 14) % 60) / 60;
          ctx.beginPath(); ctx.arc(n.x + (m.x - n.x) * tt, n.y + (m.y - n.y) * tt, 2, 0, Math.PI * 2);
          ctx.fillStyle = p0done ? doneC : activeC; ctx.fill();
        });
      }
      if (p1active || p1done) {
        midNodes.forEach((n, i) => {
          const tt = ((t * 1.2 + i * 20) % 70) / 70;
          ctx.beginPath(); ctx.arc(n.x + (circuitNode.x - n.x) * tt, n.y + (circuitNode.y - n.y) * tt, 2, 0, Math.PI * 2);
          ctx.fillStyle = p1done ? doneC : activeC; ctx.fill();
        });
      }
      if (p2active) {
        const tt = ((t * 1.5) % 80) / 80;
        ctx.beginPath(); ctx.arc(circuitNode.x + (proofNode.x - circuitNode.x) * tt, centerY, 3, 0, Math.PI * 2);
        ctx.fillStyle = activeC; ctx.fill();
      }

      // input nodes
      inputNodes.forEach((n) => drawNode(n.x, n.y, 5, p0done ? doneC : p0active ? activeC : idleC, null, p0active));
      // mid nodes
      midNodes.forEach((n) => {
        const col = p1done ? doneC : (p0done && p1active) ? activeC : idleC;
        drawNode(n.x, n.y, 16, col, n.label, p1active);
      });
      // circuit node
      drawNode(circuitNode.x, circuitNode.y, 20, p2done ? doneC : (p1done && p2active) ? activeC : idleC, "SNARK", p2active);
      // proof node
      drawNode(proofNode.x, proofNode.y, 18, p3done ? doneC : p3active ? activeC : idleC, p3done ? "✓" : "TX", p3active);

      // top labels
      ctx.font = `400 10px 'IBM Plex Mono', monospace`;
      ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.fillStyle = dk ? "rgba(244,234,212,.35)" : "rgba(18,16,13,.28)";
      ctx.fillText("recipients", c0 - 6, inStart - 12);
      ctx.fillText("FHE circuit", c1 - 10, inStart - 12);
      ctx.fillText("prover", c2 - 6, inStart - 12);
      ctx.fillText("chain", c3 - 5, inStart - 12);

      // tag recipient addresses next to input nodes
      ctx.font = `9px 'IBM Plex Mono', monospace`;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      inputNodes.forEach((n, i) => {
        if (recs[i]) {
          ctx.fillStyle = p0done ? doneC : p0active ? activeC : idleC;
          ctx.fillText(recs[i].addr.slice(0, 8) + "…", n.x - 9, n.y);
        }
      });

      stateRef.current.raf = requestAnimationFrame(draw);
    }

    const s = stateRef.current;
    s.raf = requestAnimationFrame(draw);
    return () => { animating = false; cancelAnimationFrame(s.raf); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "280px", display: "block", borderRadius: 6 }}
    />
  );
}
