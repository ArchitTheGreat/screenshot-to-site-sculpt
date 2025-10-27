import { http, createConfig } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, base],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({ 
      projectId: '4f3c78f8891c0e7d5a3bd74ec76dfdf2'
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
})
