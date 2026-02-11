import { Separator } from '@ariakit/react'
import { Input } from '@porto/apps/components'
import { Button, Deposit } from '@porto/ui'
import { Value } from 'ox'
import { useEffect, useMemo, useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { riseTestnet } from 'viem/chains'
import { useAccount, useReadContract } from 'wagmi'
import { useFundsContext } from '~/contexts'
import { useBridge, useDestinationAsset, useWalletAsset } from '~/hooks'
import ArrowLeft from '~icons/lucide/arrow-left'
import { Layout } from '../Layout'
import { DropdownSelector, getAssets, SupportedChains } from '.'
import { Bridge, type BridgeState } from './Bridge'

export function GlobalDeposit() {
  const {
    address,
    amount,
    selectedAsset,
    selectedChain,
    setAmount,
    setSelectedAsset,
    setSelectedChain,
    setView,
  } = useFundsContext()

  const { chainId } = useAccount()

  const [bridgeState, setBridgeState] = useState<BridgeState>({
    status: 'idle',
  })

  const {
    balance,
    refetch: refetchBalance,
    isLoading: isWalletAssetLoading,
  } = useWalletAsset({
    address: address ?? '0x',
    chainId: selectedChain?.id,
    tokenAddress: selectedAsset?.address ?? '0x',
  })

  const tokens = getAssets(selectedChain?.id)
  // Default to RISE, add handling when on mainnet
  const destinationToken = getAssets(riseTestnet.id)

  const selectedToken = useMemo(() => {
    return tokens.find(
      (t) => t.address.toLowerCase() === selectedAsset?.address?.toLowerCase(),
    )
  }, [tokens, selectedAsset?.address])

  const {
    data: minAmounts,
    isLoading: isLoadingMinAmounts,
    isFetching: isFetchingMinAmounts,
  } = useReadContract({
    abi: [
      {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'minAmounts',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    address: selectedToken!.bridgeWrapper,
    args: [selectedToken!.bridgeContract],
    chainId: selectedChain?.id as any,
    functionName: 'minAmounts',
    query: {
      enabled:
        !!selectedToken?.bridgeWrapper && !!selectedToken?.bridgeContract,
    },
  })

  const minDepositAmount = useMemo(() => {
    if (!minAmounts || !selectedToken) return null

    return formatUnits(minAmounts, selectedToken.decimals)
  }, [minAmounts, selectedToken])

  //TODO: add balance: riseBalance,
  const { refetch: refetchRiseBalance } = useDestinationAsset({
    address: address ?? '0x',
    destinationChainId: 11155931, // TODO: Default to RISE, add handling when on mainnet
    destinationTokenAddress: destinationToken[0]?.address,
    enabled:
      bridgeState.status === 'completed' || bridgeState.status === 'failed',
    refetchInterval: bridgeState.status === 'pending' ? 2000 : false,
  })

  const { bridge, chains, targetChainId } = useBridge({
    account: address ?? '0x',
    amount: parseUnits(amount, selectedAsset?.decimals ?? 18),
    selectedChainId: selectedChain?.id,
    selectedToken,
    setBridgeState,
    tokenBalance: balance,
  })

  const amountBalance = useMemo(() => {
    if (balance) {
      return Value.format(balance, selectedAsset?.decimals)
    }

    return '0.00'
  }, [balance, selectedAsset?.decimals])

  const shouldExceedMinDeposit = useMemo(() => {
    if (!amount || !selectedToken) return false

    const minDeposit =
      minDepositAmount ??
      formatUnits(selectedToken?.minDeposit, selectedToken?.decimals)

    return Number(amount) < Number(minDeposit)
  }, [amount, selectedToken, minDepositAmount])

  const onBack = () => {
    setBridgeState({
      sourceChainId: selectedChain?.id,
      status: 'idle',
    })
    setView('global-deposit')
  }

  // Initialize with defaults if not set
  useEffect(() => {
    if (!selectedChain && SupportedChains[0]) {
      setSelectedChain(SupportedChains[0])
    }

    if (!selectedAsset && tokens[0]) {
      setSelectedAsset(tokens[0])
    }
  }, [
    selectedChain,
    setSelectedChain,
    selectedAsset,
    setSelectedAsset,
    tokens[0],
  ])

  // Show bridge progress view
  if (bridgeState.status !== 'idle') {
    return (
      <Bridge
        amount={parseUnits(amount, selectedToken?.decimals ?? 18)}
        back={() => {
          onBack()
        }}
        bridgeError={null}
        bridgeState={bridgeState}
        chains={chains}
        onNewTransaction={() => {
          refetchBalance()
          refetchRiseBalance()
          setAmount('0')
          onBack()
        }}
        onRetry={() => {
          bridge()
        }}
        selectedChain={selectedChain}
        selectedToken={selectedToken}
        targetChainId={targetChainId}
      />
    )
  }

  return (
    <Layout>
      <Layout.Header>
        <div className="flex items-center gap-2">
          <Button
            className="h-auto! rounded-full! bg-transparent! p-2!"
            onClick={() => setView('selection-network')}
            variant="secondary"
          >
            <ArrowLeft className="size-4 text-th_base" />
          </Button>
          <Layout.Header.Default
            subContent="Bridge to your RISE Wallet"
            title="Global Deposit"
            variant="default"
          />
        </div>
      </Layout.Header>
      <Layout.Content>
        <div className="flex flex-col gap-2 pt-3">
          <div className="flex-1 space-y-2 rounded-lg bg-th_base-alt p-2">
            <p className="text-sm text-th_base-secondary">Source</p>
            <DropdownSelector
              items={SupportedChains}
              onSelect={(item) => {
                setAmount('0')
                setSelectedChain(item)
                setSelectedAsset(getAssets(item.id)[0])
              }}
              selectedItem={selectedChain}
            />
          </div>
          {selectedChain?.id !== riseTestnet.id && (
            <>
              <div className="space-y-2 rounded-lg bg-th_base-alt p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-th_base-secondary">Token</p>
                    <Separator
                      className="h-4 border-th_base border-l-0.25"
                      orientation="vertical"
                    />
                    {chainId === riseTestnet.id && (
                      <a
                        className="text-sm text-th_base-secondary"
                        href="https://demo.wallet.risechain.com/mint"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Mint
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <p className="text-sm text-th_base-secondary">Balance:</p>
                    {isWalletAssetLoading ? (
                      <div className="h-4 w-20 animate-pulse rounded bg-th_base" />
                    ) : (
                      <p className="text-sm text-th_base-secondary">
                        {amountBalance}{' '}
                        <span className="font-bold">
                          {selectedAsset?.symbol}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <DropdownSelector
                  items={tokens}
                  onSelect={(item) => {
                    setAmount('0')
                    setSelectedAsset(item)
                  }}
                  selectedItem={selectedAsset}
                />
              </div>

              <div className="space-y-2 rounded-lg bg-th_base-alt p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-th_base-secondary">Amount</p>
                  {selectedToken && (
                    <div className="flex gap-2">
                      <p className="text-sm text-th_base-secondary">
                        Minimum Deposit:
                      </p>
                      {isLoadingMinAmounts || isFetchingMinAmounts ? (
                        <div className="h-4 w-16 animate-pulse rounded bg-th_base" />
                      ) : (
                        <p className="text-sm text-th_base-secondary">
                          <span>
                            {minDepositAmount ??
                              formatUnits(
                                selectedToken?.minDeposit,
                                selectedToken?.decimals,
                              )}{' '}
                          </span>{' '}
                          <span className="font-bold">
                            {selectedToken?.symbol}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Input
                    className="w-full bg-th_field"
                    name="Amount"
                    onChange={(event) => {
                      const value = event.target.value
                      setAmount(value)
                    }}
                    placeholder="0.00"
                    type="number"
                    value={amount}
                  />
                  <Button
                    className="h-10! border border-th_base! bg-th_field!"
                    onClick={() => {
                      setAmount(amountBalance)
                    }}
                  >
                    Max
                  </Button>
                </div>
              </div>
            </>
          )}
          {selectedChain?.id === riseTestnet.id && (
            <Deposit
              address={address ?? ''}
              chainId={selectedChain?.id}
              label="Send tokens to this address"
            />
          )}
        </div>
      </Layout.Content>
      {selectedChain?.id !== riseTestnet.id && (
        <Layout.Footer>
          <Layout.Footer.Actions>
            <Button
              className="w-full flex-1"
              disabled={
                Number(amountBalance) === 0 ||
                Number(amount) === 0 ||
                Number(amount) > Number(amountBalance) ||
                shouldExceedMinDeposit
              }
              onClick={bridge}
              variant="primary"
            >
              Deposit to RISE
            </Button>
          </Layout.Footer.Actions>
        </Layout.Footer>
      )}
    </Layout>
  )
}
