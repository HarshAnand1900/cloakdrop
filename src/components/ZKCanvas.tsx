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

    let animating = true;
    function draw() {
      if (!animating) return;
      const W = cvs.offsetWidth, H = cvs.offsetHeight;
      const dk = isDark();
      stateRef.current.t++;
      const t = stateRef.current.t;

      ctx.clearRect(0, 0, W, H);

      const bgColor = dk ? "rgba(20,16,10,1)" : "rgba(246,242,232,1)";
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H);

      const c0 = W * 0.10, c1 = W * 0.36, c2 = W * 0.62, c3 = W * 0.88;
      const nodeR = 10, centerY = H / 2;
      // Read from refs so animation loop always gets the latest values
      const phase = phaseRef.current;
      const recs = recipientsRef.current;

      const inCount = Math.max(Math.min(recs.length, 6), 4);
      const inSpacing = Math.min(32, (H - 40) / inCount);
      const inStartY = centerY - (inCount - 1) * inSpacing / 2;
      const inputNodes = Array.from({ length: inCount }, (_, i) => ({ x: c0, y: inStartY + i * inSpacing }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _progress = progressRef.current; // available for future progress-based drawing
      const fheNodes = [
        { x: c1, y: centerY - H * 0.12, label: "ENC" },
        { x: c1, y: centerY, label: "ZK" },
        { x: c1, y: centerY + H * 0.12, label: "∑" },
      ];
      const circuitNode = { x: c2, y: centerY };
      const proofNode = { x: c3, y: centerY };

      const idleColor = dk ? "rgba(244,234,212,.18)" : "rgba(18,16,13,.12)";
      const activeColor = "rgba(200,71,43,.8)";
      const doneColor = "rgba(111,175,142,.8)";
      const nc = (active: boolean, done: boolean) => active ? activeColor : done ? doneColor : idleColor;
      const la = (active: boolean, done: boolean) => active ? 0.6 : done ? 0.45 : 0.1;

      // Edges: input → FHE
      for (const inp of inputNodes) {
        for (const fhe of fheNodes) {
          const active = phase >= 0, done = phase > 0;
          ctx.strokeStyle = `rgba(${active ? "200,71,43" : done ? "111,175,142" : "120,100,80"},${la(active, done)})`;
          ctx.lineWidth = active ? 1.2 : 0.7;
          ctx.setLineDash(active ? [4, 4] : []);
          ctx.lineDashOffset = active ? -(t * 0.8) : 0;
          ctx.beginPath(); ctx.moveTo(inp.x + nodeR, inp.y); ctx.lineTo(fhe.x - 14, fhe.y); ctx.stroke();
        }
      }
      ctx.setLineDash([]);

      // Edges: FHE → circuit
      for (const fhe of fheNodes) {
        const active = phase >= 1, done = phase > 1;
        ctx.strokeStyle = `rgba(${active ? "200,71,43" : done ? "111,175,142" : "120,100,80"},${la(active, done)})`;
        ctx.lineWidth = active ? 1.5 : 0.8;
        ctx.setLineDash(active ? [5, 4] : []);
        ctx.lineDashOffset = active ? -(t * 1.0) : 0;
        ctx.beginPath(); ctx.moveTo(fhe.x + 14, fhe.y); ctx.lineTo(circuitNode.x - 16, circuitNode.y); ctx.stroke();
      }
      ctx.setLineDash([]);

      // Edge: circuit → proof
      const pActive = phase >= 2, pDone = phase > 2;
      ctx.strokeStyle = `rgba(${pActive ? "200,71,43" : pDone ? "111,175,142" : "120,100,80"},${la(pActive, pDone)})`;
      ctx.lineWidth = pActive ? 2.0 : 0.9;
      ctx.setLineDash(pActive ? [6, 4] : []);
      ctx.lineDashOffset = pActive ? -(t * 1.2) : 0;
      ctx.beginPath(); ctx.moveTo(circuitNode.x + 18, circuitNode.y); ctx.lineTo(proofNode.x - nodeR - 4, proofNode.y); ctx.stroke();
      ctx.setLineDash([]);

      // Input nodes
      for (let i = 0; i < inputNodes.length; i++) {
        const n = inputNodes[i]; const active = phase >= 0, done = phase > 0;
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, nodeR);
        grd.addColorStop(0, active ? "rgba(200,71,43,.9)" : done ? "rgba(111,175,142,.7)" : idleColor);
        grd.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(n.x, n.y, nodeR, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();
        ctx.strokeStyle = nc(active, done); ctx.lineWidth = 1.5; ctx.stroke();
        if (recs[i]) {
          const addr = recs[i].addr;
          ctx.font = `10px 'IBM Plex Mono', monospace`;
          ctx.fillStyle = nc(active, done); ctx.textAlign = "right"; ctx.textBaseline = "middle";
          ctx.fillText(addr.slice(0, 10) + "…", n.x - nodeR - 4, n.y);
        }
      }

      // FHE nodes
      for (const fhe of fheNodes) {
        const active = phase >= 1, done = phase > 1;
        ctx.beginPath(); ctx.arc(fhe.x, fhe.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = active ? "rgba(200,71,43,.18)" : done ? "rgba(111,175,142,.14)" : (dk ? "rgba(40,30,18,.8)" : "rgba(240,234,220,.8)");
        ctx.fill(); ctx.strokeStyle = nc(active, done); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.font = `bold 10px 'IBM Plex Mono', monospace`;
        ctx.fillStyle = nc(active, done); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(fhe.label, fhe.x, fhe.y);
      }

      // Circuit node
      const cActive = phase >= 1, cDone = phase > 1;
      ctx.beginPath(); ctx.arc(circuitNode.x, circuitNode.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = cActive ? "rgba(200,71,43,.15)" : cDone ? "rgba(111,175,142,.12)" : (dk ? "rgba(30,20,10,.8)" : "rgba(248,244,234,.8)");
      ctx.fill(); ctx.strokeStyle = nc(cActive, cDone); ctx.lineWidth = 2; ctx.stroke();
      ctx.font = `9px 'IBM Plex Mono', monospace`;
      ctx.fillStyle = nc(cActive, cDone); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("CIRCUIT", circuitNode.x, circuitNode.y);

      // Proof node
      const pA2 = phase >= 2, pD2 = phase >= 3;
      const pulseR = 24 + (pD2 ? Math.sin(t * 0.08) * 2 : 0);
      ctx.beginPath(); ctx.arc(proofNode.x, proofNode.y, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = pD2 ? "rgba(111,175,142,.2)" : pA2 ? "rgba(200,71,43,.15)" : (dk ? "rgba(30,20,10,.8)" : "rgba(248,244,234,.8)");
      ctx.fill(); ctx.strokeStyle = pD2 ? doneColor : nc(pA2, false); ctx.lineWidth = pD2 ? 2.5 : 2; ctx.stroke();
      ctx.font = `bold 11px 'IBM Plex Mono', monospace`;
      ctx.fillStyle = pD2 ? doneColor : nc(pA2, false); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(pD2 ? "✓" : "PROOF", proofNode.x, proofNode.y - (pD2 ? 0 : 3));
      if (pD2) { ctx.font = `9px 'IBM Plex Mono', monospace`; ctx.fillText("VALID", proofNode.x, proofNode.y + 10); }

      // Column labels
      ctx.font = `9px 'IBM Plex Mono', monospace`; ctx.textAlign = "center";
      ctx.fillStyle = dk ? "rgba(244,234,212,.3)" : "rgba(18,16,13,.25)";
      ctx.fillText("RECIPIENTS", c0, H - 8);
      ctx.fillText("FHE OPS", c1, H - 8);
      ctx.fillText("CIRCUIT", c2, H - 8);
      ctx.fillText("PROOF", c3, H - 8);

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
      style={{ width: "100%", height: "260px", display: "block", borderRadius: 6 }}
    />
  );
}
