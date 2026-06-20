import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Zama + TokenOps SDKs ship modern ESM that Next needs to transpile.
  transpilePackages: ["@tokenops/sdk", "@zama-fhe/sdk", "@zama-fhe/react-sdk"],

  webpack: (config) => {
    // The FHE relayer runs WASM inside a Web Worker; enable async WASM and
    // stub Node-only builtins so the browser bundle resolves cleanly.
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
