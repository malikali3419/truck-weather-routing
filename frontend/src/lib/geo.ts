export type LngLat = [number, number];

/** Decode a Google encoded polyline (precision 5) into [lon, lat] pairs. */
export function decodePolyline(encoded: string): LngLat[] {
  const coords: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    const deltas: number[] = [];
    for (let k = 0; k < 2; k++) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      deltas.push(result & 1 ? ~(result >> 1) : result >> 1);
    }
    lat += deltas[0];
    lon += deltas[1];
    coords.push([lon / 1e5, lat / 1e5]);
  }
  return coords;
}

const EARTH_RADIUS_MI = 3958.7613;

export function haversineMiles(a: LngLat, b: LngLat): number {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

export function cumulativeMiles(coords: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + haversineMiles(coords[i - 1], coords[i]));
  }
  return out;
}

/** Index of the last value <= target (values sorted ascending). */
function floorIndex(values: number[], target: number): number {
  let lo = 0;
  let hi = values.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (values[mid] <= target) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Point where `measure` (miles or seconds, one per vertex) reaches `target`. */
export function pointAlong(coords: LngLat[], measure: number[], target: number): LngLat {
  if (target <= measure[0]) return coords[0];
  if (target >= measure[measure.length - 1]) return coords[coords.length - 1];
  const i = floorIndex(measure, target);
  const span = measure[i + 1] - measure[i];
  const t = span > 0 ? (target - measure[i]) / span : 0;
  const [ax, ay] = coords[i];
  const [bx, by] = coords[i + 1];
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

/** The part of the line between two mile markers. */
export function sliceByMiles(
  coords: LngLat[],
  miles: number[],
  from: number,
  to: number,
): LngLat[] {
  const out: LngLat[] = [pointAlong(coords, miles, from)];
  for (let i = 0; i < coords.length; i++) {
    if (miles[i] > from && miles[i] < to) out.push(coords[i]);
  }
  out.push(pointAlong(coords, miles, to));
  return out;
}

export function bounds(coords: LngLat[]): [LngLat, LngLat] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}
