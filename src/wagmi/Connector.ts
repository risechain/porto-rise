import {
  ChainNotConfiguredError,
  type Connector,
  createConnector,
} from '@wagmi/core'
import {
  type Address,
  numberToHex,
  type ProviderConnectInfo,
  type RpcError,
  SwitchChainError,
  UserRejectedRequestError,
  withRetry,
} from 'viem'
import * as z from 'zod/mini'
import type * as Chains from '../core/Chains.js'
import type { ExactPartial } from '../core/internal/types.js'
import type * as Porto from '../core/Porto.js'
import * as RpcSchema from '../core/RpcSchema.js'

export type PortoParameters<
  chains extends readonly [Chains.Chain, ...Chains.Chain[]] = readonly [
    Chains.Chain,
    ...Chains.Chain[],
  ],
> = ExactPartial<Porto.Config<chains>>

export function riseWallet<
  const chains extends readonly [Chains.Chain, ...Chains.Chain[]],
>(parameters: PortoParameters<chains> = {}) {
  type Provider = ReturnType<typeof Porto.create>['provider']
  type Properties = {
    connect<withCapabilities extends boolean = false>(parameters?: {
      chainId?: number | undefined
      capabilities?:
        | (RpcSchema.wallet_connect.Capabilities & {
            force?: boolean | undefined
          })
        | undefined
      isReconnecting?: boolean | undefined
      withCapabilities?: withCapabilities | boolean | undefined
    }): Promise<{
      accounts: withCapabilities extends true
        ? readonly {
            address: Address
            capabilities: RpcSchema.wallet_connect.ResponseCapabilities
          }[]
        : readonly Address[]
      chainId: number
    }>
    getPortoInstance(): Promise<
      Porto.RiseWallet<readonly [Chains.Chain, ...Chains.Chain[]]>
    >
    onConnect(connectInfo: ProviderConnectInfo): void
  }

  return createConnector<Provider, Properties>((wagmiConfig) => {
    const chains = wagmiConfig.chains ?? parameters.chains ?? []

    const transports = (() => {
      if (wagmiConfig.transports) return wagmiConfig.transports
      return parameters.transports
    })()

    let porto_promise: Promise<any> | undefined

    let accountsChanged: Connector['onAccountsChanged'] | undefined
    let chainChanged: Connector['onChainChanged'] | undefined
    let connect: Connector['onConnect'] | undefined
    let disconnect: Connector['onDisconnect'] | undefined

    return {
      async connect({ chainId = chains[0].id, ...rest } = {}) {
        const isReconnecting =
          ('isReconnecting' in rest && rest.isReconnecting) || false
        const withCapabilities =
          ('withCapabilities' in rest && rest.withCapabilities) || false

        let accounts: readonly (Address | { address: Address })[] = []
        let currentChainId: number | undefined

        if (isReconnecting) {
          ;[accounts, currentChainId] = await Promise.all([
            this.getAccounts().catch(() => []),
            this.getChainId().catch(() => undefined),
          ])
          if (chainId && currentChainId !== chainId) {
            const chain = await this.switchChain!({ chainId }).catch(
              (error) => {
                if (error.code === UserRejectedRequestError.code) throw error
                return { id: currentChainId }
              },
            )
            currentChainId = chain?.id ?? currentChainId
          }
        }

        const provider = (await this.getProvider()) as Provider

        try {
          if (!accounts?.length && !isReconnecting) {
            const res = await provider.request({
              method: 'wallet_connect',
              params: [
                {
                  ...('capabilities' in rest
                    ? {
                        capabilities: z.encode(
                          RpcSchema.wallet_connect.Capabilities,
                          rest.capabilities ?? {},
                        ),
                      }
                    : {}),
                  chainIds: [
                    numberToHex(chainId),
                    ...chains
                      .filter((x) => x.id !== chainId)
                      .map((x) => numberToHex(x.id)),
                  ],
                },
              ],
            })
            accounts = res.accounts
            currentChainId = Number(res.chainIds[0])
          }

          if (!currentChainId) throw new ChainNotConfiguredError()

          // Manage EIP-1193 event listeners
          // https://eips.ethereum.org/EIPS/eip-1193#events
          if (connect) {
            provider.removeListener?.('connect', connect)
            connect = undefined
          }
          if (!accountsChanged) {
            accountsChanged = this.onAccountsChanged.bind(this)
            // Porto Provider uses Ox, which uses `readonly Address.Address[]` for `accountsChanged`,
            // while Connector `accountsChanged` is `string[]`
            provider.on?.('accountsChanged', accountsChanged as never)
          }
          if (!chainChanged) {
            chainChanged = this.onChainChanged.bind(this)
            provider.on?.('chainChanged', chainChanged)
          }
          if (!disconnect) {
            disconnect = this.onDisconnect.bind(this)
            provider.on?.('disconnect', disconnect)
          }

          return {
            accounts: accounts.map((account) => {
              if (typeof account === 'object')
                return withCapabilities ? account : account.address
              return withCapabilities
                ? { address: account, capabilities: {} }
                : account
            }) as never,
            chainId: currentChainId,
          }
        } catch (err) {
          const error = err as RpcError
          if (error.code === UserRejectedRequestError.code)
            throw new UserRejectedRequestError(error)
          throw error
        }
      },
      async disconnect() {
        const provider = await this.getProvider()

        if (chainChanged) {
          provider.removeListener?.('chainChanged', chainChanged)
          chainChanged = undefined
        }
        if (disconnect) {
          provider.removeListener?.('disconnect', disconnect)
          disconnect = undefined
        }
        if (!connect) {
          connect = this.onConnect.bind(this)
          provider.on?.('connect', connect)
        }

        await provider.request({ method: 'wallet_disconnect' })
      },
      async getAccounts() {
        const provider = await this.getProvider()
        return provider.request({ method: 'eth_accounts' })
      },
      async getChainId() {
        const provider = await this.getProvider()
        const hexChainId = await provider.request({
          method: 'eth_chainId',
        })
        return Number(hexChainId)
      },
      async getPortoInstance() {
        porto_promise ??= (async () => {
          const Porto = await import('../core/Porto.js')
          return Porto.create({
            ...parameters,
            announceProvider: false,
            chains: chains as never,
            transports: transports as never,
          })
        })()
        return await porto_promise
      },
      async getProvider() {
        return (await this.getPortoInstance()).provider
      },
      icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAdQAAAHUCAYAAACDJ9lsAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAABCdSURBVHgB7d09jFTnvcfxB2Pw7oJhX1hfgXABxUps4xVuLt6OLZcuQBMwjaOsJeMC6V4pF0pzmyu5IYWlpLGUynGJu4s7m+qi3MYFkXARAoowwQ424Fcyz+AJa7zszs7+Z+ac83w+0siYdNHsfv2cc+Y3m37z678+TADAhjyTAIANE1QACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACCCoABBAUAEggKACQABBBYAAggoAAQQVAAIIKgAEEFQACPBsgi789zt7EvTizu3v0/37P6QH9x62Xj+km9e/bf/5xvVvWn/+rv130ASCCvTVxNTmNJE2/+vfZ+dGfvK/56DeaIX106tfp2ut16dXv0lQR4IKDNXI2DNp/8zW9mshPd/+u2utqF65fK8d2M9bJ1yoA0EFKqcT2ExcqQtBBSpteVxzWP+v9XJZmCoSVKA2Dh4aa7/yg06XLt5tBxaqwsdmgNrJDzodPTWe/uP8v7UDC1UgqEBtCStVIqhA7XXCemJpMo1PbU4wDO6hAo2RP+OaX/n+an7BIDmh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',
      id: 'com.risechain.wallet',
      async isAuthorized() {
        try {
          // Use retry strategy as some injected wallets (e.g. MetaMask) fail to
          // immediately resolve JSON-RPC requests on page load.
          const accounts = await withRetry(() => this.getAccounts())
          return !!accounts.length
        } catch {
          return false
        }
      },
      name: 'Rise Wallet',
      async onAccountsChanged(accounts) {
        wagmiConfig.emitter.emit('change', {
          accounts: accounts as readonly Address[],
        })
      },
      onChainChanged(chain) {
        const chainId = Number(chain)
        wagmiConfig.emitter.emit('change', { chainId })
      },
      async onConnect(connectInfo) {
        const accounts = await this.getAccounts()
        if (accounts.length === 0) return

        const chainId = Number(connectInfo.chainId)
        wagmiConfig.emitter.emit('connect', { accounts, chainId })

        // Manage EIP-1193 event listeners
        const provider = await this.getProvider()
        if (provider) {
          if (connect) {
            provider.removeListener?.('connect', connect)
            connect = undefined
          }
          if (!accountsChanged) {
            accountsChanged = this.onAccountsChanged.bind(this)
            // Porto Provider uses Ox, which uses `readonly Address.Address[]` for `accountsChanged`,
            // while Connector `accountsChanged` is `string[]`
            provider.on?.('accountsChanged', accountsChanged as never)
          }
          if (!chainChanged) {
            chainChanged = this.onChainChanged.bind(this)
            provider.on?.('chainChanged', chainChanged)
          }
          if (!disconnect) {
            disconnect = this.onDisconnect.bind(this)
            provider.on?.('disconnect', disconnect)
          }
        }
      },
      async onDisconnect(_error) {
        const provider = await this.getProvider()

        wagmiConfig.emitter.emit('disconnect')

        // Manage EIP-1193 event listeners
        if (provider) {
          if (chainChanged) {
            provider.removeListener?.('chainChanged', chainChanged)
            chainChanged = undefined
          }
          if (disconnect) {
            provider.removeListener?.('disconnect', disconnect)
            disconnect = undefined
          }
          if (!connect) {
            connect = this.onConnect.bind(this)
            provider.on?.('connect', connect)
          }
        }
      },
      async setup() {
        if (!connect) {
          const provider = await this.getProvider()
          connect = this.onConnect.bind(this)
          provider.on?.('connect', connect)
        }
      },
      async switchChain({ chainId }) {
        const chain = chains.find((x) => x.id === chainId)
        if (!chain) throw new SwitchChainError(new ChainNotConfiguredError())

        const provider = await this.getProvider()
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: numberToHex(chainId) }],
        })

        return chain
      },
      type: 'injected',
    }
  })
}
