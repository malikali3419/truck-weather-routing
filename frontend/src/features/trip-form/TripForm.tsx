import { ArrowUpDown, CalendarClock, CloudLightning, MapPin, Route, Weight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { usePlanning, usePlanTrip } from "../../api/hooks";
import type { Place, PlanRequest, SampleInterval } from "../../api/types";
import { Segmented, Spinner } from "../../components/ui";
import { nextFullHour, toLocalInput } from "../../lib/format";
import { useTripStore } from "../../store/useTripStore";
import { PlaceInput } from "./PlaceInput";

export const INTERVAL_OPTIONS: { value: SampleInterval; label: string }[] = [
  { value: 10, label: "10 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
];

const SAMPLE_TRIPS: { name: string; origin: Place; destination: Place }[] = [
  {
    name: "Denver → Chicago",
    origin: { label: "Denver, CO, USA", lat: 39.7392, lon: -104.9903 },
    destination: { label: "Chicago, IL, USA", lat: 41.8781, lon: -87.6298 },
  },
  {
    name: "Dallas → Atlanta",
    origin: { label: "Dallas, TX, USA", lat: 32.7767, lon: -96.797 },
    destination: { label: "Atlanta, GA, USA", lat: 33.749, lon: -84.388 },
  },
  {
    name: "Seattle → Salt Lake City",
    origin: { label: "Seattle, WA, USA", lat: 47.6062, lon: -122.3321 },
    destination: { label: "Salt Lake City, UT, USA", lat: 40.7608, lon: -111.891 },
  },
];

export function TripForm() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departure, setDeparture] = useState(() => toLocalInput(nextFullHour()));
  const [load, setLoad] = useState("40000");
  const [interval, setSampleInterval] = useState<SampleInterval>(10);
  const [simulateStorm, setSimulateStorm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const planTrip = usePlanTrip();
  const planning = usePlanning();
  const planError = useTripStore((s) => s.planError);
  const hasPlan = useTripStore((s) => !!s.plan);
  const setFormOpen = useTripStore((s) => s.setFormOpen);

  const build = (overrides: Partial<PlanRequest> = {}): PlanRequest | null => {
    const o = overrides.origin ?? origin;
    const d = overrides.destination ?? destination;
    const weight = Number(load);
    if (!o || !d) return fail("Choose an origin and a destination from the suggestions.");
    if (!departure) return fail("Choose a departure date and time.");
    if (load.trim() === "" || !Number.isFinite(weight) || weight < 0 || weight > 80000)
      return fail("Load weight must be between 0 and 80,000 lb.");
    setFormError(null);
    return {
      origin: o,
      destination: d,
      departure_at: new Date(departure).toISOString(),
      load_weight_lb: weight,
      sample_interval_mi: interval,
      simulate_storm: simulateStorm,
      ...overrides,
    };
  };

  function fail(message: string): null {
    setFormError(message);
    return null;
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const req = build();
    if (req) planTrip.mutate(req);
  };

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const loadSample = (trip: (typeof SAMPLE_TRIPS)[number]) => {
    setOrigin(trip.origin);
    setDestination(trip.destination);
    const req = build({ origin: trip.origin, destination: trip.destination });
    if (req) planTrip.mutate(req);
  };

  const error = formError ?? planError;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate aria-label="Plan a trip">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Plan a trip</h2>
        {hasPlan && (
          <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>
            Cancel
          </button>
        )}
      </div>

      <div>
        <span className="field-label">Route</span>
        <div className="relative space-y-2">
          <PlaceInput
            label="Origin"
            placeholder="Origin city or address"
            value={origin}
            onChange={setOrigin}
            icon={<span className="block h-2.5 w-2.5 rounded-full border-[2.5px] border-slate-200" />}
          />
          <PlaceInput
            label="Destination"
            placeholder="Destination city or address"
            value={destination}
            onChange={setDestination}
            icon={<MapPin className="h-4 w-4 text-sky-400" />}
          />
          <button
            type="button"
            onClick={swap}
            aria-label="Swap origin and destination"
            title="Swap origin and destination"
            className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-ink-800 text-slate-400 shadow-lg transition hover:border-sky-400/40 hover:text-sky-300"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
        <div>
          <label htmlFor="departure" className="field-label">
            Departure
          </label>
          <div className="relative">
            <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="departure"
              type="datetime-local"
              className="field pl-9 pr-2 text-[13px]"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label htmlFor="load" className="field-label">
            Load weight
          </label>
          <div className="relative">
            <Weight className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="load"
              type="number"
              inputMode="numeric"
              min={0}
              max={80000}
              step={500}
              className="field min-w-0 pl-8 pr-7 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={load}
              onChange={(e) => setLoad(e.target.value)}
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">lb</span>
          </div>
        </div>
      </div>

      <div>
        <span className="field-label">Check weather every</span>
        <Segmented label="Check weather every" options={INTERVAL_OPTIONS} value={interval} onChange={setSampleInterval} />
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 transition hover:border-amber-400/30 hover:bg-amber-400/[0.04]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/20">
          <CloudLightning className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-100">Simulate a storm</span>
          <span className="block text-xs text-slate-500">Demo: add a storm on the fastest route</span>
        </span>
        <input
          type="checkbox"
          className="peer sr-only"
          checked={simulateStorm}
          onChange={(e) => setSimulateStorm(e.target.checked)}
          aria-label="Simulate a storm (demo)"
        />
        <span
          aria-hidden
          className="relative h-5 w-9 shrink-0 rounded-full bg-white/10 transition after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-amber-400 peer-checked:shadow-[0_0_12px_rgba(251,191,36,0.5)] peer-checked:after:translate-x-4 peer-focus-visible:ring-4 peer-focus-visible:ring-amber-500/20"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <button type="submit" disabled={planning} className="btn-primary h-11 w-full">
        {planning ? <Spinner /> : <Route className="h-4 w-4" />}
        {planning ? "Checking routes and weather…" : "Find the safest route"}
      </button>

      {!hasPlan && (
        <div className="border-t border-white/[0.06] pt-3">
          <p className="mb-2 text-xs text-slate-500">Or try a sample trip</p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_TRIPS.map((trip) => (
              <button
                key={trip.name}
                type="button"
                onClick={() => loadSample(trip)}
                disabled={planning}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-sky-200 disabled:opacity-50"
              >
                {trip.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
