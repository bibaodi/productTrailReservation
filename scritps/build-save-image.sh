# client side
docker build -t trialreservation:v01 .
docker save trialreservation:v01 | gzip > trialreservation.tar.gz
rsync -avP -i ~/.aws/aws-labelme-ec.pem ./trialreservation.tar.gz ubuntu@54.223.40.69:/tmp

## server side
gunzip -c trialreservation.tar.gz |sudo docker load

sudo docker compose up -d --no-build --force-recreate
