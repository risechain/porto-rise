import { Button, Spinner } from '@porto/apps/components'
import { cx } from 'cva'
import { useState } from 'react'
import { useChains } from 'wagmi'
import type { Balance } from '~/types/wallet'
import { ValueFormatter } from '~/utils'
import LucideSend from '~icons/lucide/send'
import { Transfer } from './Transfer'

export type WalletBalancesProps = {
  balances?: Balance[]
  isLoading: boolean
  refetch: () => void
}

export function WalletBalances(props: Readonly<WalletBalancesProps>) {
  const { balances, isLoading, refetch } = props

  const chains = useChains()

  const [openTransferId, setOpenTransferId] = useState<string | null>(null)

  const hasBalance = balances && balances?.length !== 0

  const formatValue = (value: number | undefined) => {
    if (value === undefined) return '$0.00'
    return `$${ValueFormatter.formatToPrice(value)}`
  }

  const handleTransfer = (balance: Balance) => {
    const balanceId = `${balance.tokenId}-${balance.symbol}`
    // Toggle: if clicking the same balance, close it; otherwise open the new one
    setOpenTransferId((prev) => (prev === balanceId ? null : balanceId))
  }

  const handleCloseTransfer = (balance: Balance) => {
    const balanceId = `${balance.tokenId}-${balance.symbol}`
    if (openTransferId === balanceId) {
      setOpenTransferId(null)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray5 bg-white p-6 dark:bg-gray1">
      <h2 className="font-semibold text-lg">Wallet Balances By Chain</h2>
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Spinner className="size-6!" />
        </div>
      )}

      {!hasBalance && !isLoading && (
        <div className="">
          <p className="font-medium text-gray10 text-sm">
            You have no available balance in your wallet!
          </p>
        </div>
      )}

      {hasBalance &&
        !isLoading &&
        chains?.map((chain) => (
          <div className="" key={chain.id}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{chain.id}</h3>
                <p className="text-gray10 text-sm">
                  {balances.length} token
                  {balances.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="rounded-full bg-violet9/10 px-3 py-1">
                <p className="font-mono text-violet9 text-xs">{chain.name}</p>
              </div>
            </div>

            <div className="space-y-2">
              {balances.filter(({ chainId }) => {
                return chainId === chain.id
              }).map((balance) => {
                const balanceId = `${balance.tokenId}-${balance.symbol}`
                const isOpen = openTransferId === balanceId

                return (
                  <div key={balanceId}>
                    <div
                      className={cx(
                        'flex items-center justify-between rounded-lg border border-gray4 p-3 capitalize hover:bg-gray2',
                        isOpen && 'rounded-b-none bg-gray2',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-violet9 to-violet11">
                          <span className="font-semibold text-sm text-white">
                            {balance.symbol.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray12 text-sm">
                            {balance.symbol}
                          </p>
                          <p className="text-gray10 text-xs capitalize">
                            {balance.tokenId.replace(`${chain.id}-`, '')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <p className="font-semibold text-gray12 text-sm">
                            {balance.balanceFormatted.toFixed(4)}{' '}
                            <span className="font-normal">
                              {balance.symbol}
                            </span>
                          </p>
                          <p className="text-gray10 text-xs">
                            {formatValue(balance.usdValue)}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleTransfer(balance)}
                          size="small"
                          title="Transfer"
                        >
                          <LucideSend className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <Transfer
                      balance={balance}
                      isOpen={isOpen}
                      onClose={() => handleCloseTransfer(balance)}
                      refetch={refetch}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
    </div>
  )
}
