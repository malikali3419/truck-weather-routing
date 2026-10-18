import { describe, expect, it } from "vitest";
import { cumulativeMiles, decodePolyline, pointAlong, sliceByMiles } from "./geo";

describe("decodePolyline", () => {
  it("decodes the reference example", () => {
    // Example from Google's polyline algorithm documentation.
    const coords = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(coords).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });
});

describe("pointAlong", () => {
  const line: [number, number][] = [
    [0, 0],
    [0, 1],
    [0, 2],
  ];
  const seconds = [0, 100, 300];

  it("interpolates by any per-vertex measure", () => {
    expect(pointAlong(line, seconds, 50)).toEqual([0, 0.5]);
    expect(pointAlong(line, seconds, 200)).toEqual([0, 1.5]);
  });

  it("clamps to the ends", () => {
    expect(pointAlong(line, seconds, -10)).toEqual([0, 0]);
    expect(pointAlong(line, seconds, 999)).toEqual([0, 2]);
  });
});

describe("sliceByMiles", () => {
  it("returns the part of the line between two mile markers", () => {
    const line: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
    ];
    const miles = cumulativeMiles(line);
    const part = sliceByMiles(line, miles, miles[1] / 2, miles[1] * 1.5);
    expect(part).toHaveLength(3);
    expect(part[1]).toEqual([0, 1]);
    expect(part[0][1]).toBeCloseTo(0.5);
    expect(part[2][1]).toBeCloseTo(1.5);
  });
});
