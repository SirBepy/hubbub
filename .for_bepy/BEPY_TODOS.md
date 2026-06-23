# BEPY TODOs

### Visual QA

- Verify the real phone-on-LAN join: with the dev stack running, on your phone (same WiFi) open `http://<this-PC-LAN-ip>:5174/?room=<CODE>` or scan the QR on the screen, enter a name, and confirm it appears on the screen at `http://localhost:5173`. (Claude verified the full flow browser-to-browser via Playwright; only the actual-phone hop needs your device. LAN IPs seen during dev: 192.168.178.67, 100.74.99.126.)
