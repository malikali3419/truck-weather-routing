import { CloudLightning, Info, Loader2, Route } from "lucide-react";
import { usePlanning } from "./api/hooks";
import { ThemeToggle } from "./components/ThemeToggle";
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
  const fallbackWeather = useTripStore((s) => s.plan?.weather_source === "met-norway");
  const planning = usePlanning();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink-950 md:flex-row">
      <aside className="aurora scrollbar-thin relative flex max-h-[58dvh] shrink-0 flex-col overflow-y-auto border-b border-overlay/[0.06] md:max-h-none md:w-[420px] md:border-b-0 md:border-r">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-overlay/[0.06] bg-ink-950/70 px-5 py-3.5 backdrop-blur-xl">
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl shadow-glow" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-fg">Weather-aware truck routing</h1>
            <p className="text-xs text-muted">Safest route for your load</p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-400/20 sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
          <ThemeToggle />
        </header>

        <div className="space-y-3 p-4 md:p-5">
          <section className={`card p-4 ${hasPlan && !formOpen ? "hidden" : ""}`}>
            <TripForm />
          </section>
          {hasPlan && !formOpen && <TripSummary />}

          {planning && !hasPlan && <ResultsSkeleton />}

          {hasPlan && (
            <div className={`space-y-3 transition-opacity ${planning ? "opacity-50" : ""}`}>
              {fallbackRouting && (
                <p className="flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.08] px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  The truck routing service is busy, so these routes come from a car routing engine with
                  travel times stretched 15% for truck speeds.
                </p>
              )}
              {fallbackWeather && (
                <p className="flex gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.08] px-3 py-2 text-xs text-sky-800 dark:text-sky-200">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  The main weather service hit its hourly limit, so this forecast comes from MET Norway.
                </p>
              )}
              <RecommendationCard />
              <RouteList />
              <CheckpointTable />
            </div>
          )}

          <p className="px-1 pt-1 text-[11px] leading-relaxed text-subtle">
            Truck routing by openrouteservice · Weather by Open-Meteo and MET Norway · Times in your local time zone.
          </p>
        </div>
      </aside>

      <main className="relative min-h-[42dvh] flex-1">
        <TripMap />
        {/* Vignette so floating panels read well over the map */}
        <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(6,10,19,0.55))] dark:block" />

        {simulated && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-amber-400/30 bg-ink-900/85 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200 shadow-glass backdrop-blur-xl">
            <CloudLightning className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
            Simulated storm active, not real weather
          </div>
        )}

        {planning && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ink-950/40 backdrop-blur-[2px]">
            <div className="flex items-center gap-3 rounded-2xl border border-overlay/10 bg-ink-900/90 px-5 py-3.5 shadow-glass backdrop-blur-xl">
              <Loader2 className="h-5 w-5 animate-spin text-sky-600 dark:text-sky-400" />
              <div>
                <p className="text-sm font-semibold text-fg">Planning your trip</p>
                <p className="text-xs text-muted">Finding 3 truck routes and checking the forecast along each</p>
              </div>
            </div>
          </div>
        )}

        {hasPlan ? (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 md:inset-x-6 md:bottom-6 md:mx-auto md:max-w-3xl">
            <ForecastPanel />
          </div>
        ) : (
          !planning && (
            <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 flex justify-center px-4">
              <div className="flex max-w-md items-center gap-3 rounded-2xl border border-overlay/10 bg-ink-900/85 px-4 py-3 shadow-glass backdrop-blur-xl">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-glow">
                  <Route className="h-5 w-5" />
                </span>
                <p className="text-sm text-muted">
                  <span className="font-semibold text-fg">Plan a trip to compare routes.</span> Each route is scored by
                  forecast wind, rain and snow at the time your truck gets there.
                </p>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
