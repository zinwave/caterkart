# Personal data in CaterKart

What personal data the system holds, where it lives, how long it stays, and
which code paths are allowed to see it. Written to be kept accurate — if you
add a field that identifies a person, add it here.

Relevant law: India's **Digital Personal Data Protection Act, 2023**. The two
obligations this document exists to make verifiable are *purpose limitation*
(hold data only for the purpose it was collected for) and *storage limitation*
(erase it when that purpose ends).

---

## 1. What is held

### Celebrations — PostgreSQL (Prisma)

| Data | Table | Collected from | Why |
|---|---|---|---|
| Swiggy access + refresh token | `SwiggyAuth` | Swiggy OAuth | Placing the host's orders |
| Masked phone (`****0778`) | `SwiggyAuth.swiggyUserHint` | Swiggy address book | Showing the host which account is connected |
| Host display name | `User.displayName` | Typed by the host | Shown to guests on the invite |
| Guest name, phone, email, dietary | `Member` | Host, or the guest themselves | Assembling and splitting the order |
| Guest dish picks | `MemberPick` | The guest | Building the order |
| Delivery address label | `Celebration.addressLabel` | Host | Showing which address an order goes to |
| Swiggy address id | `Celebration.swiggyAddressId` | Host's Swiggy account | Placing the order |
| Invite token | `Invite.token` | Generated | The guest's only credential |

The **full delivery address is never stored**. Only Swiggy's opaque id and a
display label the host chose. The address itself stays on Swiggy's side.

### CaterBox — MongoDB

| Data | Collection | Why |
|---|---|---|
| Customer name, phone, email | `Orders.order.customerData` | Fulfilling and delivering the order |
| Delivery address, pincode | `Orders.order` | Delivering the order |
| Event date, headcount, menu | `Orders.order` | Cooking the right food |
| Razorpay payment + order ids | `Orders` | Reconciling payment |

Card details are **never** seen by this system. Razorpay Checkout collects them
directly; we store only their opaque identifiers.

### On the user's device

| Key | Holds | Lifetime |
|---|---|---|
| `ck_session` (cookie) | App session, `httpOnly` + `Secure` + `SameSite=Lax` | 30 days |
| `ck_token` (localStorage) | CaterBox JWT with the verified phone | 7 days (JWT expiry) |
| `caterkart_guest_<token>` | A guest's own name, diet and picks | 30 days, pruned on next visit |
| `caterkart_address` | Selected Swiggy address id | Until cleared |

---

## 2. How long it is kept

Enforced nightly by `server/src/common/retention.service.ts`:

| Data | Window | Why that long |
|---|---|---|
| Abandoned OAuth handshakes | 10 minutes | A Swiggy auth code lives ~2 minutes |
| Expired invite tokens | 7 days past expiry | Grace so a late click reads "expired", not "not found" |
| Order tracking events | 90 days | Operational telemetry, not a record |
| Completed/failed celebrations (and their guests) | 365 days | A host may look back at last year's party |

Celebrations cascade: deleting one removes its members, picks, sub-orders,
settlements and invites in the same statement (`onDelete: Cascade`).

**Not yet on a schedule:** CaterBox orders in MongoDB. They are financial
records with a statutory retention of their own (GST invoices: 6 years+), so
they need a *tax-aware* policy rather than a flat TTL — the order document and
the invoice line items likely want different windows. Tracked as open work.

---

## 3. Who can see it

Every rule below is enforced in code and covered by a test.

- **Celebrations** — only the host. `CelebrationAccessService.assertHost` runs
  on every route that names a celebration, and answers `404` (never `403`) so
  an id cannot be probed for existence.
- **Guest data** — a guest holds a 144-bit invite token and can read that one
  party and write their own picks. They cannot place or pay for anything.
- **CaterBox orders** — the customer whose OTP-verified phone is on the order,
  or staff. The phone is taken from the JWT, never from the request body or path.
- **Swiggy tokens** — never leave the server. Encrypted at rest with AES-256-GCM
  (`CryptoService`), decrypted only inside an outbound MCP call.

## 4. What must never be logged

`server/src/common/redact.ts` is the only sanctioned path for putting a payload
in a log line. It blanks credentials (tokens, PKCE verifiers, authorization
codes, signatures) and personal data (names, phones, emails, addresses,
coordinates, UPI handles), and masks the same patterns in free text.

Use `redactToString(value)` for objects and `maskString(text)` for strings.
Never `JSON.stringify` a Swiggy or Razorpay payload into a log — those carry
the customer's name, phone and full delivery address.

Access logs record method, path, status and duration only. **Query strings are
deliberately excluded**: they carry addresses, search terms and invite tokens,
and logs are retained far longer than the data they describe.

## 5. Known gaps

1. **No self-serve erasure.** A DPDP erasure request has to be fulfilled by
   hand today. `DELETE /api/celebrations/:id` and an account-deletion endpoint
   would close this.
2. **No CaterBox retention schedule.** See §2.
3. **The privacy policy does not mention the Swiggy OAuth grant.** It describes
   CaterKart as an aggregator sharing order details with vendors, which does not
   cover holding a token that can place real orders on the user's own Swiggy
   account for ~5 days. This needs legal review before launch, not an
   engineering fix.
4. **No DPO contact or grievance-officer route published**, which the DPDP Act
   requires for a data fiduciary.
