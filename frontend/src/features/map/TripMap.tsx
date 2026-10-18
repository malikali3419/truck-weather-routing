import { useCallback, useEffect, useRef, useState } from "react";
import Map, { AttributionControl, NavigationControl, ScaleControl, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouteGeometries } from "../../api/hooks";
import { bounds } from "../../lib/geo";
import { useTripStore } from "../../store/useTripStore";
import { CheckpointLayer } from "./CheckpointLayer";
import { HeatmapLayer } from "./HeatmapLayer";
import { RouteLabels, RouteLayers } from "./RouteLayers";
import { EndpointMarkers, TruckMarkers } from "./TruckMarkers";

// On phones the forecast panel covers the bottom of the map.
const IS_PHONE = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const INTERACTIVE = ["checkpoints", "route-hit"];

export function TripMap() {
  const mapRef = useRef<MapRef>(null);
  const [labelLayerId, setLabelLayerId] = useState<string>();
  const [cursor, setCursor] = useState("");
  const geometries = useRouteGeometries();
  const selectRoute = useTripStore((s) => s.selectRoute);
  const openPopup = useTripStore((s) => s.openPopup);
  const popupCheckpoint = useTripStore((s) => s.popupCheckpoint);
  const selectedRoute = useTripStore((s) => s.plan?.routes.find((r) => r.id === s.selectedRouteId));

  // Fit the map to all routes whenever a new set of routes arrives.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || geometries.length === 0) return;
    const [sw, ne] = bounds(geometries.flatMap((g) => g.coords));
    const desktop = window.innerWidth >= 768;
    map.fitBounds([sw, ne], {
      padding: desktop ? { top: 70, bottom: 290, left: 70, right: 70 } : 40,
      duration: 900,
    });
  }, [geometries]);

  // Bring a checkpoint chosen from the table into view.
  useEffect(() => {
    const cp = popupCheckpoint !== null ? selectedRoute?.checkpoints[popupCheckpoint] : undefined;
    const map = mapRef.current;
    if (!cp || !map) return;
    if (!map.getBounds().contains([cp.lon, cp.lat])) {
      map.easeTo({ center: [cp.lon, cp.lat], duration: 600 });
    }
  }, [popupCheckpoint, selectedRoute]);

  const onLoad = useCallback(() => {
    // Draw the heatmap under the place labels so city names stay readable.
    const layers = mapRef.current?.getStyle().layers ?? [];
    setLabelLayerId(layers.find((l) => l.type === "symbol")?.id);
  }, []);

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      if (feature.layer.id === "checkpoints") {
        openPopup(feature.properties?.index as number);
      } else if (feature.layer.id === "route-hit") {
        selectRoute(feature.properties?.routeId as string);
      }
    },
    [openPopup, selectRoute],
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: -97, latitude: 39, zoom: 3.6 }}
      mapStyle={MAP_STYLE}
      interactiveLayerIds={INTERACTIVE}
      onClick={onClick}
      onLoad={onLoad}
      onMouseEnter={() => setCursor("pointer")}
      onMouseLeave={() => setCursor("")}
      cursor={cursor}
      dragRotate={false}
      attributionControl={false}
      style={{ position: "absolute", inset: 0 }}
    >
      <AttributionControl compact position={IS_PHONE ? "top-right" : "bottom-right"} />
      <NavigationControl position="top-right" showCompass={false} />
      <ScaleControl position="top-left" unit="imperial" />
      {labelLayerId && <HeatmapLayer beforeId={labelLayerId} />}
      <RouteLayers />
      <CheckpointLayer />
      <EndpointMarkers />
      <RouteLabels />
      <TruckMarkers />
    </Map>
  );
}
