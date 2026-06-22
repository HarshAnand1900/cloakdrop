"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

interface Props {
  text: string;
  children: ReactNode;
  position?: "top" | "bottom" | "right";
  maxWidth?: number;
}

export function Tooltip({ text, children, position = "top", maxWidth = 260 }: Props) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  function show() {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const tip = tipRef.current;
    const tw = tip ? tip.offsetWidth || maxWidth : maxWidth;
    let top = 0, left = 0;
    if (position === "top") { top = r.top - 8; left = r.left + r.width / 2 - tw / 2; }
    else if (position === "bottom") { top = r.bottom + 8; left = r.left + r.width / 2 - tw / 2; }
    else { top = r.top + r.height / 2; left = r.right + 8; }
    setCoords({ top: top + window.scrollY, left: Math.max(8, left + window.scrollX) });
    setVisible(true);
  }

  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
    document.addEventListener("scroll", hide, true);
    return () => document.removeEventListener("scroll", hide, true);
  }, [visible]);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
      onFocus={show}
      onBlur={() => setVisible(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: 3, cursor: "default" }}
    >
      {children}
      {visible && (
        <div
          ref={tipRef}
          role="tooltip"
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            zIndex: 999,
            maxWidth,
            background: "#12100D",
            color: "#F4EAD4",
            fontSize: 12.5,
            lineHeight: 1.55,
            padding: "9px 13px",
            borderRadius: 4,
            boxShadow: "0 4px 20px rgba(0,0,0,.45)",
            pointerEvents: "none",
            animation: "popIn .15s ease both",
            transform: position === "top" ? "translateY(-100%)" : position === "right" ? "translateY(-50%)" : "none",
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

/* Reusable info icon with built-in tooltip */
export function InfoTip({ text, maxWidth }: { text: string; maxWidth?: number }) {
  return (
    <Tooltip text={text} maxWidth={maxWidth}>
      <span
        aria-label={text}
        tabIndex={0}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 14, height: 14, borderRadius: "50%",
          border: "1px solid var(--soft)", color: "var(--soft)",
          fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
          flexShrink: 0, userSelect: "none", cursor: "help",
        }}
      >i</span>
    </Tooltip>
  );
}
