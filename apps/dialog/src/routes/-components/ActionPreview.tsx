import { UserAgent } from '@porto/apps'
import { Button } from '@porto/ui'
import { cx } from 'cva'
import { Value } from 'ox'
import type * as Address from 'ox/Address'
import * as React from 'react'
import type * as Quote_schema from 'rise-wallet/core/internal/relay/schema/quotes'
import { useWatchBlockNumber } from 'wagmi'
import { DepositButtons } from '~/components/DepositButtons'
import type { GuestStatus } from '~/lib/guestMode'
import type { CbPostMessageSchema } from '~/lib/onramp'
import { porto } from '~/lib/Porto'
import { ValueFormatter } from '~/utils'
import LucideInfo from '~icons/lucide/info'
import { AddFunds } from './AddFunds'
import { GuestCheckoutSection } from './GuestCheckoutSection'
import { Layout } from './Layout'

export type GuestMode = {
  status: GuestStatus
  onSignIn: () => void
  onSignUp: (email?: string) => void
}

export function ActionPreview(props: ActionPreview.Props) {
  const {
    header,
    children,
    quotes,
    error,
    queryParams,
    actions,
    account,
    onReject,
    onQuotesRefetch,
    guestMode,
  } = props

  const deficit = useDeficit(quotes, error, queryParams)
  const [showAddFunds, setShowAddFunds] = React.useState(false)

  const depositAddress = deficit?.address || account

  useWatchBlockNumber({
    chainId: deficit?.chainId as never,
    enabled: Boolean(deficit?.chainId && onQuotesRefetch),
    onBlockNumber() {
      onQuotesRefetch?.()
    },
  })

  if (showAddFunds && deficit)
    return (
      <AddFunds
        address={depositAddress}
        chainId={deficit.chainId}
        onApprove={() => {
          setShowAddFunds(false)
        }}
        onReject={() => {
          setShowAddFunds(false)
        }}
        value={deficit.amount?.fiat}
      />
    )

  return (
    <Layout>
      {header && <Layout.Header>{header}</Layout.Header>}
      <Layout.Content>
        {children}
        {deficit?.amount && <DeficitWarning amount={deficit.amount} />}
      </Layout.Content>
      <Layout.Footer>
        {deficit ? (
          <FundsNeededSection
            account={account}
            deficit={deficit}
            onAddFunds={() => setShowAddFunds(true)}
            onReject={onReject}
          />
        ) : guestMode && guestMode.status !== 'disabled' ? (
          <GuestCheckoutSection
            guestStatus={guestMode.status}
            onGuestSignIn={guestMode.onSignIn}
            onGuestSignUp={guestMode.onSignUp}
          />
        ) : (
          actions
        )}
        {account && <Layout.Footer.Account address={account} />}
      </Layout.Footer>
    </Layout>
  )
}

export namespace ActionPreview {
  export type Props = {
    header?: React.ReactNode
    children: React.ReactNode
    quotes?: readonly Quote[]
    delayedRender?: boolean
    error?: Error | null
    queryParams?: {
      address?: Address.Address
      chainId?: number
    }
    actions?: React.ReactNode
    account?: Address.Address
    onReject: () => void
    onQuotesRefetch?: () => void
    guestMode?: GuestMode
  }

  export type Quote = {
    assetDeficits?: Quote_schema.AssetDeficit[]
    chainId: number
    feeTokenDeficit?: bigint
  }

  export type DeficitAmount = {
    exact: string
    fiat?: string
    needed: bigint
    rounded: string
  }

  export type Deficit = {
    address?: Address.Address
    assetDeficits?: Quote_schema.AssetDeficit[]
    chainId?: number
    feeTokenDeficit?: bigint
    amount?: DeficitAmount
  }

  export const delayedRenderDuration = 1000
}

function DeficitWarning(props: DeficitWarning.Props) {
  const { amount } = props
  return (
    <div className="mt-[8px] flex w-full items-center justify-between rounded-th_medium border border-th_warning bg-th_warning px-3 py-[10px]">
      <span className="text-[11.5px] text-th_base-secondary">You need</span>
      <div className="flex items-center gap-2 text-[14px]">
        <span className="font-medium text-th_warning" title={amount.exact}>
          {amount.rounded}
        </span>
        {amount.fiat && (
          <span className="text-th_base-secondary">{amount.fiat}</span>
        )}
        <LucideInfo className="size-3.5 text-th_base-secondary" />
      </div>
    </div>
  )
}

namespace DeficitWarning {
  export type Props = {
    amount: ActionPreview.DeficitAmount
  }
}

function useDeficit(
  quotes: readonly ActionPreview.Quote[] | undefined,
  error: Error | null | undefined,
  params?: {
    address?: Address.Address
    chainId?: number
  },
): ActionPreview.Deficit | null {
  const deficit = React.useMemo(() => {
    const deficitQuote = quotes?.find((quote) =>
      (quote.assetDeficits ?? []).some((d) => d.deficit > 0n),
    )

    if (!deficitQuote && !error) return null

    if (deficitQuote) {
      const assetDeficits = deficitQuote.assetDeficits?.filter(
        (d) => d.deficit > 0n,
      )

      return {
        address: params?.address,
        assetDeficits,
        chainId: deficitQuote.chainId,
        feeTokenDeficit: deficitQuote.feeTokenDeficit,
      }
    }

    if (error) {
      const errorMessage =
        (error?.cause as Error)?.message ?? error?.message ?? ''

      const match = errorMessage.match(
        /required (\d+) of asset (0x[a-fA-F0-9]{40}) on chain (\d+)/,
      ) as [string, string, Address.Address, string] | null

      if (match) {
        const [, value, address, chainId] = match
        const deficit = BigInt(value)
        const assetDeficit: Quote_schema.AssetDeficit = {
          address,
          deficit,
          required: deficit,
        }
        return {
          address: params?.address,
          assetDeficits: [assetDeficit],
          chainId: Number(chainId),
        }
      }

      if (/InsufficientBalance/i.test(errorMessage))
        return {
          address: params?.address,
          chainId: params?.chainId,
        }
    }

    return null
  }, [quotes, error, params])

  const amount = React.useMemo(() => {
    if (!deficit?.assetDeficits?.length) return undefined

    const chain = deficit.chainId
      ? porto.config.chains.find((c) => c.id === deficit.chainId)
      : null

    const [firstDeficit] = deficit.assetDeficits
    if (!firstDeficit) return undefined

    const nativeCurrency = chain?.nativeCurrency
    const decimals = firstDeficit.decimals ?? nativeCurrency?.decimals ?? 18
    const symbol = firstDeficit.symbol ?? nativeCurrency?.symbol ?? 'ETH'

    const feeWithBuffer = ((deficit.feeTokenDeficit ?? 0n) * 5n) / 100n // +5% buffer
    const needed = firstDeficit.deficit + feeWithBuffer

    const exact = `${Value.format(needed, decimals)} ${symbol}`
    const rounded = `${ValueFormatter.format(needed, decimals)} ${symbol}`
    const fiat =
      firstDeficit.fiat &&
      `${firstDeficit.fiat.currency}${(Number.parseFloat(firstDeficit.fiat.value) * 1.05).toFixed(2)}`

    return { exact, fiat, needed, rounded }
  }, [deficit])

  if (!deficit) return null
  return { ...deficit, amount }
}

function FundsNeededSection(props: {
  deficit: ActionPreview.Deficit
  account?: Address.Address
  onReject: () => void
  onAddFunds: () => void
}) {
  const { deficit, account, onReject, onAddFunds } = props

  const depositAddress = deficit.address || account

  const chain = React.useMemo(() => {
    if (!deficit.chainId) return null
    return porto.config.chains.find((c) => c.id === deficit.chainId)
  }, [deficit.chainId])

  if (!deficit.assetDeficits)
    return (
      <div className="flex w-full px-3">
        <div className="flex w-full gap-[8px]">
          <Button onClick={onReject} variant="negative-secondary" width="grow">
            Cancel
          </Button>
          <Button onClick={onAddFunds} variant="primary" width="grow">
            Add funds
          </Button>
        </div>
      </div>
    )

  return (
    <div className="flex w-full flex-col gap-[10px] px-3">
      {depositAddress && (
        <DepositButtons
          address={depositAddress}
          assetDeficits={deficit.assetDeficits}
          chainId={deficit.chainId}
          nativeTokenName={chain?.nativeCurrency?.symbol}
        />
      )}
    </div>
  )
}

export function ApplePayButton(
  props: Omit<Button.Props, 'children'> & { label: string },
) {
  const { label = 'Buy with', loading } = props
  const content = (
    <div className="flex items-center gap-[6px]">
      {label}
      <svg
        className="mt-0.5 sm:mt-1"
        height="20"
        version="1.1"
        viewBox="0 0 105 43"
        width="48.84"
        x="74.32000000000001"
        xmlns="http://www.w3.org/2000/svg"
        y="7.92"
      >
        <title>Apple Logo</title>
        <g fill="none" fillRule="evenodd" stroke="none" strokeWidth="1">
          <g fill="currentColor">
            <path d="M19.4028,5.5674 C20.6008,4.0684 21.4138,2.0564 21.1998,0.0004 C19.4458,0.0874 17.3058,1.1574 16.0668,2.6564 C14.9538,3.9414 13.9688,6.0374 14.2258,8.0074 C16.1948,8.1784 18.1618,7.0244 19.4028,5.5674" />
            <path d="M21.1772,8.3926 C18.3182,8.2226 15.8872,10.0156 14.5212,10.0156 C13.1552,10.0156 11.0642,8.4786 8.8022,8.5196 C5.8592,8.5626 3.1282,10.2276 1.6342,12.8746 C-1.4378,18.1696 0.8232,26.0246 3.8112,30.3376 C5.2622,32.4716 7.0102,34.8206 9.3142,34.7366 C11.4912,34.6506 12.3442,33.3266 14.9902,33.3266 C17.6352,33.3266 18.4042,34.7366 20.7082,34.6936 C23.0972,34.6506 24.5922,32.5586 26.0422,30.4226 C27.7072,27.9906 28.3882,25.6426 28.4312,25.5126 C28.3882,25.4706 23.8232,23.7186 23.7812,18.4676 C23.7382,14.0706 27.3652,11.9786 27.5362,11.8496 C25.4882,8.8196 22.2872,8.4786 21.1772,8.3926" />
            <path d="M85.5508,43.0381 L85.5508,39.1991 C85.8628,39.2421 86.6158,39.2871 87.0158,39.2871 C89.2138,39.2871 90.4558,38.3551 91.2108,35.9581 L91.6548,34.5371 L83.2428,11.2321 L88.4368,11.2321 L94.2958,30.1421 L94.4068,30.1421 L100.2668,11.2321 L105.3278,11.2321 L96.6048,35.7141 C94.6078,41.3291 92.3208,43.1721 87.4828,43.1721 C87.1048,43.1721 85.8838,43.1271 85.5508,43.0381" />
            <path d="M42.6499,19.3555 L48.3549,19.3555 C52.6829,19.3555 55.1469,17.0255 55.1469,12.9855 C55.1469,8.9455 52.6829,6.6375 48.3769,6.6375 L42.6499,6.6375 L42.6499,19.3555 Z M49.6869,2.4425 C55.9009,2.4425 60.2289,6.7265 60.2289,12.9625 C60.2289,19.2225 55.8129,23.5285 49.5309,23.5285 L42.6499,23.5285 L42.6499,34.4705 L37.6779,34.4705 L37.6779,2.4425 L49.6869,2.4425 Z" />
            <path d="M76.5547,25.7705 L76.5547,23.9715 L71.0287,24.3275 C67.9207,24.5275 66.3007,25.6815 66.3007,27.7015 C66.3007,29.6545 67.9887,30.9195 70.6287,30.9195 C74.0027,30.9195 76.5547,28.7665 76.5547,25.7705 M61.4617,27.8345 C61.4617,23.7285 64.5917,21.3755 70.3627,21.0205 L76.5547,20.6425 L76.5547,18.8675 C76.5547,16.2705 74.8457,14.8495 71.8057,14.8495 C69.2967,14.8495 67.4777,16.1375 67.0997,18.1125 L62.6167,18.1125 C62.7497,13.9615 66.6567,10.9435 71.9387,10.9435 C77.6207,10.9435 81.3267,13.9175 81.3267,18.5345 L81.3267,34.4705 L76.7327,34.4705 L76.7327,30.6305 L76.6217,30.6305 C75.3127,33.1395 72.4267,34.7145 69.2967,34.7145 C64.6807,34.7145 61.4617,31.9625 61.4617,27.8345" />
          </g>
        </g>
      </svg>
    </div>
  )
  return (
    <div className="h-12.5 w-full pt-px">
      <Button
        {...props}
        // className="h-11! w-full! rounded-4xl! bg-black! font-medium! text-[21px]! text-white! tracking-[0.22px]! dark:bg-white! dark:text-black!"
        loading={loading ? content : undefined}
        variant="strong"
        width="grow"
      >
        {content}
      </Button>
    </div>
  )
}

export function ApplePayIframe(props: {
  loaded: boolean
  lastOrderEvent?: CbPostMessageSchema | undefined
  setLoaded: (iframeLoaded: boolean) => void
  src: string
}) {
  const { loaded, lastOrderEvent, setLoaded, src } = props
  const isMobileSafari = React.useMemo(
    () => UserAgent.isMobile() && UserAgent.isSafari(),
    [],
  )
  return (
    <iframe
      {...(!UserAgent.isFirefox() && { allow: 'payment' })}
      className={cx(
        'h-12.5 w-full overflow-hidden border-0 bg-transparent!',
        lastOrderEvent?.eventName === 'onramp_api.apple_pay_button_pressed' ||
          lastOrderEvent?.eventName === 'onramp_api.polling_start'
          ? isMobileSafari
            ? 'sr-only!'
            : 'overflow-visible! fixed inset-0 z-100 h-full!'
          : 'w-full border-0 bg-transparent',
        !loaded && 'sr-only!',
      )}
      onLoad={() => setLoaded(true)}
      src={src}
      title="Apple Pay Onramp"
    />
  )
}
