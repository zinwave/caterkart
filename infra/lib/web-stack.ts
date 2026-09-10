import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { EnvConfig } from './config';

export interface WebStackProps extends cdk.StackProps {
  config: EnvConfig;
  /** From the us-east-1 CertStack. Present only when `withCustomDomains`. */
  certificateArn?: string;
}

/**
 * The CaterKart Celebrations SPA: a private S3 bucket behind CloudFront.
 *
 * No compute, because there is nothing to compute — the build is static and the
 * API lives on its own host. The bucket is private and reachable only through
 * Origin Access Control; S3 static-website hosting would need a public bucket
 * and cannot terminate TLS.
 */
export class WebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);
    const { config, certificateArn } = props;

    // --- Origin ---------------------------------------------------------------
    // DESTROY is safe here and deliberate: every object is reproducible from a
    // `npm run build`. Nothing in this bucket is data.
    const bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- Edge behaviour -------------------------------------------------------
    const router = new cloudfront.Function(this, 'Router', {
      code: cloudfront.FunctionCode.fromFile({
        filePath: path.join(__dirname, 'router-function.js'),
      }),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: 'www → apex 301, and SPA deep links → /index.html',
    });

    // No Content-Security-Policy: the app ships inline styles, and a policy
    // written blind would either break the page or be so loose it asserts
    // nothing. Add it deliberately, in report-only first.
    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });

    const withDomains = config.withCustomDomains && !!certificateArn;

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: securityHeaders,
        compress: true,
        functionAssociations: [
          { function: router, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      defaultRootObject: 'index.html',
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // India and EU edges. The whole audience is in India; the full edge set
      // costs more for no benefit here.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      // The router already rewrites every extensionless path to the shell, so a
      // 403 reaching here is a genuinely missing object — almost always a stale
      // hashed asset. Serve the shell so the page is not blank, but keep the 404
      // status rather than claiming 200 for something that does not exist.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 404, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 404, responsePagePath: '/index.html' },
      ],
      ...(withDomains
        ? {
            domainNames: [config.webHost, ...config.redirectHosts],
            certificate: acm.Certificate.fromCertificateArn(this, 'Cert', certificateArn!),
          }
        : {}),
    });

    // --- DNS ------------------------------------------------------------------
    // An alias, not a CNAME: an apex cannot be a CNAME, which is precisely why
    // this zone has to live in Route53 rather than at the registrar.
    if (withDomains && config.hostedZoneId) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
        hostedZoneId: config.hostedZoneId,
        zoneName: config.webHost,
      });
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));

      // These records are CDK-managed now. The cutover deploy carried
      // `deleteExisting` to displace the plain A records the previous host left
      // at the apex and www; it was removed immediately afterwards, because on a
      // failed deploy it would take the live records down with it.
      for (const host of [config.webHost, ...config.redirectHosts]) {
        const slug = host.replace(/[^a-zA-Z0-9]/g, '');
        new route53.ARecord(this, `A${slug}`, { zone, recordName: host, target });
        new route53.AaaaRecord(this, `AAAA${slug}`, { zone, recordName: host, target });
      }
    }

    // --- CI deploy role -------------------------------------------------------
    // Scoped to shipping a build: sync the bucket and invalidate the edge. It
    // cannot touch the distribution's configuration, the certificate or DNS —
    // deploying content should not carry the power to rewrite infrastructure.
    const providerArn = `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`;
    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GithubOidc',
      providerArn,
    );

    const deployRole = new iam.Role(this, 'WebDeployRole', {
      roleName: `caterkart-web-deploy-${config.env}`,
      description: 'GitHub Actions: sync the site bucket and invalidate CloudFront.',
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: {
          'token.actions.githubusercontent.com:sub': config.github.branches.map(
            (b) => `repo:${config.github.org}/${config.github.repo}:ref:refs/heads/${b}`,
          ),
        },
      }),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    bucket.grantReadWrite(deployRole);
    bucket.grantDelete(deployRole);
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        ],
      }),
    );

    // --- Outputs --------------------------------------------------------------
    new cdk.CfnOutput(this, 'SiteBucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: distribution.distributionDomainName,
      description: 'Verify the site here before the DNS cutover.',
    });
    new cdk.CfnOutput(this, 'SiteUrl', {
      value: withDomains ? `https://${config.webHost}` : `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'WebDeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Set as the AWS_WEB_DEPLOY_ROLE_ARN repo variable.',
    });
  }
}
