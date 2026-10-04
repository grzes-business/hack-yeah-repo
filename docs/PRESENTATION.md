# Presentation: demo plan and visual identity

Prepared 2026-10-04 for the hackathon pitch. The demo runs on a real iPhone launched from Xcode.

## Story in one line

Your watch knows your HRV dropped. It doesn't know you had two beers and a deadline. Personal Evidence joins what your body measures with what you tell it, and only says what the data can actually support: **AI can communicate evidence; AI cannot create evidence.**

## Demo plan (≈ 4 minutes)

| Time | Screen | What you do | What you say |
| --- | --- | --- | --- |
| 0:00 | Title slide | — | The hook above. Wearables give numbers without context; chatbots give context without evidence. |
| 0:30 | **Today** (iPhone) | Show the Apple Health card: "Last synced …", then History with "Apple Health" entries | "This is my real Apple Health data, synced into a private, owner-only history. Nothing is guessed: missing days stay unknown." |
| 1:00 | **Talk** | Hold the green mic: *"I slept badly, had two beers last night and my energy is about four."* Release. | "I just talk. The app extracts only registered observations, shows what it saved, and confirms before anything counts." |
| 1:45 | **Insights**, data source **Synthetic demo** | Scroll the relationship cards | "With eight weeks of history, deterministic code, not the model, tests four predefined relationships, with sample sizes and an explicit 'association ≠ cause'." |
| 2:30 | **Insights → Personal experiment** (Synthetic demo) | Tap **Run the demo experiment** | "From an uncertain pattern we propose a personal experiment: sleep ≥ 7.5 h for two weeks. The comparison is predeclared, counts every missing day, and lists what else could explain it." |
| 3:15 | Architecture slide | — | Voice → structured extraction into a fixed registry → deterministic evidence engine → AI explains only validated facts. Next.js + Supabase + OpenAI Realtime + Capacitor/HealthKit. |
| 3:45 | Close | — | What's next: smoother morning check-in in one sentence, recovery questions answered from your evidence, more experiment templates. |

### Before you go on stage

1. Vercel deployment of this branch is live and **Deployment Protection is off**; the app on the phone was built with `CAP_SERVER_URL=<vercel url>` and Run from Xcode.
2. Migration 011 applied (otherwise the experiment card shows the migration message).
3. In the demo session: **Today → Sample history and settings → Load sample history** (synthetic scope for Insights/experiment), then **Connect and sync Apple Health** (personal scope).
4. Rehearse the spoken report once; voice is the riskiest step. **Fallback:** if voice misbehaves, say "the extraction is deliberately strict; here is what it saved" and go straight to Insights.
5. Phone: Do Not Disturb, brightness up, charged; mirror via QuickTime (File → New Movie Recording → choose the iPhone) over a cable. Prefer a phone hotspot over venue Wi-Fi.
6. Light theme reads best on projectors (moon/sun toggle in the header).

## Visual identity — "Grove"

Calm, outdoorsy fitness rather than clinical: forest green on warm paper, a lime highlight, generous rounding.

### Colours

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Page background | `#EFE8D8` warm beige | `#0D1310` forest night | Slide background |
| Surface / card | `#F8F4EA` paper | `#121915` | Cards, panels |
| Border | `#DDD3BD` sand | `#26322B` | Hairlines |
| Text | `#1D2A21` green-black | `#ECE5D3` beige | Body and titles |
| Primary | `#2D6A3E` forest green | `#93CC9E` sage | Buttons, key numbers, active states |
| Secondary | `#8A4F2C` clay | `#E2A978` apricot | Sparing second accent |
| Accent | `#C5D86D` lime | `#D3E27B` | **Fills and glows only**, never text on light |
| Neutral | `#26352B` | `#2C3A31` | Dark callout blocks |
| Info / success / warning / error | `#2A6680` / `#2A7448` / `#855A12` / `#A93A2A` | `#83C3DC` / `#93D4A6` / `#E9BB63` / `#F08D7B` | Status pills |

All text pairs pass WCAG AA (body text ≥ 10:1, buttons and badges ≥ 4.5:1).

### Gradients

- **Page atmosphere**: base `#EFE8D8` with two soft radial glows: lime at the top-right `radial-gradient(60rem 28rem at 110% -10%, rgba(197,216,109,.22), transparent 70%)` and green at the left `radial-gradient(40rem 24rem at -20% 10%, rgba(45,106,62,.10), transparent 70%)`.
- **Microphone / hero orb**: `radial-gradient(circle at 28% 18%, #5B8B4C, #2D6A3E 55%)` with concentric rings: 10px `rgba(45,106,62,.12)` and 22px `rgba(197,216,109,.16)`, plus a soft green drop shadow.
- **Logo leaf**: `linear-gradient(135deg, #C5D86D, #2D6A3E)` on a leaf shape (`border-radius: 50% 0`).
- **Chart bars**: bottom-to-top `#2D6A3E → #97B75F`, pill-rounded tops.
- **Highlight card** (energy): `linear-gradient(160deg, #E6EAC4, #F8F4EA 65%)`, i.e. lime-tinted paper fading to paper.

### Typography

- **Headings and big numbers**: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), weight 700–750, letter-spacing −0.04em, tight line-height (1.05).
- **Body and UI**: [Geist](https://fonts.google.com/specimen/Geist), 400–600.
- Scale used in the app: title 34px, section 18px, body 14–15px, labels 12px; numbers set in the display font.

### Shape, depth, icons

- Corner radii: cards 20px, buttons/inputs 14px, pills fully rounded; touch targets ≥ 44px.
- Cards: 1px sand border plus a faint green-tinted shadow `0 10px 30px -18px rgba(45,106,62,.35)`.
- Bottom navigation: frosted glass (`backdrop-filter: blur(14px)`, 88% surface).
- Icons: [Phosphor](https://phosphoricons.com) regular weight, filled when active.

### Slide recipe

Beige background with the lime glow in a corner, green-black Bricolage titles, Geist body, one forest-green number per slide as the focal point, lime only as a highlight shape behind it, and status chips as rounded pills. For dark slides use forest night `#0D1310` with beige text and sage `#93CC9E` accents.
