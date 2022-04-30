#!/bin/bash

# Check if running as root
if [ "$(id -u)" != "0" ]; then
    echo "This script must be run as root" 1>&2
    exit 1
fi

set -Ee

function _catch {
    echo "An error has occured in the script. Please contact Ben at CRISiSLab for assistance."
    exit 0  # optional; use if you don't want to propagate (rethrow) error to outer shell
}
trap _catch ERR

CRISISLAB_SENSOR_TOKEN=$1

# Check if token is set
if [ -z "$CRISISLAB_SENSOR_TOKEN" ]; then
    echo CRISISLAB_SENSOR_TOKEN is not set
    exit 1
fi

echo Installing dependencies
apt-get remove gpsd gpsd-clients python-gps -y
apt update -y
apt install git curl

echo Downloading client
rm -rf /opt/pishake-client
git clone https://github.com/rs-Web-Interface-CRISiSLab/Decentralised_Processing_PLUM_V1.0.git /opt/plum-client
cd /opt/plum-client

echo Installing Decentralised PLUM Algorithm
bash setup.sh

# Install as service
# echo Installing service
# sed -i 's/<token>/'$CRISISLAB_SENSOR_TOKEN'/g' /opt/pishake-client/pishake-client.service
# cp /opt/pishake-client/pishake-client.service /etc/systemd/system/pishake-client.service
# systemctl daemon-reload
# systemctl enable pishake-client.service
# systemctl start pishake-client.service

echo Done\! Your sensor should now be part of our network.
