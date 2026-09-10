#!/bin/bash
# Lightsail user_data — runs once, as root, on first boot.
#
# Lightsail PREPENDS its own lines to user-data, so this shebang is no longer
# line 1 by the time cloud-init writes the script out — cloud-init therefore
# falls back to /bin/sh (dash), which has no `pipefail`, and the whole script
# dies on the `set` below. Re-exec under bash before doing anything else.
# Without this the instance boots with no Docker and no swap, and cloud-init
# reports `status: error` while the stack still reports CREATE_COMPLETE.
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
# Installs Docker and prepares /opt/caterkart. It deliberately does NOT fetch
# the app or any secrets: user_data is readable from the instance metadata API,
# so nothing sensitive belongs here. `make deploy` ships the code and env.
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# Docker CE + compose plugin from Docker's own repo (Ubuntu's is too old).
apt-get install -y ca-certificates curl gnupg git ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
usermod -aG docker ubuntu

# Host firewall behind Lightsail's own rules — defence in depth. Postgres and
# Redis publish no host ports, but this makes that explicit.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 2 GB is tight with Postgres + Redis + Node. Swap prevents an OOM kill from
# taking the API down during a build.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Unattended security updates.
apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

mkdir -p /opt/caterkart
chown -R ubuntu:ubuntu /opt/caterkart

touch /var/log/caterkart-bootstrap-complete
