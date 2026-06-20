"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Logo } from "./Logo";

const links = [
  { href: "/distribute", label: "Distribute" },
  { href: "/claim", label: "Claim" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        borderBottom: "1px solid var(--border-soft)",
        background: "color-mix(in srgb, var(--bg) 80%, transparent)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0.7rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            textDecoration: "none",
            color: "var(--fg)",
          }}
        >
          <Logo size={26} />
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: -0.3 }}>
            Cloakdrop
          </span>
        </Link>

        <nav
          style={{
            display: "flex",
            gap: 4,
            marginLeft: 12,
          }}
        >
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: 9,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  color: active ? "var(--fg)" : "var(--fg-muted)",
                  background: active ? "var(--panel-2)" : "transparent",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginLeft: "auto" }}>
          <ConnectButton
            chainStatus="icon"
            showBalance={false}
            accountStatus="address"
          />
        </div>
      </div>
    </header>
  );
}
