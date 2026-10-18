import { CloudLightning, Info, Loader2, Route } from "lucide-react";
import { usePlanning } from "./api/hooks";
import { CheckpointTable } from "./features/checkpoints/CheckpointTable";
import { TripMap } from "./features/map/TripMap";
import { RecommendationCard, ResultsSkeleton, RouteList } from "./features/routes/RouteList";
import { ForecastPanel } from "./features/timeline/ForecastPanel";
import { TripForm } from "./features/trip-form/TripForm";
import { TripSummary } from "./features/trip-form/TripSummary";
import { useTripStore } from "./store/useTripStore";

export default function App() {
  const hasPlan = useTripStore((s) => !!s.plan);
  const formOpen = useTripStore((s) => s.formOpen);
  const simulated = useTripStore((s) => !!s.plan?.scenario);
  const fallbackRouting = useTripStore((s) => s.plan?.routing_source === "osrm");
  const planning = usePlanning();

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <aside className="scrollbar-thin flex max-h-[58dvh] shrink-0 flex-col overflow-y-auto border-b border-slate-200 bg-slate-50 md:max-h-none md:w-[420px] md:border-b-0 md:border-r">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-slate-50/90 px-5 py-3.5 backdrop-blur">
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl shadow-sm shadow-brand-600/30" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold leading-tight tracking-tight text-slate-900">SafeHaul</h1>
            <p className="text-xs text-slate-500">Weather-aware truck routing</p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live forecast
          </span>
        </header>

        <div className="space-y-3 p-4 md:p-5">
          <section className={`card p-4 ${hasPlan && !formOpen ? "hidden" : ""}`}>
            <TripForm />
          </section>
          {hasPlan && !formOpen && <TripSummary />}

          {planning && !hasPlan && <ResultsSkeleton />}

          {hasPlan && (
            <div className={`space-y-3 transition-opacity ${planning ? "opacity-60" : ""}`}>
              {fallbackRouting && (
                <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  The truck routing service is busy, so these routes come from a car routing engine with
                  travel times stretched 15% for truck speeds.
                </p>
              )}
              <RecommendationCard />
              <RouteList />
              <CheckpointTable />
            </div>
          )}

          <p className="px-1 pt-1 text-[11px] leading-relaxed text-slate-400">
            Truck routing by openrouteservice · Weather by Open-Meteo · Times in your local time zone.
          </p>
        </div>
      </aside>

      <main className="relative min-h-[42dvh] flex-1">
        <TripMap />

        {simulated && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50/95 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-float">
            <CloudLightning className="h-3.5 w-3.5" />
            Simulated storm active, not real weather
          </div>
        )}

        {planning && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/30 backdrop-blur-[1px]">
            <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-3.5 shadow-float ring-1 ring-slate-900/5">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Planning your trip</p>
                <p className="text-xs text-slate-500">Finding 3 truck routes and checking the forecast along each</p>
              </div>
            </div>
          </div>
        )}

        {hasPlan ? (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 md:inset-x-6 md:bottom-6 md:mx-auto md:max-w-3xl">
            <ForecastPanel />
          </div>
        ) : (
          !planning && (
            <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-4">
              <div className="flex max-w-md items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-float ring-1 ring-slate-900/5 backdrop-blur">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Route className="h-5 w-5" />
                </span>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">Plan a trip to compare routes.</span> Each route is
                  scored by forecast wind, rain and snow at the time your truck gets there.
                </p>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
