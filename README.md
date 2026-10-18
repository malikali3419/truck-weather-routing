# Weather-aware truck routing

A React + Django app that helps a truck driver choose the safest route. It compares three truck routes by forecast weather at the time the truck reaches each checkpoint, applies the load-weight rules, and recommends the best balance of risk and travel time.

- **Live app:** _add your hosted URL_
- **Walkthrough:** _add your Loom URL_

## What it does

1. You enter origin, destination, departure time, load weight and a sampling interval (10, 25 or 50 miles).
2. The backend gets three distinct truck routes from openrouteservice (`driving-hgv` profile, with gross weight).
3. Each route gets a checkpoint every N miles, plus the destination. Each checkpoint's ETA comes from the router's own per-step travel times.
4. For each checkpoint it reads the Open-Meteo hourly forecast **at that ETA**, classifies wind, rain, snow and wind-with-load, and keeps the worst level.
5. Each route is scored (miles per risk level, average risk), and one is recommended with plain-language reasons.
6. The map shows every route colored by risk, the checkpoints (click for details), and a weather heatmap of the corridor with a 0–48 hour slider. Trucks on the map move to where each would be at the slider's time.

## Architecture

```
React (Vite, TypeScript, MapLibre)          Django + DRF
┌─────────────────────────────┐   /api    ┌──────────────────────────────────────┐
│ TripForm → usePlanTrip      │ ────────► │ api/        thin views, validation   │
│ RouteList, CheckpointTable  │           │ services/   planner, heatmap         │
│ TripMap: routes, checkpoints│           │ domain/     pure logic (no I/O)      │
│   heatmap, trucks           │           │   sampling, risk, scoring, recommend │
│ ForecastPanel: slider, strip│           │ providers/  openrouteservice, OSRM   │
└─────────────────────────────┘           │             fallback, Open-Meteo     │
                                          └──────────────────────────────────────┘
```

All risk, sampling and recommendation logic lives in `backend/routing/domain/`. It has no Django and no HTTP, so it is unit-tested directly.

| Endpoint | Purpose |
|---|---|
| `GET /api/geocode?q=` | Address suggestions (keeps the API key on the server) |
| `POST /api/plan` | Routes, checkpoints, risk, recommendation |
| `POST /api/heatmap` | Corridor grid × 49 hourly frames |
| `GET /api/health` | Health check |

## Risk rules and how ambiguities were resolved

| Condition | Low | Moderate | High | Severe | No travel |
|---|---|---|---|---|---|
| Wind (mph) | < 25 | 25 – < 35 | 35 – < 45 | 45 – < 55 | ≥ 55 |
| Rain (in/hr) | < 0.10 | 0.10 – < 0.25 | 0.25 – < 0.50 | 0.50 – 1.00 | > 1.00 |
| Snow (in/hr) | < 0.5 | 0.5 – < 1.0 | 1.0 – < 2.0 | 2.0 – 3.0 | > 3.0 |

Load rules: ≥ 55 mph is No travel for any load; 45–54 mph with > 30,000 lb is No travel; 35–44 mph with > 40,000 lb is Severe.

Decisions (all thresholds are in `backend/routing/domain/constants.py`):

- **Overlapping ranges** in the brief (e.g. rain "0.10–0.25" and "0.25–0.50") are lower-bound inclusive. The top bands say "> 1.00" and "> 3.0", so exactly 1.00 in/hr rain and 3.0 in/hr snow are still Severe.
- **Wind** uses sustained 10 m wind speed, as the table describes. Gusts are shown in the checkpoint popup.
- **Load weights of exactly 30,000 or 40,000 lb** don't trigger the "> 30,000" or "> 40,000" rules.
- **A checkpoint's level** is the worst of wind, rain, snow and wind-with-load. The UI shows which factor caused it.
- **Rain rate** is `rain + showers`. Open-Meteo's precipitation values are totals for the hour ending at each timestamp, so the rate at a moment is the total of the hour containing it. Wind and temperature are interpolated linearly between hours.
- **Miles at each level:** each stretch between two checkpoints takes the worse of its two end levels. We only know the weather at checkpoints, so this errs on the safe side.

## Recommendation

Routes with any No Travel miles are never recommended. The rest are ranked by:

1. fewest Severe miles
2. fewest High miles
3. lowest distance-weighted average risk (Low = 0 … No travel = 4)
4. shortest travel time

Differences smaller than **1 mile** or **0.05 average risk** count as ties, so a 0.2-mile difference in Severe miles can't outweigh hours of extra driving. If every route has No Travel miles, the app recommends none and suggests delaying departure. Each recommendation lists the criterion that decided it against every other route.

## Three routes, always

openrouteservice only computes alternatives for trips under 100 km. For longer trips the backend routes through via points pushed sideways from the middle of the main route (two rounds, increasing offsets). It keeps candidates that overlap the others by less than 80% and take no more than 1.6× the main route's time.

If openrouteservice times out or is down, the trip falls back to the public OSRM server. OSRM has no truck profile, so its car times are stretched 15%, and the UI says the fallback was used. Only the first routing call can trigger the fallback, so all three routes of a trip always come from the same engine. Routes are cached for 6 hours, so changing the interval, the departure time or the storm demo doesn't call the routing API again.

## Map and heatmap performance

- Routes, checkpoints and the heatmap are MapLibre WebGL layers, not DOM markers. Only the three trucks and two endpoint pins are DOM elements.
- The heatmap is fetched **once per plan**: up to 360 corridor grid points × 49 hours × 4 layers in one gzipped response (~15 KB). Moving the slider only swaps one number per point on the client, with no network request. The grid step adapts to trip length.
- Route geometry is simplified on the server (Douglas–Peucker, ~30 m) and sent as encoded polylines.
- Weather is cached per location (rounded to 0.05°, 30 minutes), and lookups are batched, 100 locations per Open-Meteo request.

## Simulated storm (demo only)

Real weather is often calm. The "Simulate a storm (demo)" checkbox adds a moving storm cell on top of the real forecast. It is placed on the fastest route at the moment the truck would reach it, so you can see risk, the recommendation and the heatmap react. It is off by default, and the map shows a "Simulated storm active, not real weather" label whenever it is on.

## Run locally

Requirements: Python 3.12+, Node 22+, and a free openrouteservice key (https://openrouteservice.org → Dashboard → Basic Key).

```bash
cp .env.example .env            # then put your ORS_API_KEY in .env

# Backend
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python manage.py runserver      # http://127.0.0.1:8000

# Frontend (second terminal)
cd frontend
npm install
npm run dev                                # http://localhost:5173, proxies /api to Django
```

## Tests

```bash
cd backend && DEBUG=1 .venv/bin/pytest     # thresholds, load rules, sampling, ETAs, scoring,
                                           # recommendation, weather interpolation, API, fallback
cd frontend && npm test                    # polyline decoding and geometry helpers
```

CI (`.github/workflows/ci.yml`) runs lint, the backend tests and the frontend build on every push.

## Deploy (free)

The `Dockerfile` builds the React app and serves it from Django with WhiteNoise, so the app runs as one service on one URL with no CORS setup.

On **Render**: New → Blueprint → pick this repo (it reads `render.yaml`) → set `ORS_API_KEY`. Free Render services sleep after 15 minutes idle; an UptimeRobot monitor on `/api/health` every 5 minutes keeps it awake.

## Limitations and next steps

- ETAs use the router's driving times. They don't include hours-of-service breaks (11 h driving, 30 min break, 10 h off), which matter on multi-day trips.
- Forecast data covers up to 10 days; checkpoints past that use the last forecast hour and are flagged.
- A "leave X hours later" suggestion would help when every route is risky.
- Times are shown in the browser's time zone.
