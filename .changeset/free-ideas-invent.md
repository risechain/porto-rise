---
"porto": patch
---

**Breaking:** Removed implicit fee limits (defaulting to 1 USD of the fee token) when granting permissions.

A new `feeLimit` property has been added on `wallet_grantPermissions` to assign fee limits. This converts to a spend permission that will be used to pay for fees (for permissioned calls) in the user's selected fee token (e.g. USDC).

```ts
provider.request({
  method: 'wallet_grantPermissions',
  params: [
    {
      expiry: 1715328000,
      // Assign a spend permission of $5 USD of the fee token.
      feeLimit: {
        currency: 'USD',
        value: '5',
      },
      permissions: {
        calls: [{ signature: 'mint()' }],
      },
    }
  ]
})
```
