// Deterministic backstop for measurements the registry does not track. The intent model is the primary
// classifier; this only prevents a retrieval question about an untracked metric from being answered with other types.
const untracked = /\b(hrv|heart[- ]?rate|resting heart|pulse|sleep|steps?|weight|glucose|blood (?:pressure|sugar)|vo2|spo2|hydration|calories?|tętno|sen|kroki|waga)\b/i;

export function untrackedMetricName(transcript: string): string | null {
 const match = transcript.match(untracked);
 return match ? match[0].toLowerCase() : null;
}

export function unsupportedMetricReply(metric: string, language: "en" | "pl"): string {
 return language === "pl"
  ? `Nie mam zapisanych danych dla: ${metric}. Mogę odczytywać zapisy energii, stresu, nastroju, bolesności mięśni, wysiłku treningowego, alkoholu, kofeiny, późnych posiłków, objawów choroby i bólu.`
  : `I don't have saved reports for ${metric}. I can retrieve energy, stress, mood, soreness, workout effort, alcohol, caffeine, late meals, illness symptoms, and pain.`;
}
