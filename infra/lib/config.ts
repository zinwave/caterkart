/**
 * The Zinwave estate account, shared with `zinwave-web-production`.
 *
 * Pinned rather than inferred because this stack *imports* the GitHub OIDC
 * provider by ARN — an account-wide singleton that zinboard already owns. Under
 * the wrong profile that ARN silently does not exist, and the failure surfaces
 * as an unrelated IAM error at deploy time rather than as "wrong account".
 */
export const ACCOUNT = '331116047343';

/**
 * Per-environment configuration. Staging and production differ only here —
 * the stack is the same shape with different parameters.
 */
export interface EnvConfig {
  env: 'staging' | 'production';

  /** Host serving the API and the Swiggy OAuth callback. */
  apiHost: string;
  /** Apex host serving the SPA, from S3 + CloudFront. */
  webHost: string;
  /** Extra hosts on the distribution that 301 to `webHost` (the router does it). */
  redirectHosts: string[];

  /**
   * Lightsail bundle. `small_3_1` is 2 GB / 2 vCPU / 60 GB at $12/mo.
   *
   * The generation suffix is REGION-SPECIFIC — ap-south-1 offers `_3_1`, and
   * `_3_0` fails at create time with "bundle does not exist in this region".
   * Confirm before changing region or size:
   *   aws lightsail get-bundles --region <region> \
   *     --query 'bundles[?supportedPlatforms[?@==`LINUX_UNIX`]].{id:bundleId,price:price,ram:ramSizeInGb}'
   *
   * 2 GB is the floor, not a saving: one Nest process, Postgres, Redis and a
   * `docker build` share it. The bootstrap adds 2 GB of swap for exactly that
   * reason. `medium_3_1` (4 GB, $24) is the next step and needs no other change.
   *
   * The `*_ipv6_*` bundles are $2/mo cheaper for identical specs, and are not
   * used: they have no public IPv4 address, so an IPv4-only client could not
   * reach the Swiggy OAuth callback, and AWS::Lightsail::StaticIp is IPv4.
   */
  bundleId: string;
  availabilityZone: string;

  /**
   * Lightsail key pair name, created out of band by `scripts/setup-aws.sh`.
   *
   * Deliberately not a stack resource: CloudFormation has no
   * `AWS::Lightsail::KeyPair` type at all, so this follows the same rule as the
   * Route53 zone — created once by hand, referenced by name.
   */
  keyPairName: string;

  /** Who may reach port 22. Narrow to "<ip>/32" if yours is static. */
  sshAllowedCidrs: string[];

  /** Daily automatic snapshot, UTC, on the hour. 20:00 UTC = 01:30 IST. */
  snapshotTimeUtc: string;

  /**
   * Route53 hosted zone for `webHost`, created ONCE out of band and referenced
   * by id — a zone a stack can delete is a domain that stops resolving when
   * somebody refactors, and its nameservers change on every recreate.
   *
   * Required for the apex, not merely convenient: CloudFront at an apex needs
   * an ALIAS record, which only Route53 provides. GoDaddy and most registrars
   * offer CNAME only, and a CNAME at an apex is invalid.
   */
  hostedZoneId?: string;

  /**
   * Phased bring-up.
   *
   * Off: CloudFront serves the SPA on its own `d111111abcdef8.cloudfront.net`
   *      name and the API answers on its static IP. Nothing about caterkart.in
   *      changes, so the live catering site keeps serving while this is verified
   *      end to end.
   * On:  adds the ACM certificate, the apex and www aliases on the distribution,
   *      and the Route53 records for all three hosts. This is the cutover.
   *      Requires `hostedZoneId` AND the zone's NS delegated at the registrar.
   */
  withCustomDomains: boolean;

  /**
   * The GitHub OIDC provider is an account-wide singleton and
   * `zinwave-web-production` already creates it in this account. This stack
   * must import it — a second provider for the same issuer fails to create.
   */
  ownsOidcProvider: boolean;

  github: { org: string; repo: string; branches: string[] };
}

/**
 * Production. Cut over to custom domains on 2026-08-31: the zone was already
 * delegated to Route53, so the apex and www now alias the CloudFront
 * distribution instead of the previous Netlify site.
 */
export const production: EnvConfig = {
  env: 'production',
  apiHost: 'api.caterkart.in',
  webHost: 'caterkart.in',
  redirectHosts: ['www.caterkart.in'],
  bundleId: 'small_3_1',
  availabilityZone: 'ap-south-1a',
  keyPairName: 'caterkart-production',
  // Home IPs are usually dynamic. Narrow this the day yours is not.
  sshAllowedCidrs: ['0.0.0.0/0'],
  snapshotTimeUtc: '20:00',
  hostedZoneId: 'Z01660108G6WGWKR1SDI',
  withCustomDomains: true,
  // zinwave-web-production owns it in this account.
  ownsOidcProvider: false,
  github: { org: 'zinwave', repo: 'caterkart', branches: ['main'] },
};

/**
 * Not deployed by default — `npm run deploy` targets production explicitly.
 * It exists so a staging box is one `cdk deploy` away rather than a redesign.
 * Deploying it adds a second instance (~$12/mo).
 */
export const staging: EnvConfig = {
  env: 'staging',
  apiHost: 'api.staging.caterkart.in',
  webHost: 'staging.caterkart.in',
  redirectHosts: [],
  bundleId: 'small_3_1',
  availabilityZone: 'ap-south-1a',
  keyPairName: 'caterkart-staging',
  sshAllowedCidrs: ['0.0.0.0/0'],
  snapshotTimeUtc: '21:00',
  hostedZoneId: undefined,
  withCustomDomains: false,
  ownsOidcProvider: false,
  github: { org: 'zinwave', repo: 'caterkart', branches: ['develop'] },
};
