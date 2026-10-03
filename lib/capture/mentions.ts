import type { SubjectiveEventType } from "../domain";

// Deterministic check that the spoken words support each event type. An event whose type the words never
// mention is removed before anything is saved. Synonyms are deliberately broad: this rejects invention, not wording.
const supportingWords: Record<SubjectiveEventType, RegExp> = {
 energy: /energ|tired|fatig|exhaust|drain|rested|sleepy|zmęcz|senn/i,
 stress: /stress|anxi|overwhelm|worr|napi[ęe]/i,
 mood: /mood|happy|sad|\blow\b|down|upbeat|cheerful|irritab|positive|negative|feel(?:ing)?|nastr|humor/i,
 soreness: /sore|ache|aching|stiff|muscle|\blegs?\b|bolesn|obola/i,
 workout_rpe: /rpe|effort|\bhard\b|intens|exert|wysi[lł]ek|trening|workout|training|session|exercise/i,
 alcohol: /alcohol|beer|wine|vodka|drink|cocktail|liquor|whisk|\bgin\b|\brum\b|piw|wino|wódk|alkohol|drank/i,
 caffeine: /coffee|caffein|\btea\b|espresso|latte|\bcola\b|kawa|kofein|herbat/i,
 pain: /pain|painful|hurts?|hurting|injur|aches?|aching|ból|boli|boleń/i,
 illness: /\bill\b|sick|unwell|illness|symptom|\bcold\b|\bflu\b|fever|cough|infection|nausea|vomit|chor|choroba|objaw|przezi[ęe]b|grypa/i,
 late_meal: /late|meal|dinner|supper|\bate\b|\beat\b|food|kolacj|posi[lł]ek/i,
};

export function isSupportedBy(type: SubjectiveEventType, text: string): boolean {
 return supportingWords[type].test(text);
}
