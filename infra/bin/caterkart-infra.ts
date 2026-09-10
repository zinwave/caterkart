#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack';
import { WebStack } from '../lib/web-stack';
import { CertStack } from '../lib/cert-stack';
import { production, staging, ACCOUNT, type EnvConfig } from '../lib/config';

const app = new cdk.App();

// The account comes from the CLI credentials. Explicit rather than
// environment-agnostic so the stack fails loudly under the wrong profile — this
// shares an account with zinwave-web-production.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID;

// Fail before synth rather than midway through a deploy. `cdk synth` runs with
// no credentials in CI, so only check when an account was actually resolved.
if (account && account !== ACCOUNT) {
  throw new Error(
    `Wrong AWS account: credentials resolve to ${account}, this stack targets ${ACCOUNT} ` +
      `(the Zinwave estate account). Use --profile zinwave-admin.`,
  );
}

// ap-south-1 (Mumbai), matching zinwave-infra and qyne-infra so the whole
// estate stays in one account and one region. CloudFront, Route53 and IAM are
// global; only the S3 origin and the Lightsail instance are regional.
const REGION = 'ap-south-1';

function flag(name: string, fallback: boolean): boolean {
  const ctx = app.node.tryGetContext(name);
  if (ctx === undefined) return fallback;
  return ctx === true || ctx === 'true';
}

function define(base: EnvConfig): void {
  // Both overridable at the CLI (`-c withCustomDomains=true -c hostedZoneId=Z…`)
  // so the cutover can be rehearsed with `cdk diff` before it is committed to
  // lib/config.ts.
  const config: EnvConfig = {
    ...base,
    hostedZoneId: app.node.tryGetContext('hostedZoneId') ?? base.hostedZoneId,
    withCustomDomains: flag('withCustomDomains', base.withCustomDomains),
  };

  // Only exists after the cutover flag is on — before that there is no custom
  // domain to certify, and issuance would block on validation records in a zone
  // the internet has not been told about.
  const cert =
    config.withCustomDomains && config.hostedZoneId
      ? new CertStack(app, `caterkart-cert-${config.env}`, {
          env: { account, region: 'us-east-1' },
          crossRegionReferences: true,
          config,
          hostedZoneId: config.hostedZoneId,
          description: `CaterKart ${config.env} — CloudFront TLS certificate (us-east-1 is mandatory).`,
        })
      : undefined;

  new WebStack(app, `caterkart-web-${config.env}`, {
    env: { account, region: REGION },
    crossRegionReferences: true,
    config,
    certificateArn: cert?.certificateArn,
    description: `CaterKart ${config.env} — celebrations SPA on S3/CloudFront, with a scoped GitHub OIDC deploy role.`,
  });

  new ApiStack(app, `caterkart-api-${config.env}`, {
    env: { account, region: REGION },
    config,
    description: `CaterKart ${config.env} — celebrations API on Lightsail (Caddy + Nest + Postgres + Redis), with a GitHub OIDC deploy role.`,
  });
}

define(production);
define(staging);
