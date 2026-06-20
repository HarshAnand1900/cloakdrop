import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "wagmi";
import { WALLETCONNECT_PROJECT_ID } from "./constants";

export const wagmiConfig = getDefaultConfig({
  appName: "Cloakdrop",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com"),
  },
  ssr: true,
});
