"use client";
import type React from "react";

export function Skeleton({ w, h = 16, radius = 3, className, style }: { w?: number | string; h?: number; radius?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`skeleton ${className || ""}`}
      style={{ width: w ?? "100%", height: h, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 22px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ flex: 2, display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton w={6} h={32} />
        <div style={{ flex: 1 }}>
          <Skeleton h={18} w="60%" />
          <Skeleton h={11} w="40%" style={{ marginTop: 5 }} />
        </div>
      </div>
      <Skeleton w={50} h={13} />
      <Skeleton w={24} h={13} />
      <Skeleton w={60} h={10} />
      <Skeleton w={44} h={20} radius={2} />
      <Skeleton w={60} h={13} />
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="s-card" style={{ padding: 22 }}>
      <Skeleton h={11} w="40%" style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} h={i === 0 ? 48 : 13} w={i === 0 ? "35%" : `${50 + i * 15}%`} style={{ marginBottom: i < lines - 1 ? 8 : 0 }} />
      ))}
    </div>
  );
}
