#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$PROJECT_DIR/var/log"
BACKUP_DIR="$PROJECT_DIR/backups"
APP_LABEL="com.peopleactioncheck.slack"
BACKUP_LABEL="com.peopleactioncheck.backup"

mkdir -p "$LAUNCH_DIR" "$LOG_DIR" "$BACKUP_DIR"
chmod 700 "$LOG_DIR" "$BACKUP_DIR"

cat > "$LAUNCH_DIR/$APP_LABEL.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$APP_LABEL</string>
  <key>ProgramArguments</key><array>
    <string>/usr/bin/caffeinate</string><string>-i</string><string>$NODE_BIN</string><string>--env-file=.env</string><string>src/app.js</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJECT_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/app.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/app-error.log</string>
</dict></plist>
PLIST

cat > "$LAUNCH_DIR/$BACKUP_LABEL.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$BACKUP_LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$NODE_BIN</string><string>--env-file=.env</string><string>scripts/backup.js</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJECT_DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>BACKUP_DIR</key><string>$BACKUP_DIR</string>
    <key>BACKUP_RETAIN</key><string>14</string>
  </dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer></dict>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/backup.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/backup-error.log</string>
</dict></plist>
PLIST

chmod 600 "$LAUNCH_DIR/$APP_LABEL.plist" "$LAUNCH_DIR/$BACKUP_LABEL.plist"
plutil -lint "$LAUNCH_DIR/$APP_LABEL.plist" "$LAUNCH_DIR/$BACKUP_LABEL.plist"
launchctl bootout "gui/$UID/$APP_LABEL" 2>/dev/null || true
launchctl bootout "gui/$UID/$BACKUP_LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$LAUNCH_DIR/$APP_LABEL.plist"
launchctl bootstrap "gui/$UID" "$LAUNCH_DIR/$BACKUP_LABEL.plist"
launchctl kickstart -k "gui/$UID/$APP_LABEL"
launchctl kickstart -k "gui/$UID/$BACKUP_LABEL"
echo "People Action Check startup and daily backup services are installed."
