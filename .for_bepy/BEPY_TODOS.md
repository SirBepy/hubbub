# BEPY TODOs

### Visual QA

- Play a full Tic-Tac-Toe game on two real phones over LAN: with the dev stack running, open `http://<this-PC-LAN-ip>:5174/?room=<CODE>` (or scan the QR on `http://localhost:5173`) on two phones, join as two players, and confirm moves, turn-locking, and the win banner all sync to the screen. (Claude verified the full two-player flow browser-to-browser via Playwright, incl. win detection and game-over lockout; only the actual-phone hop needs your devices. LAN IPs seen during dev: 192.168.178.67, 100.74.99.126.)
