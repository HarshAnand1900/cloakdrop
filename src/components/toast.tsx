"use client";

import { useSyncExternalStore } from "react";

export type ToastKind = "info" | "success" | "error";
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  href?: string;
  hrefLabel?: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function toast(
  message: string,
  opts: { kind?: ToastKind; href?: string; hrefLabel?: string; ttl?: number } = {},
) {
  const id = nextId++;
  const t: Toast = {
    id,
    message,
    kind: opts.kind ?? "info",
    href: opts.href,
    hrefLabel: opts.hrefLabel,
  };
  toasts = [...toasts, t];
  emit();
  const ttl = opts.ttl ?? (opts.kind === "error" ? 8000 : 5500);
  setTimeout(() => dismiss(id), ttl);
  return id;
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function snapshot() {
  return toasts;
}

const empty: Toast[] = [];

export function ToastViewport() {
  const items = useSyncExternalStore(subscribe, snapshot, () => empty);
  return (
    <div
      style={{
        position: "fixed",
        bottom: 18,
        right: 18,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 380,
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="cd-card cd-fade"
          style={{
            padding: "0.7rem 0.85rem",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            borderColor:
              t.kind === "error"
                ? "rgba(255,93,108,0.4)"
                : t.kind === "success"
                  ? "rgba(54,211,153,0.4)"
                  : "var(--border)",
            boxShadow: "0 12px 40px -16px rgba(0,0,0,0.7)",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: "20px" }}>
            {t.kind === "error" ? "⚠️" : t.kind === "success" ? "✅" : "ℹ️"}
          </span>
          <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>
            <div>{t.message}</div>
            {t.href && (
              <a
                className="cd-link"
                href={t.href}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12.5 }}
              >
                {t.hrefLabel ?? "View ↗"}
              </a>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "var(--fg-faint)",
              cursor: "pointer",
              fontSize: 15,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
