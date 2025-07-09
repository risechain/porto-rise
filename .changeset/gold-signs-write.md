---
"porto": patch
---

**Breaking:** Removed `permissionsFeeLimit` on `Mode.rpcServer` in favor of:

- `feeLimit` on the `wallet_grantPermissions` request
- `feeLimit` on the `grantPermissions` capability
