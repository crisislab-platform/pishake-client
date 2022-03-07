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
apt update -y > /dev/null
apt-get install curl -y > /dev/null

echo Adding Node.js source
curl -sL https://deb.nodesource.com/setup_17.x | sudo -E bash - > /dev/null

echo Installing Node.js
apt-get install -y nodejs > /dev/null
# (crontab -l 2>/dev/null; echo "@reboot CRISISLAB_SENSOR_TOKEN=") | crontab - > /dev/null
# (crontab -l 2>/dev/null; echo "@reboot node /opt/pishake-client/script.js") | crontab - > /dev/null

echo Downloading client
git clone https://github.com/rs-Web-Interface-CRISiSLab/pishake-client.git /opt/pishake-client > /dev/null
cd /opt/pishake-client

echo Installing dependencies
npm install > /dev/null


# Install as service
echo Installing service
sed -i 's/<token>/'$CRISISLAB_SENSOR_TOKEN'/g' /opt/pishake-client/pishake-client.service
cp /opt/pishake-client/pishake-client.service /etc/systemd/system/pishake-client.service
systemctl daemon-reload
systemctl enable pishake-client.service
systemctl start pishake-client.service

echo Done\! Your sensor should now be streaming data to the server.