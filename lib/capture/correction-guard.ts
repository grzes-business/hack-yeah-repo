import { ExtractionResultSchema, SubjectiveEventRegistry, type ExtractionResult } from "../domain";

type Captured = Extract<ExtractionResult, { status: "captured" }>;
type Event = Captured["events"][number];
type GuardedType = Event["type"];

// Deterministic backstop for a model-produced follow-up. It never adds observations and never
// rewrites values; it refuses or narrows a result that drops accepted observations, leaves an open
// item unanswered, spreads one number over several items, invents an unmentioned observation, or keeps
// consumption that the correction negates.
const negation = /\b(no|not|none|didn'?t|did not|don'?t|any|without)\b|\bnie\b|\bbez\b/i;
// "I do not know the dose" negates knowledge, not consumption, so it must not trigger the negation check.
const knowledgeOnly = /\b(do not|don'?t|did not|didn'?t|not)\s+(know|remember|recall|sure)\b[^.;,]*/gi;
const mentions: Partial<Record<GuardedType, RegExp>> = {
 caffeine: /\b(coffee|caffeine|tea|espresso|energy drink)\b|kawa|kofein|herbat/i,
 alcohol: /\b(alcohol|beers?|wine|vodka|cocktails?|drinks)\b|piw|wino|wódk|alkohol/i,
 soreness: /\b(sore|soreness|ache|aching)\b|bolesn/i,
};
const negatableTypes = ["caffeine", "alcohol"] as const;
const numericTypes: GuardedType[] = ["energy", "stress", "mood", "soreness", "workout_rpe", "alcohol"];
// Scale words such as "out of ten" are not separate values.
const scaleWords = /out of (ten|10)|\/\s*10|from 0 to 10|0 to 10|0-10|na 10|z 10/gi;
const numberToken = /(?<!\p{L})(\d+(?:[.,]\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|jeden|jedna|dwa|dwie|trzy|cztery|pięć|sześć|siedem|osiem|dziewięć|dziesięć)(?!\p{L})/giu;

function consumedIn(result: Captured, type: (typeof negatableTypes)[number]) {
 return result.events.some(event => (event.type === "caffeine" || event.type === "alcohol") && event.type === type && event.value.consumed === true);
}

// An open item is answered only when its value is decided; an unknown drink count is still open.
function answered(event: Event) {
 if (event.type === "alcohol") return !event.value.consumed || event.value.quantity !== null;
 return true;
}

function clarify(eventTypes: GuardedType[], reason: string): ExtractionResult {
 return ExtractionResultSchema.parse({ status: "needs_clarification", eventTypes, reason });
}

function askFor(types: GuardedType[]) {
 const names = types.map(type => SubjectiveEventRegistry[type].label.toLowerCase());
 return `Please answer for each open item in one reply: ${names.join(" and ")}.`;
}

function countNumbers(text: string) {
 return [...text.replace(scaleWords, " ").matchAll(numberToken)].length;
}

/**
 * Returns the model result unchanged when it is consistent with the accepted observations, the open items, and the source texts.
 * Otherwise returns a needs_clarification outcome, so nothing partial or contradictory is saved.
 */
export function guardCorrection(
 input: ExtractionResult,
 sources: { original: string; followup: string },
 context: { accepted: ExtractionResult | null; open: GuardedType[] },
): ExtractionResult {
 if (input.status !== "captured") return input;
 const acceptedEvents = context.accepted?.status === "captured" ? context.accepted.events : [];
 for (const event of acceptedEvents) {
  if (!input.events.some(next => next.type === event.type)) return clarify([event.type], `Your earlier ${SubjectiveEventRegistry[event.type].label.toLowerCase()} report must stay in the correction. Please say it again.`);
 }
 const missing = context.open.filter(type => !input.events.some(event => event.type === type && answered(event)));
 if (missing.length) return clarify(missing, askFor(missing));
 // Only ratings and drink counts need a number; an unknown caffeine dose is a final value, not an open number.
 const numeric = context.open.filter(type => numericTypes.includes(type));
 if (numeric.length > 1 && countNumbers(sources.followup) < numeric.length) return clarify(numeric, askFor(numeric));
 // A new observation the speaker never mentioned is removed, never kept: removing cannot create evidence.
 const isUnmentioned = (event: Event) => {
  const pattern = mentions[event.type];
  return !!pattern && !acceptedEvents.some(known => known.type === event.type) && !pattern.test(sources.original) && !pattern.test(sources.followup);
 };
 const events = input.events.filter(event => !isUnmentioned(event));
 if (!events.length) {
  const unmentioned = input.events.find(isUnmentioned);
  return unmentioned ? clarify([unmentioned.type], "I could not safely apply that correction. Please say it again and name the item it changes.") : input;
 }
 const result = ExtractionResultSchema.parse({ status: "captured", events }) as Captured;
 const asserted = sources.followup.replace(knowledgeOnly, " ");
 if (negation.test(asserted)) {
  for (const type of negatableTypes) {
   if (mentions[type]?.test(asserted) && consumedIn(result, type)) return clarify([type], "I could not safely apply that correction. Please say it again and name the item it changes.");
  }
 }
 return events.length === input.events.length ? input : result;
}
