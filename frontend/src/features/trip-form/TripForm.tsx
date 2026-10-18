import { useState, type FormEvent } from "react";
import { usePlanTrip } from "../../api/hooks";
import type { Place, PlanRequest, SampleInterval } from "../../api/types";
import { nextFullHour, toLocalInput } from "../../lib/format";
import { useTripStore } from "../../store/useTripStore";
import { PlaceInput } from "./PlaceInput";

const INTERVALS: SampleInterval[] = [10, 25, 50];

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
  const hasPlan = useTripStore((s) => !!s.plan);
  const lastRequest = useTripStore((s) => s.request);

  const build = (overrides: Partial<PlanRequest> = {}): PlanRequest | null => {
    const o = overrides.origin ?? origin;
    const d = overrides.destination ?? destination;
    const weight = Number(load);
    if (!o || !d) return fail("Choose an origin and a destination from the suggestions.");
    if (!departure) return fail("Choose a departure date and time.");
    if (!Number.isFinite(weight) || weight < 0 || weight > 80000)
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

  const changeInterval = (value: SampleInterval) => {
    setSampleInterval(value);
    // Interval only changes sampling density, so re-run the last plan right away.
    if (hasPlan && lastRequest) planTrip.mutate({ ...lastRequest, sample_interval_mi: value });
  };

  const loadSample = (trip: (typeof SAMPLE_TRIPS)[number]) => {
    setOrigin(trip.origin);
    setDestination(trip.destination);
    const req = build({ origin: trip.origin, destination: trip.destination });
    if (req) planTrip.mutate(req);
  };

  const error = formError ?? (planTrip.error ? planTrip.error.message : null);

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <PlaceInput label="Origin" placeholder="City or address" value={origin} onChange={setOrigin} />
      <PlaceInput
        label="Destination"
        placeholder="City or address"
        value={destination}
        onChange={setDestination}
      />
      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-3">
          <label htmlFor="departure" className="field-label">
            Departure
          </label>
          <input
            id="departure"
            type="datetime-local"
            className="field"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="load" className="field-label">
            Load weight (lb)
          </label>
          <input
            id="load"
            type="number"
            inputMode="numeric"
            min={0}
            max={80000}
            step={500}
            className="field"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
          />
        </div>
      </div>

      <div>
        <span className="field-label">Weather check every</span>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" role="radiogroup">
          {INTERVALS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => changeInterval(value)}
              className={`rounded-md py-1.5 text-sm font-medium transition ${
                interval === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {value} mi
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
        <input
          type="checkbox"
          className="mt-0.5 accent-amber-600"
          checked={simulateStorm}
          onChange={(e) => setSimulateStorm(e.target.checked)}
        />
        <span>
          <span className="font-semibold">Simulate a storm (demo)</span>
          <span className="block text-amber-800/80">
            Adds a moving storm on the fastest route, on top of the real forecast, to show how
            risk and the recommendation react.
          </span>
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={planTrip.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {planTrip.isPending && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {planTrip.isPending ? "Checking routes and weather…" : "Plan routes"}
      </button>

      {!hasPlan && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="w-full text-xs text-slate-500">Or try a sample trip:</span>
          {SAMPLE_TRIPS.map((trip) => (
            <button
              key={trip.name}
              type="button"
              onClick={() => loadSample(trip)}
              disabled={planTrip.isPending}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900"
            >
              {trip.name}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
