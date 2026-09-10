# ADR-0001 — CaterKart Celebrations on AWS (ap-south-1)

**Status:** Accepted. Implemented by [`infra/`](../../infra) (CDK) and the
`deploy api` / `deploy web` workflows. Shares the `zinwave-admin` account and the ap-south-1
region with `zinwave-web-production`, per ADR-0001 in the Zinwave repo.

## Context

CaterKart Celebrations is a Vite/React SPA plus a NestJS backend that
orchestrates group food orders through the Swiggy MCP API. The estate already
has a deployment idiom — AWS CDK in TypeScript, ap-south-1, `lib/config.ts` per
environment, GitHub OIDC deploy roles, hosted zones created out of band — and
this service should not invent a second one.

The idiom transfers. **The compute choice does not**, and that is the whole
substance of this decision.

Three properties of the backend decide it:

1. **Delayed work.** `SchedulerService.planAndPlace` computes a convergence plan
   and enqueues each sub-order's placement as a BullMQ job with a `delay` —
   minutes into the future — so that food, groceries and cake arrive together.
   Nothing triggers that work; a timer fires it.
2. **Self-re-enqueueing pollers.** `TrackingProcessor` polls Swiggy no faster
   than every 10s and re-queues itself until an order is terminal, for the full
   life of a delivery.
3. **Long-lived streams.** `EventsController` is `@Sse`, and the browser holds
   an `EventSource` open for the duration.

None of these is request-driven.

## Decision

**One Lightsail instance running Caddy, the Nest API, Postgres and Redis under
docker compose, provisioned by CDK.**

### Why not the two precedents in this account

**Lambda** (`zinwave-web-production`) is invoked per request and frozen after it
responds. A BullMQ worker would have no process to run in, and API Gateway's
~30s integration timeout truncates SSE. Both failure modes are silent: orders
would be accepted and simply never placed.

**App Runner** (`qyne-infra`) fails for a subtler version of the same reason.
Its billing model throttles instance CPU to near-zero when no request is in
flight, so a delayed job scheduled twenty minutes out and a poller waking every
10s are both starved between requests. The container stays alive and the orders
still do not go out on time — a worse failure than Lambda's, because it looks
like it is working.

The estate's precedent is therefore *serverless where the workload is
request-driven*. This workload is not, so the precedent does not apply. Compute
already varies by workload here (Lambda for the site, App Runner for QYNE); what
must not vary is the idiom, and it does not.

### Why Lightsail rather than ECS Fargate

Fargate is the conventional AWS answer and the one this grows into. It was
costed and rejected for now:

| | Lightsail | Fargate |
|---|---|---|
| compute | $12 (2 GB, incl. bandwidth) | ~$9 (0.25 vCPU / 512 MB) |
| ingress | Caddy, on the box | ALB ~$18 |
| Postgres | container | RDS t4g.micro ~$15 |
| Redis | container | ElastiCache t4g.micro ~$12 |
| **total** | **~$13/mo** | **~$55/mo** |

Four times the cost, for a service with no traffic yet, and the ALB exists only
because SSE rules out API Gateway. Lightsail is a CloudFormation resource
(`AWS::Lightsail::Instance`), so this is still one `cdk deploy` and one
`cdk destroy` — the state stays in CloudFormation and no Terraform state bucket
is introduced.

### Why a single process

`ENABLE_QUEUES=true` loads `SchedulerModule` into the same process that serves
HTTP. `EventsService` is an in-process rxjs `Subject`, so the tracking processor
and the SSE endpoint must share a process or live updates silently never arrive
— the file's own comment says as much. Splitting api and worker is therefore
gated on backing `EventsService` with Redis pub/sub, and is a scaling step, not
a starting shape.

### The frontend: S3 + CloudFront

The SPA follows the estate's existing answer for a static site
(`zinwave-web-production`) unchanged: a private S3 bucket behind CloudFront with
Origin Access Control, `PriceClass_200`, HTTP/3, and a viewer-request function.
No compute, because there is nothing to compute.

One thing is simpler than zinboard's and one is harder.

Simpler: this is a plain Vite SPA with nothing prerendered, so the router
function has no clean-URL-to-`.html` mapping to do — every extensionless path
rewrites to `/index.html`. Paths *with* an extension pass through untouched, so
a stale hashed asset still 404s honestly instead of being served the shell as a
200 full of HTML.

Harder: **the apex forces the zone into Route53.** `caterkart.in` must serve the
app, an apex cannot be a CNAME, and only Route53 provides the ALIAS record that
points an apex at a CloudFront distribution. GoDaddy — where the domain is
registered, and where its DNS briefly lived — offers CNAME only. So the zone
moves to Route53, created by hand and imported by id for the same reason
zinboard's is: a zone a stack can delete is a domain that stops resolving when
somebody refactors.

The API is unaffected by that cutover. It is a different hostname on a different
origin, and Caddy issues its own certificate, so `api.caterkart.in` never
flickers while the apex moves.

## Consequences

**Accepted:**

- **No IAM instance profile.** Lightsail instances cannot carry one, so the app
  cannot read Secrets Manager at boot. Secrets are shipped by `npm run deploy:env`
  over scp, `chmod 600`, and never enter CloudFormation — where a value in a
  template is a value in every stack event.
- **One instance, so a restart is downtime.** Acceptable pre-launch; the ALB and
  a second task are what fix it, and that is the Fargate row above.
- **Backups are disk snapshots**, daily at 20:00 UTC. Postgres lives on that
  disk and, unlike a static site, is not rebuildable from git.
- **The key pair is created out of band** by `infra/scripts/setup-aws.sh`, for
  the same reason the Route53 zone is: CloudFormation has no
  `AWS::Lightsail::KeyPair` resource at all.
- **Lightsail namespaces every resource type together** within a region, so the
  instance cannot share a name with the key pair. Hence `caterkart-api-*` for
  the instance against `caterkart-*` for the key.
- **Lightsail prepends its own lines to user-data**, which pushes the script's
  shebang off line 1 and makes cloud-init fall back to `/bin/sh`. `bootstrap.sh`
  re-execs under bash before anything else. Without it the instance boots with
  no Docker while CloudFormation still reports `CREATE_COMPLETE` — a green
  deploy is not evidence the box is provisioned.

**Deliberately deferred:**

- **DNS.** `withCustomDomains` stays false until the Route53 zone exists and its
  nameservers are delegated. Until then CloudFront answers on its own
  `*.cloudfront.net` name and the API on its static IP, so the live catering
  site on the apex keeps serving while all of this is verified end to end.
- **TLS is Caddy's, not ACM's.** There is no CloudFront distribution to attach a
  certificate to, and Caddy renews on its own. Port 80 must stay open for the
  ACME HTTP-01 challenge — it is not merely a redirect to HTTPS.

## The migration path

Nothing here needs rewriting to grow: `bundleId: 'medium_3_0'` (4 GB) → managed
Postgres → Redis pub/sub in `EventsService` → split the worker → ECS Fargate
behind an ALB. The container image is the same at every step.
