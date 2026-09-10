#!/usr/bin/env bash
#
# Stand up (or update) the CaterKart Celebrations stack on AWS, in order,
# idempotently.
#
#   ./scripts/setup-aws.sh                  # profile zinwave-admin, env production
#   ./scripts/setup-aws.sh --profile other
#   ./scripts/setup-aws.sh --yes            # skip the account confirmation
#
# Safe to re-run: bootstrapping is a no-op once done, an existing key pair is
# never overwritten, and `cdk deploy` only applies what changed.
#
# What it does NOT do, deliberately:
#   - create or move the Route53 hosted zone (caterkart.in is on Netlify's
#     nameservers and its apex serves the live catering site — moving DNS is a
#     deliberate cutover, not a side effect of running a script)
#   - write .env.production (secrets are typed by the person who owns them and
#     shipped with `npm run deploy:env` — never through CloudFormation, whose
#     template and stack events are readable)
#
set -euo pipefail

PROFILE=zinwave-admin
ENVIRONMENT=production
REGION=ap-south-1
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --env)     ENVIRONMENT="$2"; shift 2 ;;
    --yes|-y)  ASSUME_YES=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK="caterkart-api-$ENVIRONMENT"
KEY_NAME="caterkart-$ENVIRONMENT"
KEY_PATH="$HOME/.ssh/$KEY_NAME"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
note() { printf '  %s\n' "$1"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# --- 0. Preflight ------------------------------------------------------------
step "Preflight"

command -v aws >/dev/null || die "the AWS CLI is not installed (brew install awscli)"
command -v node >/dev/null || die "node is not on PATH"
[[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]] || die "node 20+ is required"

ACCOUNT=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text 2>/dev/null) \
  || die "profile '$PROFILE' cannot authenticate — run 'aws configure --profile $PROFILE'"
note "account $ACCOUNT, region $REGION, stack $STACK"

if [[ "$ASSUME_YES" -eq 0 ]]; then
  read -r -p "  Deploy to account $ACCOUNT? [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]] || die "aborted"
fi

# --- 1. SSH key pair ---------------------------------------------------------
# CloudFormation has no AWS::Lightsail::KeyPair resource, so this lives outside
# the stack and is referenced by name — the same rule the Route53 zone follows.
step "SSH key pair"

# Two Lightsail quirks, both learned the hard way:
#   - ImportKeyPair accepts ssh-rsa ONLY. An ed25519 key is rejected outright.
#   - --public-key-base64 takes the .pub file's contents verbatim. The AAAAB3...
#     body is already base64, so encoding it again yields InvalidInputException.
if [[ -f "$KEY_PATH.pub" ]] && ! grep -q '^ssh-rsa ' "$KEY_PATH.pub"; then
  BAK="$KEY_PATH.bak-$(date +%s)"
  mv "$KEY_PATH" "$BAK"
  mv "$KEY_PATH.pub" "$BAK.pub"
  note "existing key is not ssh-rsa, which Lightsail rejects — moved aside to $BAK"
fi

if [[ ! -f "$KEY_PATH" ]]; then
  ssh-keygen -t rsa -b 4096 -f "$KEY_PATH" -N "" -C "$KEY_NAME" >/dev/null
  note "created $KEY_PATH (rsa-4096)"
else
  note "$KEY_PATH already exists"
fi

if aws lightsail get-key-pair --key-pair-name "$KEY_NAME" \
     --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  note "lightsail key pair '$KEY_NAME' already imported"
else
  aws lightsail import-key-pair \
    --key-pair-name "$KEY_NAME" \
    --public-key-base64 "$(cat "$KEY_PATH.pub")" \
    --profile "$PROFILE" --region "$REGION" >/dev/null
  note "imported '$KEY_NAME' into Lightsail"
fi

# --- 2. CDK ------------------------------------------------------------------
step "CDK bootstrap"
cd "$INFRA_DIR"
[[ -d node_modules ]] || npm ci
npx cdk bootstrap "aws://$ACCOUNT/$REGION" --profile "$PROFILE" >/dev/null
note "bootstrapped (no-op if already done)"

step "Deploy $STACK"
npx cdk deploy "$STACK" --profile "$PROFILE" --require-approval any-change \
  --outputs-file cdk-outputs.json

# --- 3. Next steps -----------------------------------------------------------
step "Next"
IP=$(node -p "require('./cdk-outputs.json')['$STACK'].StaticIpAddress" 2>/dev/null || echo '?')
URI=$(node -p "require('./cdk-outputs.json')['$STACK'].SwiggyRedirectUri" 2>/dev/null || echo '?')

note "1. Add an A record at your DNS provider:  api.caterkart.in -> $IP"
note "   Wait for it to resolve BEFORE deploying — Caddy requests a certificate"
note "   on first boot and Let's Encrypt rate-limits repeated failures."
note ""
note "2. cp ../server/.env.production.example ../server/.env.production"
note "   Fill every CHANGE_ME (openssl rand -hex 32)."
note ""
note "3. npm run deploy:env && npm run deploy:app     (from the repo root)"
note ""
note "4. Register with builders@swiggy.in:  $URI"
