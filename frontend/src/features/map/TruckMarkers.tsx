import { useMemo } from "react";
import { Marker } from "react-map-gl/maplibre";
import { useRouteGeometries } from "../../api/hooks";
import { decodePolyline, pointAlong } from "../../lib/geo";
import { useTripStore } from "../../store/useTripStore";
import { useSliderTime } from "../timeline/useSliderTime";

/** Where each truck would be at the forecast slider's time. */
export function TruckMarkers() {
  const geometries = useRouteGeometries();
  const selectedRouteId = useTripStore((s) => s.selectedRouteId);
  const departure = useTripStore((s) => s.plan?.departure_unix ?? 0);
  const time = useSliderTime();
  const offset = time - departure;

  return (
    <>
      {geometries.map(({ route, coords }) => {
        const [lon, lat] = pointAlong(coords, route.vertex_offsets_s, offset);
        const selected = route.id === selectedRouteId;
        const arrived = offset >= route.duration_s;
        return (
          <Marker key={route.id} longitude={lon} latitude={lat} anchor="center" style={{ zIndex: selected ? 3 : 2 }}>
            <div
              title={`Route ${route.id} truck${arrived ? " (arrived)" : ""}`}
              className={`flex items-center gap-0.5 rounded-full border-2 px-1.5 py-0.5 text-[10px] font-bold shadow ${
                selected ? "border-white bg-slate-900 text-white" : "border-white bg-white text-slate-700"
              }`}
            >
              <TruckIcon />
              {route.id}
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
        <span title={request.origin.label} className="block h-4 w-4 rounded-full border-[3px] border-white bg-slate-900 shadow" />
      </Marker>
      <Marker longitude={ends.end[0]} latitude={ends.end[1]} anchor="bottom">
        <svg width="22" height="28" viewBox="0 0 22 28" aria-label={request.destination.label}>
          <path d="M11 27s9-9.2 9-16a9 9 0 1 0-18 0c0 6.8 9 16 9 16z" fill="#0f172a" stroke="#fff" strokeWidth="2" />
          <circle cx="11" cy="11" r="3.5" fill="#fff" />
        </svg>
      </Marker>
    </>
  );
}

function TruckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden>
      <path d="M2 16V6h12v10M14 10h4l4 4v2h-8" />
      <circle cx="7" cy="18" r="2" fill="currentColor" />
      <circle cx="17" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}
