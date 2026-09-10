# caterkart-infra

AWS infrastructure for CaterKart Celebrations, as an **AWS CDK (TypeScript)**
app. Region **ap-south-1**, in the same account as
[`zinwave-infra`](../../zinboard/infra) so the whole estate stays on one account,
one region, one deployment idiom.

Design and rationale: **[ADR-0001](../docs/decisions/0001-aws-deployment.md)** —
in particular *why this is Lightsail and not Lambda or App Runner*, which is the
one place this service deviates from the estate's precedent.

## What it provisions

**`caterkart-web-*`** — the SPA

| | |
|---|---|
| site bucket | S3, private, Origin Access Control — no public bucket anywhere |
| CloudFront | the only thing viewers talk to; HTTP/3, Brotli, `PriceClass_200` (India + EU edges) |
| router function | viewer-request: `www` → apex 301, SPA deep links → `/index.html` |
| security headers | HSTS, `nosniff`, `frame-options: DENY`, referrer policy |
| certificate | ACM in us-east-1 (its own stack — CloudFront accepts no other region) |
| deploy role | GitHub OIDC, scoped to bucket writes + invalidation |

**`caterkart-api-*`** — the backend

| | |
|---|---|
| Lightsail instance | Ubuntu 22.04, `small_3_1` (2 GB / 2 vCPU / 60 GB); cloud-init installs Docker, ufw, 2 GB swap, unattended-upgrades |
| static IP | separate resource, so the Swiggy redirect URI survives instance replacement |
| firewall | 22 / 80 / 443 only — Postgres and Redis bind to the compose network |
| auto-snapshot | daily at 20:00 UTC (01:30 IST) — this is the backup |
| deploy role | GitHub OIDC, read-only; no long-lived AWS keys |

On the instance, under `docker compose`: Caddy (auto-TLS) → the Nest API
(`ENABLE_QUEUES=true`, one process) → Postgres + Redis.

**Not here, by design:**

- **The Route53 hosted zone.** Created once by hand and imported by id: a zone
  a stack can delete is a domain that stops resolving when somebody refactors,
  and its nameservers change on every recreate. The zone is *required* — an apex
  cannot be a CNAME, so only Route53's ALIAS can point `caterkart.in` at
  CloudFront. See DEPLOY.md Phase A.
- **The SSH key pair.** CloudFormation has no `AWS::Lightsail::KeyPair` resource.
  `scripts/setup-aws.sh` creates and imports it, and the stack references it by
  name.
- **The application secrets.** Lightsail instances cannot carry an IAM instance
  profile, so the app cannot read Secrets Manager at boot. `npm run deploy:env`
  ships `.env.production` over scp — a value in a CloudFormation template is a
  value in every stack event.

## Stacks

| Stack | Region | When |
|---|---|---|
| `caterkart-web-production` | ap-south-1 | always |
| `caterkart-api-production` | ap-south-1 | always |
| `caterkart-cert-production` | us-east-1 | only with `withCustomDomains` |
| `caterkart-*-staging` | — | defined but never deployed; `npm run deploy` targets production |

## Bring-up

```bash
npm run infra:setup          # from the repo root
```

Idempotent. It preflights the profile, creates and imports the SSH key pair,
`cdk bootstrap`s, deploys, and prints the next steps.

Then, in order:

1. **Add the A record** — `api.caterkart.in` → the `StaticIpAddress` output, at
   your current DNS provider. **Wait for it to resolve before deploying:** Caddy
   requests a certificate on first boot and Let's Encrypt rate-limits repeated
   failures.
2. **Fill the secrets** — `cp ../server/.env.production.example
   ../server/.env.production`, then `openssl rand -hex 32` for `TOKEN_ENC_KEY`
   and `APP_JWT_SECRET`.
3. **Ship** — `npm run deploy:env && npm run deploy:app`.
4. **Register** the `SwiggyRedirectUri` output with `builders@swiggy.in`.

## The DNS cutover, later

Rehearse before committing it:

```bash
npm --prefix infra run diff -- -c withCustomDomains=true -c hostedZoneId=Z...
```

Set both in `lib/config.ts` once the zone exists in Route53 **and** the
registrar's nameservers point at it. Until then `withCustomDomains: false` is
correct, not a placeholder.

## Cost

~$13/mo: $12 instance (bandwidth included) + ~$1 snapshots. S3 and CloudFront at
this traffic are cents, and the Route53 zone is $0.50. The costed comparison
against ECS Fargate (~$55/mo) is in
[ADR-0001](../docs/decisions/0001-aws-deployment.md).
