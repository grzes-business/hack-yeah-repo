# iOS shell and Apple Health source (Stages 11–13)

Reference for the Capacitor shell, the `AppleHealthDataSource` adapter and the real-data policies. Recorded 2026-10-04.

## Loading model (Stage 11)

The iOS app is a Capacitor 8 WebView that **loads the running Next.js app from `server.url`**. Nothing from the product is bundled: API routes, OpenAI/Supabase secrets and server writers stay on the server. `native-shell/index.html` is only an offline fallback page.

| Target | `CAP_SERVER_URL` | Works | Does not work |
| --- | --- | --- | --- |
| iOS Simulator | `http://localhost:<port>` (default `:3000`) | UI, sessions, Apple Health (Simulator data) | — |
| iPhone on the Mac's server | `http://<mac-lan-ip>:<port>` | UI, sessions, Apple Health | **Microphone** (iOS requires https) |
| iPhone on Vercel | `https://<deployment>.vercel.app` | Everything, including voice | Needs Vercel Deployment Protection off for that URL |

The URL is read by `pnpm cap:sync` and copied into `ios/App/App/capacitor.config.json`; **press Run in Xcode after every sync** — the installed app keeps the URL it was built with. On a phone, `localhost` is the phone itself (white screen).

### Run on an iPhone from Xcode

```bash
CAP_SERVER_URL=https://<your-deployment>.vercel.app pnpm cap:sync && pnpm cap:open
```

In Xcode: App target → Signing & Capabilities → choose your Team, set a unique Bundle Identifier, confirm the HealthKit capability is listed, select the iPhone, Run. First time on the phone: Settings → Privacy & Security → Developer Mode, then trust the developer certificate under General → VPN & Device Management. Free Apple IDs expire installs after 7 days.

For a LAN dev server also set `NEXT_ALLOWED_DEV_ORIGINS=<mac-lan-ip>` (see `next.config.ts`), or run `pnpm build && pnpm start -H 0.0.0.0`.

### Native configuration

- `capacitor.config.ts`: app ID `com.personalevidence.app` (override with `CAP_APP_ID`), `contentInset: never` (the web app applies safe-area insets), cleartext only for `http://` URLs.
- `Info.plist`: microphone, Health read (`NSHealthShareUsageDescription`) and local-network descriptions; `NSAllowsLocalNetworking` for LAN dev servers only. No Health write permission is requested.
- `App.entitlements`: `com.apple.developer.healthkit`.
- Swift Package Manager (no CocoaPods). Toolchain used: Xcode 26.6, iOS 26.5 Simulator, Capacitor 8.5.2, `@capgo/capacitor-health` 8.11.4.
- Lifecycle: the voice controller already pauses listening on `visibilitychange`; WKWebView fires it when the app is backgrounded.

### Bridge gotcha

A Capacitor plugin object is a Proxy that answers every property, including `then`. **Never return it from an `async` function or `await` it directly** — the promise machinery calls `Health.then(...)` and hangs forever (symptom: no `⚡️ To Native` log, no permission sheet). `app/components/apple-health.tsx` wraps it as `{ client }`.

## Adapter (Stage 12)

`lib/health/apple-health.ts` implements `HealthDataSource` over a structural `AppleHealthClient` (the plugin subset), returns validated `MetricSample[]` and reports a per-metric status in `lastReport`. Ingestion is `ingestHealthData()` → owner-scoped `saveMetrics` upsert on `(user_id, id)`.

| Registered metric | HealthKit source | Normalization |
| --- | --- | --- |
| `hrv` | `heartRateVariabilitySDNN` samples | ms, one sample per HealthKit object (SDNN only) |
| `resting_hr` | `restingHeartRate` samples | bpm |
| `sleep_duration`, `sleep_start`, `sleep_end` | `sleepAnalysis` segments | Asleep states only (unspecified/core/deep/REM; never in-bed/awake) grouped per source into sessions with gaps ≤ 90 min; duration = union of asleep minutes |
| `steps` | `HKStatisticsCollectionQuery`, day buckets | Daily total (HealthKit de-duplicates iPhone + Watch); today's bucket ends at "now" |
| `active_energy` | same, `activeEnergyBurned` | kcal daily total |
| `workout_duration` | workouts | minutes per workout |
| `workout_avg_hr` | — | **Unsupported**: the plugin exposes no workout heart rate; stays unknown |

IDs are `apple_health:<metric>:<HealthKit UUID>` (sleep: session key; daily totals: bucket start), so re-syncs upsert the same rows.

**Status semantics.** `records` (n), `no_records`, `unsupported`, `failed` (query error or no answer within 45 s). iOS never reveals whether *read* access was declined, so `no_records` means "no history or access not allowed" — never zero, never false. Days without data have no bucket at all.

**Sync.** The Today card ("Connect and sync Apple Health") requests read authorization, reads the last **30 days**, shows each step, and stores the last-sync time on the device. Every sync re-reads the full window (idempotent); there is no cursor yet.

## Real-data policies and case matrix (Stage 13)

Policies:

1. **Duplicates**: the same HealthKit UUID is ingested once.
2. **Multiple sources**: step/energy totals come from HealthKit statistics (source-merged). Overlapping sleep sessions from different sources keep the session with more recorded sleep. Overlapping workouts from different sources keep the longest recording; back-to-back same-source workouts are both kept.
3. **Day assignment**: metric intervals are half-open `[start, end)`. A nonzero interval is assigned to the local date of `end − 1 ms`, so a daily total ending exactly at local midnight belongs to the day it covers (clarified in the shared daily builder; the mock fixture never ends at midnight, so its output is unchanged).
4. **Deletion**: a sync never deletes. An empty or failed query is not evidence of deletion. Records deleted in Apple Health remain until **History → Clear history**; detecting HealthKit deletions needs an anchored deleted-objects query the plugin does not expose (unresolved).
5. **Freshness**: each write bumps the owner's input generation, so dependent daily features, relationship results and experiment comparisons are rebuilt on next read rather than served stale.
6. **Mixed sources**: `mock` samples belong to the synthetic demo scope, `apple_health` to personal; scopes never mix.

| Case | Input (deidentified, `lib/health/apple-health-cases.test.ts`) | Expected | Result |
| --- | --- | --- | --- |
| C1 duplicate export | same HRV/sleep UUID twice | one sample | Pass |
| C2 Watch + running app | overlapping workouts, plus a separate walk | longest run + walk = 65 min | Pass |
| C3 DST fall-back night | 2026-10-24 22:00 → 06:00 Warsaw | 540 min on wake day 10-25 | Pass |
| C4 25-hour DST day | 9 000 steps bucket ending at local midnight | assigned to 10-25 | Pass (was assigned to 10-26 before the policy-3 fix) |
| C5 iPhone + Watch sleep | overlapping sessions | 480 min, not summed | Pass |
| C6 unexpected unit | HRV in seconds | metric fails, nothing stored | Pass |
| C7 empty/repeated sync | no data; same window twice | nothing written or deleted; same IDs | Pass |
| Real device | owner's iPhone, Apple Health, 2026-10-04 | permission sheet, sync completes, records visible in History | Connected by owner; per-metric counts not recorded |
| Time-zone travel, device replacement, Health deletions | — | — | **Not tested** |

Remaining limits: no incremental cursor, no deletion detection, no workout heart rate, HealthKit read denial indistinguishable from no data, simulator data is not real-history evidence.
