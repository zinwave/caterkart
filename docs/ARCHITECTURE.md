# Architecture

Hand-maintained. The generated code map at [../ARCHITECTURE.md](../ARCHITECTURE.md)
indexes files and endpoints; this explains how the system works and why it is
shaped this way.

---

## 1. Three products, one process

```
                           ┌─────────────────────────────┐
  caterkart.in ──────────► │  Vite / React SPA (S3+CF)   │
                           └──────────────┬──────────────┘
                                          │  credentials: include
                           ┌──────────────▼──────────────┐
  api.caterkart.in ──────► │  Caddy :443  (auto-TLS)     │
                           └──────────────┬──────────────┘
                                          │
                           ┌──────────────▼──────────────┐
                           │  NestJS :4000               │
                           │                             │
     /api/*                │  Celebrations ──► Postgres  │
     cookie session        │       │           Redis     │
                           │       └────────►  Swiggy MCP│
                           │                             │
     /api/ck/*             │  CaterBox ─────►  MongoDB   │
     bearer JWT            │       └────────►  Razorpay  │
                           │                             │
     /api/work/*           │  Work (ENABLE_WORK, off)    │
                           └─────────────────────────────┘
```

One process on purpose. The SSE stream and the BullMQ tracking processor share
an in-process RxJS subject, so splitting api/worker requires a Redis pub/sub
adapter first. Noted at the top of `server/docker-compose.prod.yml`.

### Why two auth schemes

They authenticate different people against different systems, and collapsing
them would make one of the two worse.

- **Swiggy half** — Swiggy already authenticates by phone + OTP. Asking again
  would collect a number we have no way to verify and no reason to hold.
  Completing the OAuth grant *is* the sign-in. The session is a signed,
  `httpOnly` cookie: a token in `localStorage` would be readable by any injected
  script, and that token can spend money on a real Swiggy account.
- **CaterBox half** — has nothing to do with Swiggy. Requiring a Swiggy login to
  buy a meal box from a partner kitchen would make no sense. Identity is a
  phone number proved by OTP, carried as a Bearer JWT.
- **Guests** — hold a 144-bit token in a URL and nothing else. No account, no
  app, no payment method.

`JwtAuthGuard` is registered app-wide so a new CaterBox controller is protected
by default, and **stands aside** for anything outside `/api/ck` rather than
401-ing the other half.

---

## 2. The celebration lifecycle

```
  PLANNING ──► PLACING ──► IN_FLIGHT ──► COMPLETED
     │                                      
     └──────────────────────────────────► FAILED
```

1. **Create.** The host names the occasion and binds one of *their own* Swiggy
   addresses. The id is validated against their real Swiggy address book — an
   arbitrary string would only fail later, inside a queued job, where the host
   never sees it.
2. **Invite.** Each guest gets a 144-bit token. Opening it needs no account.
3. **Pick.** Guests browse live Swiggy menus — brokered with the *host's* grant,
   scoped to the bound address — and save their choices.
4. **Assemble.** Picks are grouped into one sub-order per restaurant. Swiggy
   carts are single-restaurant, and there is a ₹1,000 cap per food order, so
   "one party" is always N Swiggy orders.
5. **Place.** The planner computes a fire time per sub-order from its ETA and
   queues each as a delayed BullMQ job. Durable: a restart does not lose them.
6. **Track.** Tracking jobs poll Swiggy and emit onto the SSE stream.
7. **Settle.** Equal or itemised split, with a UPI deeplink per guest.

### Convergence — the actual product

The non-obvious part. Five restaurants with ETAs of 25, 40, 30, 55 and 35
minutes, all ordered at once, deliver across a 30-minute spread. The planner
inverts it: order the 55-minute restaurant *first* and the 25-minute one 30
minutes later, so everything lands together. Instamart supplies (plates, ice,
candles) get a negative offset so they arrive *before* the food.

`PlacementPlannerService` computes the offsets; `SchedulerService` persists the
plan and queues the jobs.

---

## 3. The Swiggy MCP integration

Every call goes through `McpClientService`, the single choke point.

### Session pooling

Opening an MCP session authenticates the bearer token with Swiggy, so a fresh
connection per tool call meant dozens of auth round-trips per checkout. Sessions
are pooled per `(server, userId)` — **never shared across users** — reconnecting
only when the token rotates, the session errors, or it idles out after 5 minutes.

### Retry policy is decided in one place

```
idempotent call   → up to 3 attempts, exponential backoff
ToolError         → never retried (Swiggy is deliberately refusing)
NeedsReauthError  → never retried (the grant is gone)
non-idempotent    → never retried, ever
```

`place_food_order` **is not idempotent**. A failed placement may still have
created an order. So a failure raises `PlacementFailedError`, and
`placeReconciled` reads `get_food_orders` and adopts a matching order
(same restaurant, total within ₹1) rather than placing a second one.

### Four constraints learned from the live API

1. **₹1,000 cap** per food order — enforced before placement.
2. **`addressId` gates nearly every tool** — asserted up front rather than
   letting the MCP round-trip fail.
3. **Payloads arrive entity-keyed** (`{ restaurants: [...] }`), not under a
   `data` envelope. Normalised in `mappers.ts`.
4. **Orders carry no machine-readable timestamp** — `orderedTime` is a display
   string like "May 22, 1:40 PM", which is why reconciliation matches on
   restaurant + total instead.

### The token

~5 days, with a refresh token. Encrypted at rest with AES-256-GCM and **never
sent to the browser**. Renewal is deduplicated per user: a checkout fans out
across cart, coupons, payment options and orders, and without the in-flight map
that fires several refreshes at once — the slowest of which would overwrite the
newest token with one Swiggy has already retired.

OAuth endpoint discovery is **origin-pinned**: the discovery document names the
endpoints that receive the authorization code and refresh token, so an
unvalidated one lets the MCP server nominate where a live grant is sent. See
[SECURITY.md](../SECURITY.md#swiggy-mcp-integration).

---

## 4. Authorization

The model is simple and deliberately boring:

- **Ownership checks live in the service layer**, not in decorators. The failure
  mode of forgetting a decorator is an unauthenticated endpoint; the failure
  mode of forgetting a service call is a compile error or an obviously broken
  route.
- **One shared checker.** `CelebrationAccessService.assertHost` is called by
  every path that touches a celebration — celebrations, settlement, invites,
  scheduler, SSE.
- **404, never 403.** A 403 confirms the id exists, which is all an enumeration
  attack needs. An unauthorized celebration is indistinguishable from a missing
  one.
- **One exception.** The SSE stream uses `CelebrationHostGuard`, because `@Sse`
  commits `200` and the event-stream headers before a handler-level check could
  return a status.

CaterBox mirrors this with the phone claim from the JWT: an order is readable
and payable only by the number it was filed against, or by staff.

---

## 5. Data

| Store | Holds | Why this store |
|---|---|---|
| **PostgreSQL** (Prisma) | Celebrations, members, picks, sub-orders, plans, settlements, invites, Swiggy grants | Typed, relational, cascade deletes — a guest list is a graph |
| **MongoDB** | CaterBox quotes and orders | Every event differs; the quote document is genuinely schemaless |
| **Redis** | BullMQ placement + tracking queues | Delayed jobs must survive a restart |

Two databases is a real decision, not an accident. Collapsing one into the other
is a separate piece of work, not a prerequisite for a deploy.

Retention is enforced nightly — see [DATA-HANDLING.md](DATA-HANDLING.md).

---

## 6. Request lifecycle

```
  request
    │
    ├─ RequestContextMiddleware   opens the async-local scope (request id)
    ├─ HttpLoggerMiddleware       registers the finish handler
    ├─ SessionMiddleware          verifies the signed cookie → req.ckUserId
    ├─ UserContextMiddleware      copies the user into the logging scope
    │
    ├─ ThrottlerGuard             rate limit  (needs `trust proxy`)
    ├─ JwtAuthGuard               /api/ck/* only; stands aside elsewhere
    ├─ RolesGuard                 @Staff()
    │
    ├─ ValidationPipe             whitelist + forbidNonWhitelisted + bounds
    ├─ controller → service       ownership checked HERE
    │
    └─ AllExceptionsFilter        one envelope; decides what may be disclosed
```

Ordering matters at both ends. Session resolution is middleware so identity
exists for everything and `@CurrentUser()` decides whether it is required. The
filter is last so no error escapes without passing a disclosure decision.

---

## 7. Things that will bite you

- **Placement is not reversible.** Test with `VITE_MOCK_ORDERS=true`.
- **Swiggy carts are single-restaurant.** Adding an item from another restaurant
  replaces the cart. This is why sub-orders exist.
- **`trust proxy` must match the real hop count.** Too low and every caller
  shares one rate-limit bucket; too high and a client can forge
  `X-Forwarded-For` and pick its own.
- **Never `JSON.stringify` a Swiggy or Razorpay payload into a log.** They carry
  names, phone numbers and delivery addresses. Use `common/redact.ts`.
- **CaterKart for Work is a prototype.** In-memory store, identity from a query
  parameter. It is mounted only when `ENABLE_WORK=true`. Do not turn that on in
  production.
