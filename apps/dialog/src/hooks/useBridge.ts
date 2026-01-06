import { Env } from '@porto/apps'
import { useQuery } from '@tanstack/react-query'
import { type Dispatch, type SetStateAction, useState } from 'react'
import { type Address, parseAbiItem } from 'viem'
import { riseTestnet } from 'viem/chains'
import { useSendCallsSync } from 'wagmi'
import { porto } from '~/lib/Porto'
import type {
  BridgeState,
  BridgeToken,
} from '~/routes/-components/GlobalDeposit'

export type UseBridgeParams = {
  selectedChainId?: number
  selectedToken?: BridgeToken
  tokenBalance?: bigint
  amount?: bigint
  setBridgeState: Dispatch<SetStateAction<BridgeState>>
  account: Address
}

export function useBridge(params: UseBridgeParams) {
  const { selectedChainId, selectedToken, setBridgeState, amount, account } =
    params

  const targetChainId = Env.get() === 'prod' ? riseTestnet.id : riseTestnet.id // TODO: mainnet release switch chain id for prod

  const [data, setData] = useState<any>()
  const [error, setError] = useState<Error | undefined>()

  // Get available chains
  const { data: chains } = useQuery({
    queryFn: () => {
      // Filter out the target chain from available chains
      return porto._internal.config.chains.filter((c) => c.id !== targetChainId)
    },
    queryKey: ['bridge-chains', targetChainId],
  })

  const { sendCallsSyncAsync } = useSendCallsSync({
    mutation: {
      retry: false,
    },
  })

  // Bridge function
  const bridge = async () => {
    if (!selectedChainId || !selectedToken || !amount) return

    setData(undefined)
    setError(undefined)

    setBridgeState({
      sourceChainId: selectedChainId,
      status: 'source-pending',
    })

    try {
      const response = await sendCallsSyncAsync({
        calls: [
          {
            abi: [
              parseAbiItem('function approve(address spender, uint256 amount)'),
            ],
            args: [selectedToken.bridgeWrapper, amount],
            functionName: 'approve',
            to: selectedToken.address,
          },
          {
            abi: [
              parseAbiItem(
                'function bridgeLayerZero(address _bridge, uint256 _amoun, address _recipient)',
              ),
            ],
            args: [selectedToken.bridgeContract, amount, account],
            functionName: 'bridgeLayerZero',
            to: selectedToken.bridgeWrapper,
          },
        ],
        chainId: selectedChainId as never,
        timeout: 60_000,
      })

      // Get transaction hash from receipts
      const sourceTxHash = response.receipts?.[0]?.transactionHash

      console.log('response-bridging::', response)
      console.log('response-sourceTxHash::', sourceTxHash)

      if (response.status === 'failure') {
        setBridgeState((prev) => ({
          ...prev,
          message: `Status: ${response.status} with code ${response.statusCode}`,
          sourceTxHash,
          status: 'source-failed',
        }))
      } else {
        setBridgeState((prev) => ({
          ...prev,
          sourceTxHash,
          status: 'source-confirmed',
        }))
      }

      setData(response)
      return response
    } catch (e) {
      const error = e as Error
      console.log('error-bridging::', error)

      setError(error)
      setBridgeState((prev) => ({
        ...prev,
        message: typeof error.cause === 'string' ? error.cause : error.message,
        status: 'failed',
      }))
    }
  }

  return {
    bridge,
    chains,
    data,
    error,
    targetChainId,
  }
}
