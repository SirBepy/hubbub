// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QrScanButton } from "./qr-scan";
import { JoinScreen } from "../../web/src/join";

const identity = { name: "Mira", avatarId: "bear", colorId: 0 } as never;

function stubCamera(opts: { secure?: boolean; getUserMedia?: unknown }) {
  vi.stubGlobal("isSecureContext", opts.secure ?? true);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: opts.getUserMedia === undefined ? undefined : { getUserMedia: opts.getUserMedia },
  });
}

function fakeStream() {
  const track = { stop: vi.fn() };
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
}

function stubDetector(rawValues: string[]) {
  const queue = [...rawValues];
  class FakeDetector {
    async detect() {
      const rawValue = queue.shift();
      return rawValue ? [{ rawValue }] : [];
    }
  }
  vi.stubGlobal("BarcodeDetector", FakeDetector);
}

beforeEach(() => {
  // jsdom has no media playback: give the video element the minimum the scanner touches.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("QrScanButton availability", () => {
  it("renders nothing outside a secure context (plain-HTTP LAN)", () => {
    stubCamera({ secure: false, getUserMedia: vi.fn() });
    render(<QrScanButton onCode={() => undefined} />);
    expect(screen.queryByLabelText("Scan QR code")).toBeNull();
  });

  it("renders nothing when the browser has no getUserMedia", () => {
    stubCamera({ secure: true, getUserMedia: undefined });
    render(<QrScanButton onCode={() => undefined} />);
    expect(screen.queryByLabelText("Scan QR code")).toBeNull();
  });
});

describe("QrScanButton scanning", () => {
  it("fills the code from a scanned join URL, closes the overlay and stops the camera", async () => {
    const { track, stream } = fakeStream();
    stubCamera({ getUserMedia: vi.fn().mockResolvedValue(stream) });
    stubDetector(["https://hubbub.sirbepy.dev/?room=k7qx"]);
    const onCode = vi.fn();
    render(
      <div style={{ position: "relative" }}>
        <QrScanButton onCode={onCode} />
      </div>,
    );

    fireEvent.click(screen.getByLabelText("Scan QR code"));
    await waitFor(() => expect(onCode).toHaveBeenCalledWith("K7QX"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(track.stop).toHaveBeenCalled();
  });

  it("asks for the rear camera", async () => {
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream().stream);
    stubCamera({ getUserMedia });
    stubDetector([]);
    render(<QrScanButton onCode={() => undefined} />);
    fireEvent.click(screen.getByLabelText("Scan QR code"));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    expect(getUserMedia.mock.calls[0][0].video).toEqual({ facingMode: "environment" });
  });

  it("keeps scanning and hints when the QR is not a Hubbub code, then accepts a real one", async () => {
    const { stream } = fakeStream();
    stubCamera({ getUserMedia: vi.fn().mockResolvedValue(stream) });
    stubDetector(["https://example.com/menu", "K7QX"]);
    const onCode = vi.fn();
    render(<QrScanButton onCode={onCode} />);

    fireEvent.click(screen.getByLabelText("Scan QR code"));
    await screen.findByText("That is not a Hubbub code");
    expect(onCode).not.toHaveBeenCalled();
    await waitFor(() => expect(onCode).toHaveBeenCalledWith("K7QX"));
  });

  it("shows a message with a working close button when camera permission is denied", async () => {
    stubCamera({ getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) });
    render(<QrScanButton onCode={() => undefined} />);

    fireEvent.click(screen.getByLabelText("Scan QR code"));
    await screen.findByText(/Camera access is blocked/);
    fireEvent.click(screen.getByLabelText("Close scanner"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stops the camera when closed before any code is read", async () => {
    const { track, stream } = fakeStream();
    stubCamera({ getUserMedia: vi.fn().mockResolvedValue(stream) });
    stubDetector([]);
    render(<QrScanButton onCode={() => undefined} />);

    fireEvent.click(screen.getByLabelText("Scan QR code"));
    await waitFor(() => expect(document.querySelector("video")!.srcObject).toBe(stream));
    expect(track.stop).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Close scanner"));
    expect(track.stop).toHaveBeenCalled();
  });
});

describe("web JoinScreen wiring", () => {
  it("puts a scanned code in the input without joining", async () => {
    const { stream } = fakeStream();
    stubCamera({ getUserMedia: vi.fn().mockResolvedValue(stream) });
    stubDetector(["https://hubbub.sirbepy.dev/?room=K7QX"]);
    const onJoin = vi.fn();
    render(<JoinScreen identity={identity} onEditIdentity={() => undefined} onJoin={onJoin} onHostInstead={() => undefined} />);

    fireEvent.click(screen.getByLabelText("Scan QR code"));
    await waitFor(() => expect((screen.getByPlaceholderText("CODE") as HTMLInputElement).value).toBe("K7QX"));
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("shows no scan button on the join screen when the camera is unavailable", () => {
    stubCamera({ secure: false, getUserMedia: vi.fn() });
    render(<JoinScreen identity={identity} onEditIdentity={() => undefined} onJoin={() => undefined} onHostInstead={() => undefined} />);
    expect(screen.queryByLabelText("Scan QR code")).toBeNull();
    expect(screen.getByPlaceholderText("CODE")).toBeTruthy();
  });
});
