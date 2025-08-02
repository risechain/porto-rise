import type { PortoConfig } from '@porto/apps'
import { exp1Address, exp2Address } from '@porto/apps/contracts'
import type { Address } from 'ox'
import { Chains } from 'porto'

export const CORS_DESTROYER_URL = 'https://cors.porto.workers.dev'

export function urlWithCorsBypass(url: string) {
  return `${CORS_DESTROYER_URL}?url=${url}`
}

export const ethAsset = {
  address: '0x0000000000000000000000000000000000000000',
  decimals: 18,
  logo: '/icons/eth.svg',
  name: 'Ethereum',
  symbol: 'ETH',
} as const

export const defaultAssets: Record<
  PortoConfig.ChainId,
  ReadonlyArray<{
    name: string
    logo: string
    symbol: string
    decimals: number
    address: Address.Address
    price?: number
    coingeckoId?: string
  }>
> = {
  [Chains.anvil.id]: [
    {
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      logo: '/icons/eth.svg',
      name: 'Ethereum',
      symbol: 'ETH',
    },
    {
      address: exp1Address[Chains.anvil.id],
      decimals: 18,
      logo: '/icons/exp.svg',
      name: 'Experiment',
      price: 1,
      symbol: 'EXP',
    },
    {
      address: exp2Address[Chains.anvil.id],
      decimals: 18,
      logo: '/icons/exp2.svg',
      name: 'Experiment 2',
      price: 100,
      symbol: 'EXP2',
    },
  ],
  [Chains.riseTestnet.id]: [
    {
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      logo: '/icons/eth.svg',
      name: 'Ethereum',
      symbol: 'ETH',
    }
  ]
}
