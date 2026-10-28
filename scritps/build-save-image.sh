#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Image tag follows the latest reachable git tag (e.g. v1.2). The tag is written
# to .env, which docker compose auto-loads for ${IMAGE_TAG} in docker-compose.yml.
imageVersion="$(git describe --tags --abbrev=0)"
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
echo "Building trialreservation:${imageVersion}"

# docker-compose.yml interpolates ${IMAGE_TAG} from this file, so `docker compose`
# uses exactly the tag that was built and loaded.
printf 'IMAGE_TAG=%s\n' "${imageVersion}" > .env

# client side
docker build -t trialreservation:"${imageVersion}" .
docker save trialreservation:"${imageVersion}" | gzip > trialreservation.tar.gz
rsync -avP -i ~/.aws/aws-labelme-ec.pem ./.env ./docker-compose.yml ubuntu@54.223.40.69:/tmp
rsync -avP -i ~/.aws/aws-labelme-ec.pem ./trialreservation.tar.gz ubuntu@54.223.40.69:/tmp

# ---------------------------------------------------------------------------
# server side (run on the server after both files above land in /tmp)
# ---------------------------------------------------------------------------
## 01 load from file to image
# gunzip -c trialreservation.tar.gz | sudo docker load
## 02 stop and remove previous container
# sudo docker ps
# sudo docker image ls
# sudo docker stop trialreservation
# sudo docker rm trialreservation
## 03 start the new image from compose.yml (IMAGE_TAG in .env matches the loaded image)
# sudo cp /tmp/docker-compose.yml ~/261010-productTrialReserv/docker-compose.yml
# sudo cp /tmp/.env ~/261010-productTrialReserv/.env
# cd ~/261010-productTrialReserv && sudo docker compose up -d --no-build --force-recreate
