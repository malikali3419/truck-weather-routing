import { useHeatmap } from "../../api/hooks";
import { useTripStore } from "../../store/useTripStore";

/** Unix time at the forecast slider position (departure hour + slider hours). */
export function useSliderTime(): number {
  const hour = useTripStore((s) => s.hour);
  const departure = useTripStore((s) => s.plan?.departure_unix ?? 0);
  const { data } = useHeatmap();
  return data?.times_unix[hour] ?? Math.floor(departure / 3600) * 3600 + hour * 3600;
}
