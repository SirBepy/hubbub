// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { TVMeasure } from "./TVMeasure";

afterEach(cleanup);

describe("TVMeasure", () => {
  it("caps width at the shared measure token and centres it", () => {
    const { container } = render(<TVMeasure>content</TVMeasure>);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.maxWidth).toBe("var(--tv-measure)");
    expect(el.style.marginInline).toBe("auto");
    expect(el.style.width).toBe("100%");
  });

  it("only becomes a full-height flex column when fill is set", () => {
    const { container: plain } = render(<TVMeasure>content</TVMeasure>);
    expect((plain.firstElementChild as HTMLElement).style.height).toBe("");

    const { container: filled } = render(<TVMeasure fill>content</TVMeasure>);
    const el = filled.firstElementChild as HTMLElement;
    expect(el.style.height).toBe("100%");
    expect(el.style.flexDirection).toBe("column");
  });

  it("lets a caller override the cap without losing the centring", () => {
    const { container } = render(<TVMeasure style={{ maxWidth: "calc(var(--u)*95)" }}>content</TVMeasure>);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.maxWidth).toBe("calc(var(--u)*95)");
    expect(el.style.marginInline).toBe("auto");
  });
});
