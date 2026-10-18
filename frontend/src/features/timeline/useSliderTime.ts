import { useHeatmap } from "../../api/hooks";
import { useTripStore } from "../../store/useTripStore";

/**
 * Unix time at the forecast slider position. `hour` can be fractional while
 * playing, so this moves smoothly between forecast hours.
 */
export function useSliderTime(): number {
  const hour = useTripStore((s) => s.hour);
  const departure = useTripStore((s) => s.plan?.departure_unix ?? 0);
  const { data } = useHeatmap();
  const start = data?.times_unix[0] ?? Math.floor(departure / 3600) * 3600;
  return start + hour * 3600;
}
