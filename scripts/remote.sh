#!/usr/bin/env bash
#
# Ship code and secrets to the Lightsail instance, and operate it.
#
#   ./scripts/remote.sh env      # scp server/.env.production (secrets)
#   ./scripts/remote.sh app      # rsync server/, build, start
#   ./scripts/remote.sh logs|ps|restart|ssh|backup
#
# The host is resolved from the CDK stack output rather than hardcoded, so
# replacing the instance does not mean editing scripts.
#
set -euo pipefail

ENVIRONMENT="${CATERKART_ENV:-production}"
PROFILE="${AWS_PROFILE:-zinwave-admin}"
REGION=ap-south-1
STACK="caterkart-api-$ENVIRONMENT"
KEY="$HOME/.ssh/caterkart-$ENVIRONMENT"
REMOTE_DIR=/opt/caterkart
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

die() { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

[[ -f "$KEY" ]] || die "missing $KEY — run infra/scripts/setup-aws.sh first"

IP=$(aws lightsail get-static-ip --static-ip-name "caterkart-api-$ENVIRONMENT-ip" \
       --profile "$PROFILE" --region "$REGION" \
       --query 'staticIp.ipAddress' --output text 2>/dev/null) \
  || die "cannot read the static IP — is $STACK deployed?"
[[ "$IP" != "None" && -n "$IP" ]] || die "no static IP found for $ENVIRONMENT"

SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new)
HOST="ubuntu@$IP"

case "${1:-}" in
  env)
    ENV_FILE="$ROOT/server/.env.production"
    [[ -f "$ENV_FILE" ]] || die "missing server/.env.production — copy .env.production.example and fill it"
    # A CHANGE_ME reaching production means an unencrypted token store or a
    # guessable JWT secret. Refuse rather than warn.
    ! grep -q CHANGE_ME "$ENV_FILE" || die "server/.env.production still contains CHANGE_ME"
    ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p $REMOTE_DIR"
    scp "${SSH_OPTS[@]}" "$ENV_FILE" "$HOST:$REMOTE_DIR/.env.production"
    ssh "${SSH_OPTS[@]}" "$HOST" "chmod 600 $REMOTE_DIR/.env.production"
    echo "secrets shipped to $IP"
    ;;
  app)
    ssh "${SSH_OPTS[@]}" "$HOST" "test -f /var/log/caterkart-bootstrap-complete" \
      || die "cloud-init is still running — wait ~2 min and retry"
    # --exclude protects .env.production on the receiving side: rsync --delete
    # does not remove excluded files, so shipping code never drops the secrets.
    rsync -az --delete \
      --exclude node_modules --exclude dist --exclude .env --exclude .env.production \
      -e "ssh ${SSH_OPTS[*]}" "$ROOT/server/" "$HOST:$REMOTE_DIR/"
    ssh "${SSH_OPTS[@]}" "$HOST" "cd $REMOTE_DIR && $COMPOSE up -d --build && docker image prune -f"
    echo "deployed to $IP"
    ;;
  logs)    ssh "${SSH_OPTS[@]}" "$HOST" "cd $REMOTE_DIR && $COMPOSE logs -f --tail=100" ;;
  ps)      ssh "${SSH_OPTS[@]}" "$HOST" "cd $REMOTE_DIR && $COMPOSE ps" ;;
  restart) ssh "${SSH_OPTS[@]}" "$HOST" "cd $REMOTE_DIR && $COMPOSE restart api" ;;
  ssh)     ssh "${SSH_OPTS[@]}" "$HOST" ;;
  backup)
    mkdir -p "$ROOT/backups"
    OUT="$ROOT/backups/caterkart-$(date +%F-%H%M).sql.gz"
    ssh "${SSH_OPTS[@]}" "$HOST" "cd $REMOTE_DIR && $COMPOSE exec -T db pg_dump -U caterkart caterkart | gzip" > "$OUT"
    ls -lh "$OUT"
    ;;
  *) die "usage: $0 {env|app|logs|ps|restart|ssh|backup}" ;;
esac
