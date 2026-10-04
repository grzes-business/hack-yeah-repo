# Presentation: demo plan and visual identity

Prepared 2026-10-04 for the hackathon pitch. The demo runs on a real iPhone launched from Xcode.

## Story in one line

Your watch knows your HRV dropped. It doesn't know you had two beers and a deadline. Personal Evidence joins what your body measures with what you tell it, and only says what the data can actually support: **AI can communicate evidence; AI cannot create evidence.**

## Submission (HackYeah — SPORT & HEALTHCARE)

Deadline **4 Oct, 23:00**. Required: project title, team name, members, description, **PDF ≤ 10 slides**. Optional: video/demo link, repo, screenshots. Judging: Idea 30 · Relation to category 20 · Practical use 20 · Design 20 · Completeness 10. The brief asks for a specific user group, a clear journey, low effort for regular use, accessibility, and an achievable next step. Disclose AI tools/APIs used (OpenAI Realtime/Responses, Supabase, Capacitor, daisyUI) and separate any pre-event work.

**Target user:** recreational athletes with a smartwatch who train around work and want to know why some days feel bad — without becoming data analysts.

## Video (≈ 3½ min)

| Time | Beat | What is shown |
| --- | --- | --- |
| 0:00–0:20 | Problem + user | “My watch says HRV is low. It doesn't know I had beers and a deadline.” Wearables measure; context lives in your head. |
| 0:20–0:45 | Effortless habit | Morning check-in: one spoken sentence (“Energy three, a bit sore, mood five, not sick”) → four chips tick. Apple Health synced automatically. |
| 0:45–1:00 | Today | Energy 3/10, HRV unusually low, sleep typical, “How today compares”. |
| 1:00–1:50 | Why am I so tired? | Answer first from the relationship graph: what is unusual today, which registered relationships could explain it and what is known/unknown for each; then **one** question about the strongest unknown factor (“Did you drink anything yesterday?”). |
| 1:50–2:20 | Answer → recap | “Yes, three beers.” Saved, then a concise grounded recap with counts; association, not cause. |
| 2:20–2:50 | Achievable next step | Personal experiment: sleep ≥ 7.5 h for two weeks, predeclared comparison, honest limits. |
| 2:50–3:30 | Trust + build | AI explains, code decides (registry, deterministic evidence, provenance, unknown ≠ zero); iPhone + HealthKit + voice; Grove design. |

## 10-slide PDF

1. Title + one-liner (“Personal evidence from your watch and your words”). 2. Problem (data without context). 3. User + journey. 4. Morning check-in + Apple Health (low effort, voice = accessible). 5. “Why am I tired?” answer-first screenshot. 6. Relationship graph → question → recap. 7. Experiment = next step. 8. Trust: AI communicates evidence, never creates it. 9. Architecture + what was built during HackYeah (+ AI/API disclosure). 10. Impact, roadmap (clinician prep, more relationships), team.

## Reasoning rule for “why” questions (item 3)

Start from the asked outcome (or energy for tiredness/recovery) **and every metric flagged unusual today**. Walk the registered relationship graph backwards into those outcomes (sleep → energy, workout effort → energy, alcohol → HRV, stress → sleep). For each edge: evidence label from history, factor value on its lagged date (known / unknown), and whether it is notable. Speak the known facts and the strongest evaluated edges in one or two sentences, then ask about the highest-ranked **unknown** factor. Never assert an edge that is not registered (energy and HRV are stated as separate facts).

## What's left (agreed order)

1. **Morning check-in:** show saved values (“Energy 3 ✓”) and a production *Reset today's check-in* button.
2. **Model:** intent and extraction on `gpt-5-mini` (verify availability), replacing `gpt-4.1-mini`.
3. **Routing:** “why am I tired”, recovery and similar questions start the graph-based investigation automatically.
4. **Reasoning:** relationship-graph rule above (all registered edges).
5. **Answer first, then one question** in one or two plain sentences; natural question wording, no ISO dates or rubric text.
6. **Concise recap** after the answer.
7. **Demo day = today (4 Oct):** synthetic history shaped so today has low energy, unusually low HRV, typical sleep and yesterday's alcohol unreported; independent of real HRV.

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
