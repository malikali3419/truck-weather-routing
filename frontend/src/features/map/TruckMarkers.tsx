import { Truck } from "lucide-react";
import { useMemo } from "react";
import { Marker } from "react-map-gl/maplibre";
import { useRouteGeometries } from "../../api/hooks";
import { decodePolyline, pointAlong, type LngLat } from "../../lib/geo";
import { useTripStore } from "../../store/useTripStore";
import { useSliderTime } from "../timeline/useSliderTime";

/** Compass heading in degrees from a to b (the map is always north-up). */
function heading(a: LngLat, b: LngLat): number {
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180);
  const dy = b[1] - a[1];
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/**
 * Where each truck would be at the slider's time. During playback the time
 * advances continuously, so the trucks drive along their routes.
 */
export function TruckMarkers() {
  const geometries = useRouteGeometries();
  const selectedRouteId = useTripStore((s) => s.selectedRouteId);
  const departure = useTripStore((s) => s.plan?.departure_unix ?? 0);
  const time = useSliderTime();
  const offset = time - departure;

  return (
    <>
      {geometries.map(({ route, coords }) => {
        const times = route.vertex_offsets_s;
        const here = pointAlong(coords, times, offset);
        // Look a couple of minutes ahead (or behind at the end) for the direction.
        const ahead = pointAlong(coords, times, Math.min(offset + 180, route.duration_s));
        const behind = pointAlong(coords, times, Math.max(offset - 180, 0));
        const dir = here[0] === ahead[0] && here[1] === ahead[1] ? heading(behind, here) : heading(here, ahead);
        const selected = route.id === selectedRouteId;
        const arrived = offset >= route.duration_s;
        const waiting = offset <= 0;
        const state = arrived ? "arrived" : waiting ? "waiting to depart" : "en route";
        return (
          <Marker key={route.id} longitude={here[0]} latitude={here[1]} anchor="center" style={{ zIndex: selected ? 5 : 3 }}>
            <div
              className="relative"
              data-testid={`truck-${route.id}`}
              title={`Route ${route.id} truck, ${state}`}
              aria-label={`Route ${route.id} truck, ${state}`}
            >
              {!arrived && !waiting && (
                <div className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${dir}deg)` }}>
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 border-x-[5px] border-b-[7px] border-x-transparent ${
                      selected ? "-top-[9px] border-b-sky-500" : "-top-[8px] border-b-slate-400"
                    }`}
                  />
                </div>
              )}
              <div
                className={`flex items-center justify-center rounded-full border-2 border-white shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-[width,height] ${
                  selected
                    ? "h-9 w-9 bg-gradient-to-br from-sky-400 to-indigo-500 text-white"
                    : "h-7 w-7 bg-slate-700 text-white opacity-90 dark:bg-slate-600"
                }`}
              >
                <Truck className={selected ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} strokeWidth={2.2} />
              </div>
              <span
                className={`absolute -bottom-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white px-1 text-[9px] font-bold ${
                  selected ? "bg-white text-indigo-600" : "bg-slate-200 text-slate-700"
                }`}
              >
                {route.id}
              </span>
            </div>
          </Marker>
        );
      })}
    </>
  );
}

/** Start and end pins for the trip. */
export function EndpointMarkers() {
  const request = useTripStore((s) => s.request);
  const plan = useTripStore((s) => s.plan);
  const first = plan?.routes[0];
  const ends = useMemo(() => {
    if (!first) return null;
    const coords = decodePolyline(first.geometry);
    return { start: coords[0], end: coords[coords.length - 1] };
  }, [first]);
  if (!ends || !request) return null;
  return (
    <>
      <Marker longitude={ends.start[0]} latitude={ends.start[1]} anchor="center">
        <span
          title={request.origin.label}
          className="block h-4 w-4 rounded-full border-[3px] border-white bg-slate-900 shadow-[0_0_0_4px_rgba(15,23,42,0.18)] dark:border-ink-950 dark:bg-white dark:shadow-[0_0_0_4px_rgba(255,255,255,0.15)]"
        />
      </Marker>
      <Marker longitude={ends.end[0]} latitude={ends.end[1]} anchor="bottom">
        <svg width="22" height="28" viewBox="0 0 22 28" aria-label={request.destination.label}>
          <path d="M11 27s9-9.2 9-16a9 9 0 1 0-18 0c0 6.8 9 16 9 16z" fill="#0ea5e9" stroke="#fff" strokeWidth="2" />
          <circle cx="11" cy="11" r="3.5" fill="#fff" />
        </svg>
      </Marker>
    </>
  );
}
