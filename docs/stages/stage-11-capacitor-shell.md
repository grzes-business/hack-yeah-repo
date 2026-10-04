# Stage 11 — Capacitor shell

## Status and intended outcome

**Implemented 2026-10-04 (hosted-URL loading model). The app runs on the owner's iPhone from Xcode against the Vercel deployment, including Apple Health. See [HEALTHKIT](../HEALTHKIT.md).**

The existing experience runs in an iOS-capable shell with secure web/backend communication and a typed native adapter seam.

**Dependencies:** [Stage 10](stage-10-evidence-ui.md), including reviewed [Stage 10A design](stage-10a-mobile-product-design.md) and accepted [Stage 10B mobile UI](stage-10b-mobile-ui-implementation.md); Stage 0 source contract. Package the usable mobile web experience; product layout and navigation design belong to Stage 10.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [architecture](../ARCHITECTURE.md), [conversation](../CONVERSATION.md), and [persistence](../PERSISTENCE.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

There is no native project or Capacitor dependency yet. The web application uses Next.js with server/backend behavior added in earlier stages. Use `docs/MOBILE-UI.md` from Stage 10A/10B as the interaction reference; resolve actual native safe-area, keyboard, back and audio differences here. Shared domain/source logic must remain usable independently of native APIs.

## Implementation work

1. Inspect current Capacitor/iOS requirements and supported versions at implementation time. Record toolchain, plugin compatibility, and how to open/build the iOS project.
2. Decide the loading model explicitly: hosted web app or bundled web assets plus hosted backend. Next.js server routes do not execute inside a WebView; do not assume a static export preserves backend behavior. Document URLs, environment selection, origin/CORS/auth constraints, and offline limitations.
3. Add a minimal native shell and bridge boundaries. Keep registry/validation/aggregation/statistics in shared web/backend layers. Exchange canonical samples through a typed validated interface; native code must not invent derived health evidence.
4. Integrate browser/native session behavior, verified backend requests, safe storage, expiration/reconnect, and sign-out. Never bundle service/provider secrets in native assets.
5. Establish permission groundwork for microphone and future HealthKit, with accurate usage descriptions. Request capabilities only when used. Resolve live audio support in the actual WebView rather than assuming desktop behavior.
6. Adapt safe areas, keyboard behavior, scrolling, navigation/back actions, and background/foreground lifecycle. Release audio resources on appropriate lifecycle transitions.
7. Keep browser mock behavior working on unsupported platforms. Document simulator checks versus physical-device checks; no HealthKit success claim based solely on the simulator.

## Decisions and constraints

Loading strategy, origin/auth transport, credential storage, plugin versions, and live audio support are decisions owned here. A health bridge can remain an interface/stub until Stage 12. Do not change shared analytics to accommodate native APIs.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S11-AC01:** The documented iOS build opens/runs the existing product experience with working navigation, session restoration, and backend authentication.
- **S11-AC02:** The loading model correctly separates WebView code from hosted server routes and documents environment/origin configuration.
- **S11-AC03:** Native/web messages are typed/validated and preserve the `HealthDataSource` boundary; no native statistics or privileged keys exist.
- **S11-AC04:** Microphone start/stop and background/foreground transitions follow declared lifecycle behavior on the tested runtime, or a clearly documented unsupported state is shown.
- **S11-AC05:** Safe areas, keyboard, scrolling, and navigation are usable on the tested iOS form factor.
- **S11-AC06:** Browser/mock flows still work; unsupported native capabilities degrade honestly without invented samples.
- **S11-AC07:** Simulator/device/toolchain versions and remaining physical-device requirements are recorded.

## Verification and completion record

Build/run the native shell, exercise sign-in/reload/navigation, verify authenticated backend access and absence of bundled secrets, and check keyboard/safe-area/audio lifecycle. Record simulator and device results separately. Consult official current platform docs during implementation.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Real HealthKit queries, source-specific analytical branches, native statistical algorithms, and App Store publishing.

## Documentation handoff

Update ARCHITECTURE and README with build/loading/auth instructions, CONVERSATION with WebView audio limitations, and the source adapter documentation with the actual bridge interface.

## Completion record — 2026-10-04

- Decision: hosted-URL loading (`server.url`), no static export; secrets and API routes stay on Vercel. HealthKit bridge is `@capgo/capacitor-health` via SPM.
- Checks performed: Simulator build/run (Xcode 26.6, iOS 26.5, iPhone 17 Pro) loading the local server; owner's iPhone run from Xcode loading the Vercel deployment with working navigation, session restoration, voice microphone over https and Apple Health. Lint/type/build/unit checks passed.
- Found and fixed: `pnpm cap:sync` aborted on a package-store mismatch (store pinned in `pnpm-workspace.yaml`); plugin proxy awaited as a thenable hung the bridge.
- Not checked: keyboard/landscape/background audio behaviour on device beyond normal use, App Store signing. Owner reports noisy but non-blocking Xcode console warnings.
