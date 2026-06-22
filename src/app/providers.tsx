"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { WagmiProvider, usePublicClient, useWalletClient } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { ZamaProvider } from "@zama-fhe/react-sdk";
import { RelayerWeb, SepoliaConfig, indexedDBStorage } from "@zama-fhe/sdk";
import { ViemSigner } from "@zama-fhe/sdk/viem";
import { wagmiConfig } from "@/lib/wagmi";
import { CHAIN_ID } from "@/lib/constants";
import { SottoProvider } from "@/context/SottoContext";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/**
 * Builds the FHE relayer + viem signer and exposes them via <ZamaProvider>.
 * Only mounts in the browser (the relayer spawns a WASM Web Worker).
 */
function ZamaLayer({ children }: { children: ReactNode }) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // One relayer for the app — encryption proofs are bound per-call to
  // (contract, user), so a single instance is safe across accounts.
  const relayer = useMemo(
    () =>
      new RelayerWeb({
        transports: {
          [CHAIN_ID]: { ...SepoliaConfig, network: SepoliaConfig.network },
        },
        getChainId: async () => CHAIN_ID,
      }),
    [],
  );

  // Rebuild the signer whenever the connected wallet changes.
  const signer = useMemo(() => {
    if (!publicClient) return undefined;
    return new ViemSigner({
      publicClient,
      walletClient: walletClient ?? undefined,
      ethereum:
        typeof window !== "undefined"
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((window as any).ethereum as never)
          : undefined,
    });
  }, [publicClient, walletClient]);

  if (!signer) return <>{children}</>;

  return (
    <ZamaProvider relayer={relayer} signer={signer} storage={indexedDBStorage}>
      {children}
    </ZamaProvider>
  );
}

function BootLoader() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          className="cd-spin"
          style={{
            width: 34,
            height: 34,
            margin: "0 auto 14px",
            border: "3px solid var(--border)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
          }}
        />
        <div style={{ color: "var(--fg-muted)", fontSize: 14 }}>
          Initializing Cloakdrop…
        </div>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  // Gate everything that needs browser-only providers behind mount to keep
  // hydration deterministic and the FHE worker off the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#7c5cff",
            accentColorForeground: "white",
            borderRadius: "medium",
            overlayBlur: "small",
          })}
        >
          <SottoProvider>
            {mounted ? <ZamaLayer>{children}</ZamaLayer> : <BootLoader />}
          </SottoProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
