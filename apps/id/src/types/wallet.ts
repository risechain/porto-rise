import type { FormattedPosition } from './protocol'

/**
 * Type definitions for wallet API responses
 */
export type Balance = {
  // Define the balance structure based on your API response
  tokenId: string
  balance: string
  updatedAt: string
  symbol: string
  decimals: number
  price: number
  priceSource: string
  balanceFormatted: number
  usdValue: number
  isNative: boolean
  chainId: number
}

export type Position = {
  // Define the position structure based on your API response
  positions: FormattedPosition[]
  totalValue: number
}

export type WalletSummary = {
  account: string
  totalValue: number
  breakdown: {
    tokens: {
      value: number
      count: number
    }
    protocols: {
      value: number
      count: number
    }
  }
}

export type Call = {
  id: string
  idx: number
  to: string
  value: string
  selector: string
  functionName: string | null
  decodedArgsJson: string | null
  tokenSymbol: string | null
}

export type Intent = {
  id: string
  eoa: string
  txHash: string
  blockNumber: string
  timestamp: string
  success: boolean
  paymentAmount: string
  paymentToken: string
  payer: string
  errSelector: string
  calls: Call[]
}

export type Pagination = {
  limit: number
  offset: number
  hasMore: boolean
}

export type IntentsResponse = {
  intents: Intent[]
  pagination: Pagination
  totalCount: number
}
