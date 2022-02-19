sudo apt-get install curl -y
curl -sL https://deb.nodesource.com/setup_17.x | sudo -E bash -
sudo apt-get install -y nodejs
(crontab -l 2>/dev/null; echo "@reboot node /opt/pishake-client/script.js") | crontab -
