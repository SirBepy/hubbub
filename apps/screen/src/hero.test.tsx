// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Hero } from "./hero";

afterEach(cleanup);

const card = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-measure="kraft-card"]')!;
const codeNode = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-measure="room-code"]')!;

describe("Hero loading state", () => {
  it("keeps the QR + code card in layout but invisible while the room does not exist yet", () => {
    const { container } = render(<Hero code="" qr="" />);

    expect(card(container).style.opacity).toBe("0");
    expect(card(container).getAttribute("aria-hidden")).toBe("true");
    expect(card(container).className).not.toContain("hb-anim-deal");
    // No placeholder glyphs and no QR image to pop in.
    expect(codeNode(container).textContent?.trim()).toBe("");
    expect(container.querySelector("img")).toBeNull();
  });

  it("deals the card in once the code exists, with the QR fading in after it", () => {
    const { container, rerender } = render(<Hero code="" qr="" />);
    rerender(<Hero code="ABCD" qr="data:image/png;base64,AAAA" />);

    expect(card(container).style.opacity).toBe("");
    expect(card(container).className).toContain("hb-anim-deal");
    expect(codeNode(container).textContent).toBe("ABCD");
    const img = container.querySelector<HTMLImageElement>("img")!;
    expect(img.className).toContain("hb-anim-enter");
    expect(img.style.animation).toContain("hb-fade-in");
  });

  it("still shows the code if the QR never arrives", () => {
    const { container } = render(<Hero code="ABCD" qr="" />);
    expect(card(container).style.opacity).toBe("");
    expect(codeNode(container).textContent).toBe("ABCD");
  });

  it("shows the error path immediately and legibly", () => {
    const { container, getByText } = render(<Hero code="" qr="" error="Cannot reach the server" />);
    expect(card(container).style.opacity).toBe("");
    expect(card(container).getAttribute("aria-hidden")).toBeNull();
    expect(codeNode(container).textContent).toBe("Offline");
    expect(getByText("Cannot reach the server")).toBeTruthy();
  });

  it("tags every animated node with a class the reduced-motion rule switches off", () => {
    const { container } = render(<Hero code="ABCD" qr="data:image/png;base64,AAAA" />);
    // packages/ui/src/styles.css zeroes `animation` on .hb-anim-enter and .hb-anim-deal under
    // prefers-reduced-motion; an inline animation without one of these classes would ignore it.
    const animated = Array.from(container.querySelectorAll<HTMLElement>("*")).filter((el) => el.style.animation);
    expect(animated.length).toBeGreaterThan(0);
    for (const el of animated) expect(el.className).toMatch(/hb-anim-(enter|deal)/);
  });
});
