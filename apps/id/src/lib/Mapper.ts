import type { Asset } from '~/types/asset'
import type { Balance } from '~/types/wallet'

/**
 * Converts an Asset to a Balance
 * @param asset - The asset to convert
 * @param price - The current price of the token (default: 0)
 * @param priceSource - The source of the price data (default: 'unknown')
 * @returns Balance object
 */
export function assetToBalance(
  asset: Asset,
  price = 0,
  priceSource = 'unknown',
): Balance {
  // Get token metadata based on type
  const symbol =
    asset.type === 'erc20' ? asset?.metadata?.symbol || 'UNKNOWN' : 'ETH' // or whatever native token symbol for the chain

  const decimals =
    (asset.type === 'erc20' ? asset?.metadata?.decimals : 18) ?? 18 // Native tokens typically have 18 decimals

  // Convert bigint balance to formatted number
  const balanceFormatted = Number(asset.balance) / 10 ** decimals

  // Calculate USD value
  const usdValue = balanceFormatted * price

  return {
    balance: asset.balance.toString(),
    balanceFormatted,
    chainId: asset.chainId,
    decimals,
    isNative: asset.isNative ?? false,
    price,
    priceSource,
    symbol,
    tokenId: asset.address,
    updatedAt: new Date().toISOString(),
    usdValue,
  }
}

/**
 * Converts an array of Assets to WalletBalancesProps structure
 * @param assets - Array of assets to convert
 * @param prices - Optional map of token addresses to prices
 * @param isLoading - Loading state
 * @param refetch - Refetch function
 * @returns WalletBalancesProps object
 */
export function assetsToWalletBalances(
  assets: Asset[],
  prices: Map<string, { price: number; source: string }>,
) {
  const balances = assets.map((asset) => {
    const priceData = prices.get(asset.address) || {
      price: 0,
      source: 'unknown',
    }
    return assetToBalance(asset, priceData.price, priceData.source)
  })

  return {
    balances,
  }
}
