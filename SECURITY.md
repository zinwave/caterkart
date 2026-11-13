# Security

How this system is defended, where the boundaries are, and which risks are
knowingly accepted.

## Reporting

Email **security@caterkart.in**. Please do not open a public issue for
anything exploitable. We aim to acknowledge within two business days.

---

## Authentication

Two independent identities, deliberately not unified — they authenticate
different people against different systems.

| Surface | Credential | Carried in |
|---|---|---|
| `/api/celebrations/*`, `/api/swiggy/*` | Swiggy OAuth 2.1 + PKCE | `ck_session` cookie — `httpOnly`, `Secure`, `SameSite=Lax`, HMAC-signed |
| `/api/ck/*` (CaterBox) | Phone + OTP (Twilio Verify) | Bearer JWT in `Authorization` |
| `/api/invites/:token/*` | A 144-bit invite token | The URL path |
| `/api/ck/payments/webhook` | HMAC-SHA256 over the raw body | `x-razorpay-signature` |

Swiggy access and refresh tokens **never reach the browser**. They are
encrypted at rest with AES-256-GCM (`CryptoService`) and decrypted only inside
an outbound MCP call.

## Authorization

- **Celebrations** — `CelebrationAccessService.assertHost` runs on every route
  that names a celebration, at the *service* layer, so a new controller route
  cannot acquire access by forgetting a decorator. The SSE stream is the one
  exception and uses `CelebrationHostGuard`, because `@Sse` commits `200` and
  the stream headers before a handler-level check could return a status.
- **CaterBox orders and payments** — scoped to the OTP-verified phone in the
  JWT. Never to a number in the request body or path.
- **Not-found over forbidden.** An unauthorized celebration or order answers
  `404`, identical to one that does not exist. A `403` confirms the id is real,
  which is all an enumeration attack needs.

## Defences in place

- **Rate limiting** — one global bucket (300/min/IP) with tighter per-route
  caps on anything that costs money or sends an SMS. Correctness depends on
  `trust proxy` being set to the real number of proxies (1 behind Caddy):
  trusting more lets a client forge `X-Forwarded-For` and pick its own bucket.
- **Input validation** — global `ValidationPipe` with `whitelist` and
  `forbidNonWhitelisted`. DTOs carry *bounds*, not just types: quantities,
  prices and array lengths are capped, because these values are summed into
  order totals and divided at settlement.
- **Output** — one exception filter decides what leaves the process. Prisma and
  Mongo errors are mapped by code; their messages name columns and constraints
  and are logged, never returned.
- **Logging** — structured JSON, one line per record, correlated by request id.
  Credentials and personal data go through `src/common/redact.ts`. Access logs
  carry method, path, status and duration — **never query strings**, which hold
  addresses and invite tokens.
- **Secrets** — asserted at boot (`env.validation.ts`). Production refuses to
  start on a missing secret or a `.env.example` placeholder.
- **Container** — non-root (uid 1000), pinned Prisma CLI (no install-time
  network fetch), liveness-only healthcheck.
- **Data retention** — nightly sweep deletes expired invite tokens, stale
  tracking events and year-old finished celebrations. See
  [docs/DATA-HANDLING.md](docs/DATA-HANDLING.md).

## Swiggy MCP integration

The MCP client is the single choke point for every Swiggy call
(`McpClientService`).

- Sessions are pooled per `(server, userId)` — never shared across users.
- **Placements are never retried.** `place_food_order` is not idempotent, so a
  failure raises `PlacementFailedError` and reconciles against `get_food_orders`
  rather than re-placing.
- **OAuth discovery is origin-pinned.** The discovery document names the
  endpoints that receive the authorization code, PKCE verifier and refresh
  token. Every discovered URL must be `https` and share the configured MCP
  origin, or it is ignored in favour of the documented default. Without this,
  a compromised MCP server could nominate where a live grant is sent — the
  failure described in the MCP SDK's own advisory.
- **Guest menu reads are brokered with the host's grant**, scoped to the
  celebration's bound address. A guest cannot place or pay for anything.
- Swiggy payloads are never logged verbatim; they carry the customer's name,
  phone and full delivery address.

## Accepted risks

**1. `deepmerge-ts` advisory via the Prisma CLI (high, not reachable).**
`prisma` → `@prisma/config` → `deepmerge-ts <8`. The advisory is stack
exhaustion when merging recursive object graphs. The Prisma **CLI** runs once
at container start, against our own committed schema; it is not on any request
path and processes no user input. The only fix is a major upgrade that would
break the CLI/client version match. Revisit when the Prisma 6.x line ships a
patched `@prisma/config`.

**2. `qs` advisories via Express (moderate).** DoS vectors in
`qs.stringify`/`parse` on attacker-controlled shapes. Query strings reaching
this API are short and typed through DTOs, and body size is capped at 1 MB.
Fixed upstream in the Express line; will clear on the next minor.

**3. CaterKart for Work is unauthenticated and in-memory.** Not a deployed
risk: `/api/work/*` is mounted only when `ENABLE_WORK=true`, which is off by
default and must stay off in production. It needs real authentication and real
storage before it can ship.

**4. No self-serve data erasure.** A DPDP erasure request is fulfilled by hand
today. See [docs/DATA-HANDLING.md](docs/DATA-HANDLING.md) §5.
