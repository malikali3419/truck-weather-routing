import { CheckpointTable } from "./features/checkpoints/CheckpointTable";
import { TripMap } from "./features/map/TripMap";
import { RecommendationBanner, RiskLegend, RouteList } from "./features/routes/RouteList";
import { ForecastPanel } from "./features/timeline/ForecastPanel";
import { TripForm } from "./features/trip-form/TripForm";
import { useTripStore } from "./store/useTripStore";

export default function App() {
  const hasPlan = useTripStore((s) => !!s.plan);
  const simulated = useTripStore((s) => !!s.plan?.scenario);
  const fallbackRouting = useTripStore((s) => s.plan?.routing_source === "osrm");

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50 text-slate-900 md:flex-row">
      <aside className="flex max-h-[55dvh] shrink-0 flex-col overflow-y-auto border-b border-slate-200 bg-slate-50 md:max-h-none md:w-[400px] md:border-b-0 md:border-r">
        <header className="flex items-center gap-2.5 px-4 pb-3 pt-4 md:px-5">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">Weather-aware truck routing</h1>
            <p className="text-xs text-slate-500">Pick the safest route for your load</p>
          </div>
        </header>

        <div className="space-y-4 px-4 pb-5 md:px-5">
          <section className="rounded-xl border border-slate-200 bg-white p-3.5">
            <TripForm />
          </section>

          {hasPlan && (
            <>
              {fallbackRouting && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  The truck routing service is busy, so these routes come from a car routing
                  engine with travel times stretched 15% for truck speeds.
                </p>
              )}
              <RecommendationBanner />
              <RouteList />
              <CheckpointTable />
            </>
          )}

          <div className="md:hidden">
            <RiskLegend />
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Routing by openrouteservice (truck profile). Weather by Open-Meteo. Times shown in your
            local time zone.
          </p>
        </div>
      </aside>

      <main className="relative min-h-[45dvh] flex-1">
        <TripMap />
        {simulated && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 shadow">
            Simulated storm active, not real weather
          </div>
        )}
        {hasPlan ? (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 md:inset-x-4 md:bottom-4 md:mx-auto md:max-w-3xl">
            <ForecastPanel />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
            <p className="rounded-full bg-white/95 px-4 py-2 text-sm text-slate-600 shadow-lg">
              Enter a trip to compare three truck routes by weather risk.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
