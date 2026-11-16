# CaterKart

Party catering in Bangalore, three ways — one repository.

| Service | Who cooks | Who you pay | Code |
|---|---|---|---|
| **Swiggy group ordering** | A Swiggy restaurant | Swiggy, on the host's own account | `src/pages/`, `server/src/{swiggy,celebrations,invites}` |
| **CaterBox meal boxes** | FSSAI-licensed partner kitchens | CaterKart, via Razorpay | `src/caterkart/`, `server/src/caterbox` |
| **CaterKart for Work** | — | — | `server/src/corporate` — **prototype, not deployed** |

The distinction matters legally as well as architecturally: in the first we are
not the seller, in the second we are. See [Terms](src/caterkart/pages/legal/index.jsx).

---

## The idea

Feeding a group is hard because everyone wants something different, and the
usual answers are bad: one person orders for everyone and gets it wrong, or
five people order separately and the food arrives an hour apart.

CaterKart's host opens a celebration and shares **one link**. Each guest picks
their own dish from real, live Swiggy menus — no account, no app, no payment
method. The backend groups the picks by restaurant, places each order on the
host's Swiggy account, and **staggers the placements by each restaurant's ETA**
so the food converges instead of trickling in. Afterwards it splits the bill and
mints a UPI link per guest.

## Architecture

```
caterkart.in        → CloudFront → S3            Vite/React SPA
www.caterkart.in    → 301 to apex, at the edge
api.caterkart.in    → Lightsail (ap-south-1)
                        Caddy      :443  auto-TLS
                        └─ api     :4000  NestJS
                           ├─ postgres    Celebrations (Prisma)
                           └─ redis       BullMQ placement + tracking queues
                        (CaterBox uses MongoDB Atlas)
```

One Nest process serves both halves and runs the BullMQ workers, because the
SSE stream and the tracking processor share an in-process subject. Splitting
api/worker requires a Redis pub/sub adapter first — see
`server/docker-compose.prod.yml`.

**Two API surfaces, two auth schemes:**

| Surface | Auth | Why |
|---|---|---|
| `/api/*` | Swiggy OAuth 2.1 + PKCE → signed `httpOnly` cookie | Swiggy already authenticates by phone + OTP; asking twice collects a number we cannot verify |
| `/api/ck/*` | Phone + OTP (Twilio) → Bearer JWT | CaterBox has nothing to do with Swiggy; requiring a Swiggy login to buy a meal box would make no sense |
| `/api/invites/:token/*` | A 144-bit token in the URL | A guest has no account at all |

## The Swiggy integration

Everything goes through the Model Context Protocol servers at `mcp.swiggy.com`
(`food`, `im`, `dineout`), brokered server-side by `McpClientService`.

**Access tokens never reach the browser.** They are encrypted at rest with
AES-256-GCM and decrypted only inside an outbound call.

Four constraints the code is built around, learned from the live API:

1. **`place_food_order` is not idempotent.** A failed placement may still have
   created an order. It is never retried; `placeReconciled` reads
   `get_food_orders` and adopts a matching order instead.
2. **₹1,000 per food order.** Enforced before placement, not after.
3. **`addressId` gates nearly every tool** — the app must bind a Swiggy address
   before anything else works.
4. **Grants last ~5 days** with a refresh token. Renewal is deduplicated per
   user so a checkout fan-out does not fire several refreshes at once.

Guests have no Swiggy account, so their menu reads are brokered with the
**host's** grant, scoped to the celebration's bound address. A guest can never
place or pay for anything.

Security properties of this integration are documented in
[SECURITY.md](SECURITY.md#swiggy-mcp-integration) — in particular, OAuth
endpoint discovery is origin-pinned so a compromised MCP server cannot
nominate where a live grant is sent.

## Getting started

```sh
# ── Frontend ──
npm install
npm run dev                      # http://localhost:5173

# ── API ──
cd server
cp .env.example .env             # then fill it in — see below
npm install
npx prisma migrate dev
npm run start:dev                # http://localhost:4000
```

**Minimum env to boot.** Every value marked `REQUIRED` in
`server/.env.example` is asserted at startup by `src/config/env.validation.ts`.
In development a missing value only warns and disables that feature; **in
production the process refuses to start**, so a deploy fails in the deploy log
rather than at a customer's checkout.

```sh
openssl rand -hex 32   # TOKEN_ENC_KEY, APP_JWT_SECRET, JWT_SECRET
```

| To work on | You need |
|---|---|
| Celebrations / Swiggy | `DATABASE_URL`, `TOKEN_ENC_KEY`, `APP_JWT_SECRET`, a Swiggy OAuth redirect registered with `builders@swiggy.in` |
| Scheduled placement | the above + `REDIS_URL` and `ENABLE_QUEUES=true` |
| CaterBox | `MONGO_URI`, `JWT_SECRET`, `TWILLIO_*`, `RAZORPAY_*` |

`VITE_MOCK_ORDERS=true` (or the toggle on `/confirm`) mocks **placement only** —
browsing, live pricing, coupons and settlement stay real, and no Swiggy order is
created.

## Testing

```sh
cd server && npm test
```

73 tests, aimed at the places where a regression is *silent*: a broken menu is
obvious on the first page load, a missing ownership check is not. They cover the
authorization boundary, what errors are allowed to disclose, session forgery,
payment idempotency, log redaction, OAuth discovery, and data retention.

## Deployment

See **[DEPLOY.md](DEPLOY.md)** for the runbook and
**[infra/README.md](infra/README.md)** for provisioning.

- Pushing to `main` with changes under `src/**` deploys the SPA automatically.
- The API deploy (`server/**`) is gated on the `AWS_DEPLOY_ROLE_ARN` repo
  variable and is a deliberate, separate step.
- The container runs migrations (`prisma migrate deploy`) on boot, as a
  non-root user, with a liveness-only healthcheck.

## Documentation

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the orchestration works, and why |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Generated code map — an index, not an explanation |
| [SECURITY.md](SECURITY.md) | Auth boundaries, defences, accepted risks, reporting |
| [docs/DATA-HANDLING.md](docs/DATA-HANDLING.md) | What personal data is held, where, for how long |
| [DEPLOY.md](DEPLOY.md) | Operator runbook |
| [docs/decisions/](docs/decisions/) | Architecture decision records |

## Conventions

- **Comments explain *why*, not *what*.** The code says what it does; a comment
  earns its place by recording the constraint, the failure, or the live API
  behaviour that made the code look like this.
- **Authorization lives in the service layer**, not in decorators — the failure
  mode of forgetting a decorator is an unauthenticated endpoint.
- **Never log a Swiggy or Razorpay payload.** They carry names, phone numbers
  and delivery addresses. Use `server/src/common/redact.ts`.
