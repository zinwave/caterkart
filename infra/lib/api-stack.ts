import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lightsail from 'aws-cdk-lib/aws-lightsail';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { EnvConfig } from './config';

export interface ApiStackProps extends cdk.StackProps {
  config: EnvConfig;
}

/**
 * The CaterKart Celebrations backend: one Lightsail instance running Caddy,
 * the Nest API, Postgres and Redis under docker compose.
 *
 * Why not Lambda or App Runner, the two precedents in this account: both
 * suspend or CPU-throttle an instance between requests, and this service is not
 * request-driven. `SchedulerService` enqueues order placements as *delayed*
 * BullMQ jobs minutes into the future, `TrackingProcessor` re-enqueues itself
 * every 10s until an order is terminal, and `EventsController` holds an SSE
 * stream open for the life of a delivery. Full rationale and the costed
 * alternatives: docs/decisions/0001-aws-deployment.md.
 */
export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { config } = props;

    // Installs Docker, ufw, swap and unattended-upgrades. Deliberately fetches
    // no application code and no secrets: user_data is readable from the
    // instance metadata service, so nothing sensitive may appear in it.
    const userData = fs.readFileSync(path.join(__dirname, 'bootstrap.sh'), 'utf8');

    // Lightsail namespaces ALL resource types together within a region: an
    // instance may not share a name with a key pair, a static IP or a disk.
    // Hence the `-api` infix — `caterkart-${config.env}` is the key pair, and
    // reusing it here fails with "Some names are already in use".
    const instance = new lightsail.CfnInstance(this, 'Instance', {
      instanceName: `caterkart-api-${config.env}`,
      blueprintId: 'ubuntu_22_04',
      bundleId: config.bundleId,
      availabilityZone: config.availabilityZone,
      keyPairName: config.keyPairName,
      userData,

      // Postgres (5432) and Redis (6379) are absent on purpose — they bind to
      // the compose network only. Opening them here would expose the database
      // on a public IP. Port 80 stays open because Caddy needs it for the ACME
      // HTTP-01 challenge and every renewal, not just to redirect to HTTPS.
      networking: {
        ports: [
          {
            fromPort: 22,
            toPort: 22,
            protocol: 'tcp',
            cidrs: config.sshAllowedCidrs,
            accessDirection: 'inbound',
          },
          { fromPort: 80, toPort: 80, protocol: 'tcp', cidrs: ['0.0.0.0/0'], accessDirection: 'inbound' },
          { fromPort: 443, toPort: 443, protocol: 'tcp', cidrs: ['0.0.0.0/0'], accessDirection: 'inbound' },
        ],
      },

      // The backup story. Postgres lives on this instance's disk, so unlike a
      // static site nothing here is rebuildable from git.
      addOns: [
        {
          addOnType: 'AutoSnapshot',
          status: 'Enabled',
          autoSnapshotAddOnRequest: { snapshotTimeOfDay: config.snapshotTimeUtc },
        },
      ],
    });

    /**
     * A static IP, separate from the instance's default one.
     *
     * The Swiggy redirect URI is registered by email with builders@swiggy.in and
     * is painful to change, so the hostname behind it has to outlive any
     * instance replacement. This is the resource that guarantees that.
     */
    const staticIp = new lightsail.CfnStaticIp(this, 'StaticIp', {
      staticIpName: `caterkart-api-${config.env}-ip`,
      attachedTo: instance.instanceName,
    });
    // `attachedTo` is a literal name, not a Ref, so CloudFormation infers no
    // ordering here — the static IP would otherwise try to attach to an
    // instance that does not exist yet.
    staticIp.node.addDependency(instance);

    // ── DNS (phase 2) ────────────────────────────────────────────────────────
    if (config.withCustomDomains && config.hostedZoneId) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
        hostedZoneId: config.hostedZoneId,
        zoneName: config.webHost,
      });
      new route53.ARecord(this, 'ApiRecord', {
        zone,
        recordName: config.apiHost,
        target: route53.RecordTarget.fromIpAddresses(staticIp.attrIpAddress),
        ttl: cdk.Duration.minutes(5),
      });
    }

    // ── CI deploy role ───────────────────────────────────────────────────────
    // Lightsail instances cannot carry an IAM instance profile, so the workflow
    // uses this role only to *discover* the host; shipping code happens over
    // SSH. Scoped to reads for that reason — it cannot change infrastructure.
    const providerArn = `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`;
    const provider = config.ownsOidcProvider
      ? new iam.OpenIdConnectProvider(this, 'GithubOidc', {
          url: 'https://token.actions.githubusercontent.com',
          clientIds: ['sts.amazonaws.com'],
        })
      : iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'GithubOidc', providerArn);

    const subjects = config.github.branches.map(
      (b) => `repo:${config.github.org}/${config.github.repo}:ref:refs/heads/${b}`,
    );

    const deployRole = new iam.Role(this, 'DeployRole', {
      roleName: `caterkart-deploy-${config.env}`,
      description: 'GitHub Actions: read the instance address. No write access.',
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': subjects },
      }),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    deployRole.addToPolicy(
      new iam.PolicyStatement({
        // Lightsail's Get* actions do not support resource-level permissions,
        // so this is '*' by the API's own constraint, not by choice. It is
        // read-only, and the account holds no other Lightsail resources.
        actions: ['lightsail:GetStaticIp', 'lightsail:GetInstance'],
        resources: ['*'],
      }),
    );

    // ── Outputs ──────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'StaticIpAddress', {
      value: staticIp.attrIpAddress,
      description: 'Point the api A record here. Survives instance replacement.',
    });
    new cdk.CfnOutput(this, 'SwiggyRedirectUri', {
      value: `https://${config.apiHost}/auth/swiggy/callback`,
      description: 'Exact string to register with builders@swiggy.in.',
    });
    new cdk.CfnOutput(this, 'SshCommand', {
      value: `ssh -i ~/.ssh/${config.keyPairName} ubuntu@${staticIp.attrIpAddress}`,
      description: 'Shell into the instance.',
    });
    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Set as the AWS_DEPLOY_ROLE_ARN repo variable.',
    });
  }
}
