# Conversation and active sensing

GPT-Live is the project's name for its planned real-time voice experience. Stage 3 selects the concrete provider API/session integration. These are product boundaries, not SDK instructions or a final tool API.

## Canonical capture pipeline

```text
Speech → live conversation → transcript/turn
       → capture request → backend extraction candidate
       → registry/schema validation → subjective event persistence
```

The live model handles turn-taking and natural responses. Canonical health-event extraction is a separate backend responsibility, even if both ultimately use a model. The conversational model cannot write arbitrary database objects. Preserve turn provenance and distinguish candidates from accepted, persisted observations.

| Outcome | Meaning | User-visible behavior |
| --- | --- | --- |
| `captured` | Validated observations were captured | Reflect accepted observations accurately. |
| `nothing_trackable` | No statement maps safely to a registered type | Do not manufacture a variable; optional notes follow the chosen contract. |
| `needs_clarification` | A supported observation has unresolved meaning | Ask about the unresolved detail; do not persist a guessed complete event. |

Stage 4 defines mixed/partial utterance behavior, replay protection, and confirmations after successful persistence. A model saying “saved” is not proof of a database write.

## Capture examples

| Statement | Expected handling |
| --- | --- |
| “I had two beers yesterday.” | Candidate alcohol observation; resolve user-local date and validate quantity/unit semantics. |
| “Had two beers last night and ate way too late.” | Potentially two observations, each mapped to a known type and linked to the original turn. |
| “My knee hurts.” | Capture only supported pain/location; infer no injury or intensity. |
| “I feel brain-scrambled.” | Clarify a known dimension or mark not trackable; never invent `brain_scrambledness`. |
| “I didn't drink yesterday.” | Explicit negative if supported; distinguish it from no report. |

These describe behavior. Stage 0 now defines draft and canonical event payloads in [domain contracts](DOMAIN.md). Extraction candidates cannot assign application-owned IDs or conversation provenance. Version 1 uses all-or-clarify for each statement; Stage 4 must explicitly evolve the contract if mixed partial capture is needed.

## Check-in controller

The application owns mode, eligible dimensions, known/clarification state, and question selection. Initial morning dimensions: energy, soreness, mood, illness.

1. Load known observations for the relevant window.
2. Deterministic `getNextQuestion()` selects a missing dimension or clarification.
3. GPT phrases the selected question without adding unrelated dimensions.
4. The answer goes through canonical capture and validation.
5. Update interview state from accepted observations; select the next question or finish.

Do not repeatedly ask about a captured dimension unless clarification is needed. Stage 5 defines completion, resumption, and voluntary answers covering multiple dimensions. Later workout interviews should reuse this boundary.

## Investigation and active sensing

Stage 8 requests deterministic `investigateOutcome({ userId, outcome, date })` and receives an `EvidenceBundle`. Explanation communicates its facts and limits; it cannot choose new edges or inspect unrestricted raw records to invent theories.

Stage 9 adds missing-context detection. Deterministic `selectBestQuestion()` chooses one relevant unknown using predefined relationships and coverage on the factor's date. Missing context is a `{ feature, date }` reference: alcohol for today's HRV refers to yesterday. GPT phrases it, canonical capture saves the answer, and investigation reruns. UI shows the changed input and evidence state. A negative answer reports absence; a skipped question remains unknown.

## Failure behavior to define

Stage 3 owns denied microphone access, disconnected/expired sessions, and transcript persistence state. Stage 4 owns invalid extraction, unclear dates, repeated capture, and persistence failure. Stage 5 owns incomplete/resumed interviews. Stages 8–9 own insufficient evidence and unanswered follow-ups. Failures must not become fabricated observations or health conclusions. Enforce mode/tool permissions in application code, not only prompts.

Read [domain](DOMAIN.md) for contracts and [evidence](EVIDENCE.md) for explanation rules.
