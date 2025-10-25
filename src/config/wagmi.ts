import { http, createConfig } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, base],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({ 
      projectId: 'your_project_id_here' // Replace with your WalletConnect project ID
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
})
