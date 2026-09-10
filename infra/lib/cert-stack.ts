import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { EnvConfig } from './config';

export interface CertStackProps extends cdk.StackProps {
  config: EnvConfig;
  hostedZoneId: string;
}

/**
 * The site's TLS certificate, in us-east-1 because CloudFront will not accept a
 * certificate from anywhere else. That is the *only* reason this is a separate
 * stack; the web stack consumes `certificateArn` across regions.
 *
 * Deployed only when `withCustomDomains` is on — before the cutover there is no
 * custom domain to certify, and issuance would block for half an hour on DNS
 * validation records in a zone that is not yet authoritative, then roll back.
 *
 * The API needs nothing from here: Caddy on the Lightsail box gets its own
 * certificate from Let's Encrypt.
 */
export class CertStack extends cdk.Stack {
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CertStackProps) {
    super(scope, id, props);
    const { config, hostedZoneId } = props;

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId,
      zoneName: config.webHost,
    });

    // DNS validation writes the _acm-challenge CNAMEs into the zone itself, so
    // issuance completes without anyone touching the registrar. It does block
    // until the zone is authoritative — delegate the NS records first.
    const cert = new acm.Certificate(this, 'Cert', {
      domainName: config.webHost,
      subjectAlternativeNames: config.redirectHosts.length ? config.redirectHosts : undefined,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    this.certificateArn = cert.certificateArn;
    new cdk.CfnOutput(this, 'CertificateArn', { value: cert.certificateArn });
  }
}
