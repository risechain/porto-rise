---
"porto": patch
---

**Breaking:** Added required `feeLimit` property on `wallet_grantPermissions`. This is a spend permission that will be used to pay for fees used by permissions in the user's selected fee token (e.g. USDC).

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
