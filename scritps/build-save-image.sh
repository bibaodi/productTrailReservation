#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# docker-compose.yml uses a fixed local tag so compose reuses the image that is
# already built/loaded locally instead of trying to pull a per-release tag.
imageRepo="trialreservation"
imageName="${imageRepo}:local"

# The git version is metadata only: it goes into .env for the compose label,
# and into a versioned tag kept for rollback.
imageVersion="$(git describe --tags --abbrev=0 2>/dev/null || true)"
if [ -z "${imageVersion}" ]; then
  echo "No git tag found; create one first: git tag vX.Y" >&2
  exit 1
fi
if ! git describe --tags --exact-match >/dev/null 2>&1; then
  echo "WARNING: HEAD is not tagged; ${imageVersion} is only the nearest tag. Run: git tag vX.Y" >&2
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "WARNING: working tree has uncommitted changes; image content will not exactly match ${imageVersion}." >&2
fi

echo "Building ${imageName} (version ${imageVersion})"

# compose reads IMAGE_TAG from .env for the version label.
printf 'IMAGE_TAG=%s\n' "${imageVersion}" > .env

# No --pull: reuse the cached node:24-alpine base image rather than contacting
# the registry on every build.
docker build \
  --label "org.opencontainers.image.version=${imageVersion}" \
  --label "org.opencontainers.image.revision=$(git rev-parse --short HEAD)" \
  -t "${imageName}" \
  .

# Keep a versioned tag next to the fixed one. Both tags point at the same
# image, so saving both does not duplicate the layers in the archive.
docker tag "${imageName}" "${imageRepo}:${imageVersion}"

# `docker load` on the server recreates both tags:
#   trialreservation:local  (used by docker-compose.yml)
#   trialreservation:<ver>  (kept for rollback)
docker save "${imageName}" "${imageRepo}:${imageVersion}" | gzip > trialreservation.tar.gz

remoteHost="${REMOTE_HOST:-ubuntu@54.223.40.69}"
remoteDir="${REMOTE_DIR:-/tmp}"
sshKey="${SSH_KEY:-$HOME/.aws/aws-labelme-ec.pem}"

# client side
rsync -avP -i "${sshKey}" ./.env ./docker-compose.yml "${remoteHost}:${remoteDir}"
rsync -avP -i "${sshKey}" ./trialreservation.tar.gz "${remoteHost}:${remoteDir}"

# ---------------------------------------------------------------------------
# server side (run on the server after both files above land in ${remoteDir})
# ---------------------------------------------------------------------------
## 01 load image: creates trialreservation:local and trialreservation:<version>
# gunzip -c trialreservation.tar.gz | sudo docker load
## 02 check images (optional)
# sudo docker image ls trialreservation
## 03 update compose files and recreate the container from the local image
# sudo cp /tmp/docker-compose.yml ~/261010-productTrialReserv/docker-compose.yml
# sudo cp /tmp/.env ~/261010-productTrialReserv/.env
# cd ~/261010-productTrialReserv && sudo docker compose up -d --no-build --force-recreate
## 04 roll back: retag an older version as local, then recreate
# sudo docker tag trialreservation:v1.1 trialreservation:local
# cd ~/261010-productTrialReserv && sudo docker compose up -d --no-build --force-recreate
## 05 optional: clean up layers left behind by replaced tags
# sudo docker image prune -f
