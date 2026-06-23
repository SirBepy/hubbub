import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { WebSocketClientTransport, type Player } from "@hubbub/protocol";
import { SERVER_URL, CONTROLLER_URL } from "./config";

export function App() {
  const [code, setCode] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [qr, setQr] = useState<string>("");
  const transportRef = useRef<WebSocketClientTransport>();

  useEffect(() => {
    const t = new WebSocketClientTransport(SERVER_URL);
    transportRef.current = t;
    let off = () => {};
    t.connect().then(() => {
      off = t.onMessage((msg) => {
        if (msg.t === "roomCreated") {
          setCode(msg.code);
          const joinUrl = `${CONTROLLER_URL}/?room=${msg.code}`;
          QRCode.toDataURL(joinUrl).then(setQr);
        } else if (msg.t === "roomState") {
          setPlayers(msg.players);
        }
      });
      t.send({ t: "createRoom" });
    });
    return () => {
      off();
      t.close();
    };
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", textAlign: "center", padding: 32 }}>
      <h1>Hubbub</h1>
      <p>
        Join at <strong>{CONTROLLER_URL.replace(/^https?:\/\//, "")}</strong>
      </p>
      <h2 style={{ fontSize: 64, letterSpacing: 8 }}>{code || "…"}</h2>
      {qr && <img src={qr} alt="Join QR" width={220} height={220} />}
      <h3>Players ({players.length})</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {players.map((p) => (
          <li key={p.id} style={{ opacity: p.connected ? 1 : 0.4 }}>
            {p.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
