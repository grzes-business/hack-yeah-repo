# Mobile product UI — Stage 10A + 10B

Implementation reference, 2026-10-04. The owner authorized both sub-stages together and selected a voice-first product direction. This document records implementation decisions; final visual and physical microphone acceptance is separate.

## Navigation and layouts

Persistent bottom navigation: **Talk → Today → Insights → History**. Talk is the primary destination, linked from the brand. Existing routes remain `/talk`, `/`, `/evidence`, `/timeline` so saved links continue to work. Root remains Today. No new auth, native framework or analytics engine.

| Screen | Content in order | Primary action / details |
| --- | --- | --- |
| Talk | Compact private-session status; heading; explicit mode/question; microphone/status; latest turn and committed result; collapsed transcript; morning check-in | Start voice, then deliberate hold/release. Select check-in and answer aloud. Stop/mute and recovery remain available. Transcript cards select original reports for voice corrections. |
| Today | Date/source; energy, HRV, sleep and resting heart rate; unusual changes; one investigation action; seven-day energy chart; expandable daily provenance; sample/settings section | Report by voice or select energy/HRV/sleep investigation. No composite score. |
| Insights | Date/source; latest durable investigation and recovery; selected investigation action; energy history; personal baselines; registered relationships; daily provenance | Continue the selected question in Talk; refresh committed evidence or recover its original pending answer. |
| History | Source filter; chronological raw observations with dates, values and sources; voice correction link; collapsed destructive reset | Inspect personal/wearable/voice/synthetic records. No direct metric editing. |

```text
Today / Insights: date + source + outcome
  → server questionAction(start) → validated bundle + selected dated question
  → Talk: explicit loop ID + question key → deliberate spoken answer
  → owned voice plan → canonical atomic capture → refreshed investigation
  → Insights: actual before/after + unchanged/changed historical calculation
```

Morning check-in has its own selected date/dimension and server controller. A stale investigation does not become the default voice target. “Return to reporting” clears the UI interview mode without deleting accepted observations or durable investigation state. “Start morning check-in” also works as a spoken command. Unknown/skip moves past a morning dimension without recording a negative or zero.

## State and data mapping

| Surface | Canonical source | Behavior |
| --- | --- | --- |
| Today metrics, daily details, energy bars | `AnalyticsReport.currentDay`; validated `/api/features` rows | Display registry units and known/unknown states; gaps remain gaps. Bar height maps a 0–10 rating to its fixed axis; no new evidence calculation. |
| Baselines, changes, relationships | `/api/analytics`, `analytics-v1` | GET current results; POST builds when unavailable. Never substitute fixture numbers. Historical periods/counts/lag/method/limitations stay inspectable. |
| Investigation + next question | `/api/questions`, `questions-v1` | Owner-derived state; current freshness required; selection passed explicitly to Talk. Personal/demo disclosure follows the loop, even when browsing a different source. |
| Short spoken investigation | Validated fact corpus | Select synthetic disclosure/current outcome/one anomaly or historical fact, then causal limitation and question. Full facts stay in Insights. |
| Saved speech / result | Conversation turns, durable voice receipt, capture transaction | Transcript saving and observation confirmation are distinct. Latest feedback remains visible without opening transcripts. |
| History | Validated bounded repository read | Raw sources remain distinct; up to 500 records from each raw source. Stored timestamps can be representative when only a date was spoken; they are not proof of an exact reported clock. |

| State | Visible meaning / action |
| --- | --- |
| Loading/recomputing | Status text; no current-result claim until validation. |
| Empty / unknown | Unknown with reason; invite a report or explicitly labeled sample history. |
| Explicit negative | Reported absent/no consumption; preserved as a known value. |
| Insufficient history | Insufficient eligible data or variation, not absence of association. |
| Evaluated weak/no meaningful signal | Exact backend evidence label and limitations, not insufficient-data wording. |
| Stale | Prior state is not current; refresh confirmed evidence. A pending capture is recovered without new speech/text entry. |
| Offline/provider/save failure | Visible error and retry. Existing saved observations remain. No offline queue is claimed. |
| Permission denial/disconnection | Mic off and actionable notice; stop releases resources; new call requires explicit start. |
| Clarification/correction | Select original owned report; speak answer/correction. Prior accepted set remains until complete replacement is committed. |

## Voice integration contracts

`VoiceTurnInput.context` defaults to `{mode: report}`. Check-in supplies local date and one of energy/soreness/mood/illness. Investigation supplies loop ID and question key, never scope/owner/raw values. The server verifies current selected state and persists the inferred question context in the existing immutable voice plan before any capture. Ordinary reports cannot be silently routed to a global/demo question. Explicit commands/retrieval retain their classifier precedence.

Morning extraction receives a trusted server-derived question. Bare ratings/yes/no are guarded for that dimension; full reports must support their own types. Original transcripts are not rewritten. Atomic capture/replay remains in the existing RPC. Morning unknown/skip updates skipped state, not observations. Dev-window override and quick reset remain in Talk, ignored in production. No SQL migration is required.

Question selections are browser UI state under the existing session provider. A reload defaults to personal reporting; durable investigations can be explicitly resumed from Insights. Leaving Talk ends the call through the existing cleanup/recovery path; navigation does not promise a background call. Original pending transcript storage remains owner-specific.

Normal reporting and question answers require voice. Text answer/correction forms are removed from the normal journey. Date/source/outcome browsing and destructive-history confirmation are ordinary UI controls, not health-report entry. Development inspectors are collapsed and excluded from the production Insights route.

## Visual specification

- Styling uses Tailwind CSS v4 + daisyUI 5 (`app/globals.css`, `postcss.config.mjs`). daisyUI `light` (default) and `dark` (`prefersdark`) themes own colors, controls and surfaces: `btn`, `card card-body`, `badge`, `input`/`select`/`textarea`, `navbar` header and `dock` bottom navigation. System preference selects the theme; the header toggle sets `data-theme` on `<html>`, which daisyUI honours. App-specific CSS covers only layout, the microphone, the energy chart and `<details>` disclosure. A custom daisyUI theme replacing the stock palette is the next visual step.
- Geist/system typography; compact functional headings, sentence-case labels and restrained surfaces. Unknown values use ordinary readable text, never color alone.
- Content max 48rem; phone gutters 14–20px; two metric columns on phones/four on desktop. Four fixed bottom destinations with safe-area padding and sufficient document bottom clearance.
- Controls and summaries at least 44px high; microphone 148px on phones / 170px desktop; visible focus and skip link; 16px input text; long IDs/payloads wrap; reduced-motion support. Portrait widths 320/375/390/430 are the review targets.
- Energy chart has explicit 0–10 axis description and readable per-day values. It contains no readiness score, smoothing, interpolated gaps or trend inference.

## Acceptance and Capacitor handoff

Run `pnpm verify:mobile` against the dev server for live disposable-account API/provider checks (morning test override is dev-only), plus build/lint/type and the recorded browser review. `/mobile-preview` is a dev-only iframe preview with actual 320/375/390/430px application layouts; production returns 404. It uses the existing browser session; avoid destructive actions in a preview of real data.

Physical phone microphone, touch hold/cancellation, speaker interruption, keyboard/landscape and iOS WebView lifecycle remain manual. Stage 11 must verify HTTPS/origin, audio permissions, safe areas, keyboard/back behavior, background/foreground cleanup, anonymous-session storage and access to deployed Next.js APIs. Stage 12 owns actual Apple Health ingestion. Current synthetic objective data must never be described as connected Apple Health.

## Design revision after owner review

> 2026-10-04: the owner then moved styling onto daisyUI as a baseline before further custom work; the palette and radii below are superseded by the daisyUI themes described in the visual specification.


The owner rejected the first visual treatment and explicitly requested `design-taste-frontend`. The revised design preserves URLs, navigation labels, consent semantics and all product/controller behavior. Audit: retire sage/peach gradients, repeated heavy cards, oversized marketing headlines, Unicode icons and copy above the microphone. Dials: DESIGN_VARIANCE 5, MOTION_INTENSITY 3, VISUAL_DENSITY 4, adjusted for a health application. The skill primarily targets marketing pages; its applicable typography/color/icon/spacing/accessibility guidance is used here without adding landing-page photos or promotional content.

One Phosphor icon family, monochrome actions and cool neutrals, system light/dark tokens, 14px surfaces/10px buttons/8px inputs; circular mic/status are functional exceptions. The actual microphone is the focal point of Talk; current interview selection and save feedback stay visible. Motion communicates recording/press state only and respects reduced motion. Private session is compact; settings, privacy, playback and transcript recovery use progressive disclosure.

## Recorded automated verification

- 83 unit checks passed after context-schema and short-investigation coverage was added. TypeScript and ESLint passed.
- Real hosted Supabase/OpenAI requests through `verify-mobile.mjs` passed: spoken morning command; bare rating; exact uncertainty/skip without events; explicit illness negative; same-turn replay without duplicates; stale morning target rejection; ordinary reports during a demo loop stay personal; explicitly selected demo answers stay synthetic; raw metric rows unchanged; short grounded investigation; actual daily read/aggregation values and unknown gaps. Disposable account deleted in `finally`; existing histories untouched.
- Previous Stage 9 voice acceptance script was updated to send explicit investigation selection, matching the new contract. It must not assume that every account-level question automatically captures a report.
- Physical microphone/phone acceptance is not included in these API checks.

### Browser check after daisyUI adoption — 2026-10-04

Production build (`next start`) in the Claude desktop in-app Chromium, viewport emulation only, signed out plus a restored anonymous session with no history:
- Talk/Today/Insights/History/status at 320/375/390/430px: no horizontal overflow; every control has an accessible name.
- Touch targets: daisyUI's default 40px field size and the 32px `btn-sm` call controls broke the 44px rule; fixed via `--size-field` and removing `btn-sm`. All controls now measure ≥44px.
- Keyboard: skip link appears on first Tab; 3px visible focus outline on header, dock and controls.
- **Contrast fails (open):** stock dark theme primary buttons and links 4.13:1 (needs 4.5:1); light-theme soft success/info badges (“Private session”, “Synthetic demo”) about 2:1. To be resolved by the custom daisyUI theme.
- Not performed: populated-account screens, the Today → Talk → Insights journey, failure/sparse rehearsal, real device, microphone.
