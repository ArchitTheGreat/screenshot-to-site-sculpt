import { createConfig, configureChains } from 'wagmi'
import { mainnet, base } from 'wagmi/chains'
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { MetaMaskConnector } from 'wagmi/connectors/metaMask'
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'

// Get WalletConnect Project ID from environment variables
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet, base],
  [
    jsonRpcProvider({
      rpc: (chain) => ({
        http: `https://${chain.id}.rpc.thirdweb.com`,
      }),
    }),
  ]
)

export const config = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({ chains }),
    new MetaMaskConnector({ chains }),
    // Only include WalletConnect if project ID is configured
    ...(walletConnectProjectId ? [new WalletConnectConnector({
      chains,
      options: {
        projectId: walletConnectProjectId,
        metadata: {
          name: 'KryptoGain',
          description: 'Crypto Tax Calculator',
          url: window.location.origin,
          icons: [`${window.location.origin}/Logo.png`]
        },
        showQrModal: true
      }
    })] : []),
  ],
  publicClient,
  webSocketPublicClient,
})

export { chains }
