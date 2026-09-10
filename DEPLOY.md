# Deploying CaterKart Celebrations

Provisioning lives in **[infra/README.md](infra/README.md)**; the design and the
costed alternatives are in **[ADR-0001](docs/decisions/0001-aws-deployment.md)**.
This is the operator runbook.

```
caterkart.in       → CloudFront → S3 (private, OAC)      Vite SPA
www.caterkart.in   → 301 to apex, at the edge
api.caterkart.in   → Lightsail 2 GB (ap-south-1)
                       Caddy      :443  auto-TLS
                       └─ api     :4000  ENABLE_QUEUES=true
                       ├─ postgres      (no host port)
                       └─ redis         (no host port)
```

All in account 331116047343, ap-south-1 — the same account as
`zinwave-web-production`. ~$13/mo for the Lightsail box; CloudFront and S3 at
this traffic are cents.

## Where things stand

The API box is provisioned and bootstrapped. What remains is DNS, and it has to
move to **Route 53** — `caterkart.in` must serve the app from CloudFront, an
apex cannot be a CNAME, and only Route 53 offers the ALIAS record that points an
apex at a distribution. GoDaddy cannot do it.

## Phase A — bridge the zone to Route 53 (no downtime)

Create the zone by hand. It is deliberately not a stack resource: a zone a
stack can delete is a domain that stops resolving when somebody refactors.

```sh
aws route53 create-hosted-zone --profile zinwave-admin \
  --name caterkart.in --caller-reference "caterkart-$(date +%s)" \
  --query 'DelegationSet.NameServers'
```

Recreate today's records in it, so nothing changes when the delegation flips:

| Type | Name | Value |
|---|---|---|
| A | `caterkart.in` | 52.74.6.109, 13.215.239.219 *(Netlify — the catering site)* |
| A | `www.caterkart.in` | same two |
| A | `api.caterkart.in` | 13.205.52.186 |
| TXT | `_dmarc.caterkart.in` | the existing DMARC string |

Then at **GoDaddy → Nameservers → Change → custom**, enter the four
`ns-*.awsdns-*` names the command printed. Wait for it:

```sh
dig +short caterkart.in NS      # expect the awsdns names
dig +short api.caterkart.in     # expect 13.205.52.186
```

The catering site keeps serving throughout — those apex records still point at
Netlify.

## Phase B — ship the API

Once `api.caterkart.in` resolves:

```sh
npm run deploy:env && npm run deploy:app
npm run logs
curl -sI https://api.caterkart.in/auth/swiggy/callback | head -1   # expect 302
```

Then register `https://api.caterkart.in/auth/swiggy/callback` with
`builders@swiggy.in`, having verified that sender out of band.

## Phase C — ship the site, still on the CloudFront domain

```sh
npm run infra:deploy        # creates the bucket + distribution, domains still off
```

Build and upload once by hand, then open the `DistributionDomain` output and
click through — including a deep link like `/invite/anything`, which is what
proves the router function works.

## Phase D — the cutover

Only when Phase C looks right.

1. **Delete** the hand-made `caterkart.in`, `www` and `api` records from the
   Route 53 zone. CDK is about to manage all three, and it cannot create a
   record that already exists.
2. Set `hostedZoneId` and `withCustomDomains: true` in
   [infra/lib/config.ts](infra/lib/config.ts). Rehearse first:
   ```sh
   npm --prefix infra run diff -- -c withCustomDomains=true -c hostedZoneId=Z...
   ```
3. `npm run infra:deploy` — issues the ACM certificate in us-east-1, attaches
   the apex and www aliases, and writes the alias records.

At that moment the apex leaves Netlify. `api` is a different hostname on a
different origin with its own Caddy certificate, so it does not flicker.

## Day-to-day

| | |
|---|---|
| `npm run deploy:app` | ship the backend |
| `npm run deploy:env` | ship changed secrets |
| `npm run logs` / `ssh` / `backup` | operate the box |
| `npm run infra:diff` | preview an infrastructure change |

Pushes to `main` deploy automatically: `server/**` triggers **deploy api**,
frontend paths trigger **deploy web**. Both smoke-test afterwards — the API
asserts the OAuth callback is still routed outside the `/api` prefix, the site
asserts a deep link resolves. Set the repo variables listed at the top of each
workflow to enable them; without those, the jobs skip rather than fail.

Disk snapshots run daily at 20:00 UTC (01:30 IST) and are the real backup —
Postgres lives on that disk.

## Two things to know before real orders flow

- **`ENABLE_QUEUES=true` must stay true and stay in one process.** Placement is
  scheduled as delayed BullMQ jobs; with queues off nothing ever places. And
  `EventsService` is an in-process rxjs `Subject`, so splitting api and worker
  silently breaks live tracking until it is backed by Redis pub/sub.
- **`TrackingProcessor` writes an `OrderEvent` row with the full raw payload on
  every poll**, not on state change — roughly 300 rows per sub-order over a
  50-minute delivery. On a 60 GB disk that matters sooner than you would like.
