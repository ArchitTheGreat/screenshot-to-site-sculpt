import { http, createConfig } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

// Get WalletConnect Project ID from environment variables
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

export const config = createConfig({
  chains: [mainnet, base],
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
      showQrModal: true
    })] : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
})
