#!/bin/bash
cd /home/apps/renew-group-system || exit
systemctl stop renew-group-system.service
git pull
npm install
npm run build
systemctl start renew-group-system.service