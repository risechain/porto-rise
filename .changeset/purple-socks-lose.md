---
"porto": patch
---

Fixed issue where a cached `chainId`s could become stale if a consumer omitted the target
chain from the `chains` configuration.
