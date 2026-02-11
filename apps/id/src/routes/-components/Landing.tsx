import { Button, LogoMark, Toast } from '@porto/apps/components'
import * as Mipd from 'mipd'
import * as MipdPostMessage from 'mipd-postmessage/child'
import * as React from 'react'
import { toast } from 'sonner'
import { useConnect, useConnectors } from 'wagmi'
import LucideCircleCheck from '~icons/lucide/circle-check'
import LucideCircleX from '~icons/lucide/circle-x'
import IconScanFace from '~icons/porto/scan-face'
import { Layout } from './Layout'

const mipdPMStore = MipdPostMessage.createStore()
const mipdStore = Mipd.createStore()

export function Landing() {
  const [connector] = useConnectors()
  const [isInjectedConnecting, setIsInjectedConnecting] = React.useState(false)
  const [isSigningIn, setIsSigningIn] = React.useState(false)
  const [isCreatingAccount, setIsCreatingAccount] = React.useState(false)
  const [rdns, setRdns] = React.useState('')
  const [email, setEmail] = React.useState('')

  const resetFlags = () => {
    setIsInjectedConnecting(false)
    setIsSigningIn(false)
    setIsCreatingAccount(false)
  }

  const connect = useConnect({
    mutation: {
      onError(error) {
        resetFlags()
        if (error.message.includes('email already verified'))
          toast.custom((t) => (
            <Toast
              className={t}
              description="Email already verified for account."
              kind="error"
              title="Create account failed"
            />
          ))
      },
      onSuccess() {
        resetFlags()
      },
    },
  })

  const parentProviders = React.useSyncExternalStore(
    mipdPMStore.subscribe,
    mipdPMStore.getProviders,
  )
  const selfProviders = React.useSyncExternalStore(
    mipdStore.subscribe,
    mipdStore.getProviders,
  )

  const providers = React.useMemo(
    () =>
      [...parentProviders, ...selfProviders].filter(
        (provider) => provider.info.rdns !== 'com.risechain.wallet',
      ),
    [parentProviders, selfProviders],
  )

  const onInjectConnect = (rdns: string) => {
    setIsInjectedConnecting(true)
    setRdns(rdns)
    connect.connect({
      capabilities: {
        createAccount: true,
        email: false,
        providerRdns: rdns,
      },
      connector: connector!,
    })
  }

  return (
    <>
      <Layout.Header left={false} right={undefined} />

      <div className="flex h-full flex-col items-center justify-between gap-y-4 rounded-xl">
        <div className="flex h-full w-full max-w-[328px] flex-col justify-center gap-y-6 max-lg:gap-y-20">
          <div className="flex flex-col items-center">
            <div className="h-[43px]">
              <LogoMark />
            </div>
            <div className="h-4" />
            <p className="text-center font-[500] text-[31px]">Sail the seas</p>
            <div className="h-2" />
            <p className="max-w-[24ch] text-center text-[18px] text-base text-gray11 tracking-[-2.8%]">
              RISE Wallet is a seamless, friendly way to use digital assets
              on-the-go.
            </p>
          </div>
          <div>
            <form
              onSubmit={async (event) => {
                event.preventDefault()
                setIsCreatingAccount(true)
                connect.connect({
                  capabilities: {
                    createAccount: { label: email },
                    email: true,
                  },
                  connector: connector!,
                })
              }}
            >
              <div className="group peer flex h-12.5 items-center rounded-xl border border-gray7 bg-gray1 py-2 pr-2 pl-4">
                <label className="sr-only" htmlFor="label">
                  Email
                </label>
                <input
                  autoCapitalize="off"
                  autoComplete="off"
                  className="w-full font-[500] text-[19px] focus:outline-none focus:ring-0"
                  maxLength={32}
                  name="label"
                  onChange={(e) => setEmail(e.target.value)}
                  pattern=".*@.*\..+"
                  placeholder="example@riselabs.xyz"
                  required
                  spellCheck={false}
                  type="email"
                  value={email}
                />
                <div className="hidden rounded-full bg-successTint p-2 group-has-[:valid]:block">
                  <LucideCircleCheck className="size-5 text-success" />
                </div>
                <div className="hidden rounded-full bg-destructiveTint p-2 group-has-[:user-invalid]:block">
                  <LucideCircleX className="size-5 text-destructive" />
                </div>
              </div>

              <div className="mt-3 hidden w-full rounded-full bg-red3 p-2 text-center text-[15px] text-red9 leading-[24px] -tracking-[2.8%] peer-has-[:user-invalid]:block">
                This email is not a valid one.
              </div>

              <div className="h-4" />

              <Button
                className="h-12.5! w-full rounded-xl! bg-gray12! text-gray1! text-lg! hover:bg-gray12/90! data-[connecting=true]:animate-pulse"
                data-connecting={isCreatingAccount}
                type="submit"
                variant="default"
              >
                {isCreatingAccount
                  ? 'Creating account...'
                  : 'Create account via Passkey'}
              </Button>
            </form>

            <div className="h-3" />

            {providers?.length > 0 && (
              <>
                <div className="h-3.5 border-gray7 border-b-1 text-center">
                  <span className="my-auto bg-gray2 px-2 font-[500] text-gray10">
                    or
                  </span>
                </div>

                <div className="rounded-xl p-8 text-center">
                  Use Injected Signer
                  <div className="flex items-center justify-center gap-2 p-3">
                    {providers?.map((provider) => {
                      return (
                        <button
                          className="rounded-xl border border-gray7 p-2 hover:bg-gray3 focus:outline-none focus:ring-2 focus:ring-gray8 data-[connecting=true]:animate-bounce"
                          data-connecting={
                            isInjectedConnecting && provider.info.rdns === rdns
                          }
                          key={provider.info.uuid}
                          onClick={(event) => {
                            onInjectConnect(provider.info.rdns)
                            event.preventDefault()
                          }}
                          type="button"
                        >
                          <img
                            alt={provider.info.name}
                            height={40}
                            src={provider.info.icon}
                            width={40}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="h-3.5 border-gray7 border-b-1 text-center">
              <span className="my-auto bg-gray2 px-2 font-[500] text-gray10">
                or
              </span>
            </div>

            <div className="h-6" />

            <Button
              className="flex h-12.5! w-full items-center gap-2 rounded-xl! text-lg! data-[connecting=true]:animate-pulse"
              data-connecting={isSigningIn}
              onClick={() => {
                setIsSigningIn(true)
                return connect.connect({
                  capabilities: {
                    createAccount: false,
                    selectAccount: true,
                  },
                  connector: connector!,
                })
              }}
              type="button"
              variant="accent"
            >
              <IconScanFace className="size-5.25" />
              {isSigningIn ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </div>
      </div>

      <Layout.IntegrateFooter />
    </>
  )
}
