---
"porto": patch
---

**Breaking**: Modified SIWE `/nonce` endpoint to use a `POST` method instead of `GET`.

```diff
- app.get('/siwe/nonce', ...)
+ app.post('/siwe/nonce', ...)
```
