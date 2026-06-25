#!/bin/sh -e
# ООО "МАС"
# Проект: 27/2025-N1-МАС
# Ревизия: rev.03
# Версия: v06
# Дата: 12 июня 2026 г.
#
# *** SAFE SHUTDOWN ***
# Modify /etc/systemd/logind.conf
if ! systemd-analyze cat-config systemd/logind.conf |
       grep '^HandlePowerKey=ignore' > /dev/null; then
  mkdir /etc/systemd/logind.conf.d -p
  echo "[Login]
HandlePowerKey=ignore" |
  sudo tee /etc/systemd/logind.conf.d/safeshutdown.conf
fi
sudo systemctl restart systemd-logind

SUDOERS_LINE="nobody ALL=(ALL) NOPASSWD: /usr/local/bin/blitz.shutdown.sh"
# Check if the line already exists in the sudoers file
if ! sudo grep -Fxq "$SUDOERS_LINE" /etc/sudoers; then
  echo "Adding line to sudoers file..."
  echo "$SUDOERS_LINE" | sudo tee -a /etc/sudoers > /dev/null
fi

# Create Triggerhappy trigger file
echo 'KEY_POWER    1    sudo /usr/local/bin/blitz.shutdown.sh' |
  sudo tee /etc/triggerhappy/triggers.d/powerbutton.conf > /dev/null
sudo systemctl restart triggerhappy

# create blitz.shutdown.sh script
echo 'shutdown --poweroff now' | sudo tee /usr/local/bin/blitz.shutdown.sh > /dev/null
chmod +x /usr/local/bin/blitz.shutdown.sh
