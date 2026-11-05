import { useEffect, useRef, useState, type CSSProperties } from "react";
import { QrCode } from "@phosphor-icons/react/dist/csr/QrCode";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { parseJoinCode } from "./qr-code";

// Frames are decoded at this cadence and downscaled to this width: a QR on a TV fills most of
// the frame, so full-resolution jsQR passes would only burn battery.
const SCAN_INTERVAL_MS = 120;
const FALLBACK_MAX_WIDTH = 480;

interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

/** getUserMedia only exists in a secure context, so on plain-HTTP LAN the button must not
 * render at all rather than open a scanner that can never start. */
export function canScanQr(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === true && !!navigator.mediaDevices?.getUserMedia;
}

/** Native BarcodeDetector where it exists (Chrome/Android), else a lazily loaded jsQR on a
 * canvas copy of the frame (iOS Safari has no BarcodeDetector). */
function createFrameDecoder(): (video: HTMLVideoElement) => Promise<string | null> {
  const Native = (globalThis as { BarcodeDetector?: new (opts: { formats: string[] }) => NativeDetector }).BarcodeDetector;
  if (Native) {
    const detector = new Native({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!ctx || !video.videoWidth) return null;
    const scale = Math.min(1, FALLBACK_MAX_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { default: jsQR } = await import("jsqr");
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(frame.data, frame.width, frame.height)?.data || null;
  };
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  return name === "NotAllowedError" || name === "SecurityError"
    ? "Camera access is blocked. Allow it in your browser settings to scan."
    : "Could not start the camera.";
}

/** Full-screen camera overlay. Calls `onCode` once with a valid room code; the caller closes it. */
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  // Latest callbacks without restarting the camera when the parent re-renders.
  const cbRef = useRef({ onCode, onClose });
  cbRef.current = { onCode, onClose };

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Tracks must be stopped on every exit path, or the phone's camera light stays on.
    const stopCamera = () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };

    (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        await video.play().catch(() => undefined);
        const decode = createFrameDecoder();

        const tick = async () => {
          if (stopped) return;
          try {
            const raw = video.readyState >= 2 ? await decode(video) : null;
            if (stopped) return;
            if (raw) {
              const code = parseJoinCode(raw);
              if (code) {
                stopCamera();
                cbRef.current.onCode(code);
                return;
              }
              setInvalid(true);
            }
          } catch {
            // A failed frame (detector hiccup) is not fatal; the next tick retries.
          }
          timer = setTimeout(tick, SCAN_INTERVAL_MS);
        };
        tick();
      } catch (err) {
        if (!stopped) setFatal(cameraErrorMessage(err));
      }
    })();

    return stopCamera;
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan QR code" style={overlay}>
      <video ref={videoRef} muted playsInline style={videoStyle} />
      <button type="button" onClick={() => cbRef.current.onClose()} aria-label="Close scanner" style={closeButton}>
        <X size={20} weight="bold" />
      </button>
      {fatal ? null : <div aria-hidden style={reticle} />}
      <div style={caption}>
        {fatal ?? (invalid ? "That is not a Hubbub code" : "Point at the QR code on the big screen")}
      </div>
    </div>
  );
}

/** Quiet inline icon button that opens the scanner. Renders nothing where the camera is
 * unavailable. Position it inside a `position: relative` row; it pins to the right edge. */
export function QrScanButton({ onCode }: { onCode: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!canScanQr()) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Scan QR code" style={scanButton}>
        <QrCode size={22} weight="bold" />
      </button>
      {open ? (
        <QrScanner
          onCode={(code) => {
            setOpen(false);
            onCode(code);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

const scanButton: CSSProperties = {
  position: "absolute",
  right: 6,
  top: "50%",
  transform: "translateY(-50%)",
  width: 48,
  height: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  borderRadius: "var(--radius-md)",
  color: "var(--text-muted)",
  cursor: "pointer",
};
const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-end",
};
const videoStyle: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
const closeButton: CSSProperties = {
  position: "absolute",
  top: "max(14px, env(safe-area-inset-top))",
  right: 14,
  width: 48,
  height: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface-1)",
  border: "1px solid var(--divider)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  cursor: "pointer",
};
const reticle: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  width: "62vmin",
  height: "62vmin",
  transform: "translate(-50%, -50%)",
  border: "2px solid var(--text-primary)",
  borderRadius: "var(--radius-md)",
  opacity: 0.5,
  pointerEvents: "none",
};
const caption: CSSProperties = {
  position: "relative",
  margin: "0 20px max(36px, env(safe-area-inset-bottom))",
  padding: "10px 14px",
  background: "var(--surface-1)",
  border: "1px solid var(--divider)",
  borderRadius: "var(--radius-md)",
  font: "500 14px var(--font-ui)",
  textAlign: "center",
};
