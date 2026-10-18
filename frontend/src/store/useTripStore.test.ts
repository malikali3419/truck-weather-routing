import { describe, expect, it } from "vitest";
import { MAX_HOUR, useTripStore } from "./useTripStore";

describe("forecast hour", () => {
  const set = (h: number) => {
    useTripStore.getState().setHour(h);
    return useTripStore.getState().hour;
  };

  it("keeps fractional hours inside the window", () => {
    expect(set(12.4)).toBe(12.4);
  });

  it("clamps values outside 0–48 (e.g. a negative first playback step)", () => {
    expect(set(-0.003)).toBe(0);
    expect(set(60)).toBe(MAX_HOUR);
    expect(set(Number.NaN)).toBe(0);
  });
});
