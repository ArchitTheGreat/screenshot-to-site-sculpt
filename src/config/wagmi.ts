import { createConfig, http } from 'wagmi'
import { mainnet, base } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

// Get WalletConnect Project ID from environment variables
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

export const config = createConfig({
  chains: [mainnet, base] as const,
  connectors: [
    injected(),
    metaMask(),
    // Only include WalletConnect if project ID is configured
    ...(walletConnectProjectId ? [walletConnect({
      projectId: walletConnectProjectId,
      metadata: {
        name: 'KryptoGain',
        description: 'Crypto Tax Calculator',
        url: window.location.origin,
        icons: [`${window.location.origin}/Logo.png`]
      },
      showQrModal: true,
    })] : []),
  ],
  transports: {
    [mainnet.id]: http(`https://1.rpc.thirdweb.com`),
    [base.id]: http(`https://8453.rpc.thirdweb.com`),
  },
})
