---
paths:
  - "workers/**/*.ts"
---
# Cloudflare Worker Rules
- Runtime: Cloudflare Workers (V8 isolate, NOT Node.js)
- No Node.js built-ins: no fs, no path, no Buffer (use Uint8Array)
- Crypto: use crypto.subtle (Web Crypto API), not crypto module
- Database: D1 via env.DB binding, parameterized queries only (SQL injection prevention)
- HMAC: crypto.subtle.importKey + crypto.subtle.sign/verify
- All inbound webhooks MUST verify HMAC-SHA256 signature before processing
- All responses include CORS headers for local development
- Error responses: { "error": string, "code": number } with appropriate HTTP status
- Rate limiting: track per installation_id, reject >10 requests/minute
- Idempotency: register-installation is idempotent (upsert on installation_id)
- Testing: use vitest with miniflare for local Worker simulation
- Deployment: wrangler deploy (never manual)
- D1 migrations: numbered SQL files in migrations/ directory
