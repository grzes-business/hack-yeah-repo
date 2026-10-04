import { FeatureRegistry, RelationshipRegistry, type EvidenceLevel } from "../domain";
import { formatValue } from "../format";
import type { InvestigationResult } from "./contracts";

const STRENGTH: Record<EvidenceLevel, number> = { CONSISTENT_ASSOCIATION: 4, POSSIBLE_ASSOCIATION: 3, WEAK_SIGNAL: 2, NO_MEANINGFUL_SIGNAL: 1, INSUFFICIENT_DATA: 0 };
const LABEL: Record<EvidenceLevel, string> = { CONSISTENT_ASSOCIATION: "a consistent association", POSSIBLE_ASSOCIATION: "a possible association", WEAK_SIGNAL: "a weak signal", NO_MEANINGFUL_SIGNAL: "no meaningful signal", INSUFFICIENT_DATA: "not enough data" };
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Answer first, then at most one question. Every number comes from validated
 * bundle fields (current day, backend anomalies, evaluated relationship labels);
 * nothing is calculated here. `results` are the asked outcome first, then any
 * outcome followed because it was flagged unusual today.
 */
export function answerSummary(results: InvestigationResult[]) {
  const [primary] = results, parts: string[] = [];
  if (primary.scope === "demo") parts.push("This is synthetic demo data.");
  const today = primary.bundle.dailyFeatures.features[primary.bundle.outcome];
  if (today.status === "known" && typeof today.value === "number") parts.push(`Your ${lower(FeatureRegistry[primary.bundle.outcome].label)} today is ${formatValue(primary.bundle.outcome, today.value)}.`);
  for (const a of primary.bundle.currentAnomalies.slice(0, 2)) {
    parts.push(`Your ${lower(FeatureRegistry[a.metric].label)} was ${formatValue(a.metric, a.value)}, ${a.classification === "unusually_low" ? "well below" : "well above"} your usual ${formatValue(a.metric, a.baseline)}.`);
  }
  // Today's known values of the outcome's registered same-day factors, when not already flagged above.
  for (const d of Object.values(RelationshipRegistry).filter(r => r.outcome === primary.bundle.outcome && r.lagDays === 0)) {
    const f = primary.bundle.dailyFeatures.features[d.factor];
    if (f.status === "known" && typeof f.value === "number" && !primary.bundle.currentAnomalies.some(a => a.metric === d.factor)) parts.push(`Your ${lower(FeatureRegistry[d.factor].label)} was ${formatValue(d.factor, f.value)}.`);
  }
  const relationships = results.flatMap(r => r.bundle.relationships).filter(r => r.status === "evaluated" && STRENGTH[r.evidence] >= 2)
    .sort((a, b) => STRENGTH[b.evidence] - STRENGTH[a.evidence]);
  const best = relationships[0];
  if (best) {
    const d = RelationshipRegistry[best.relationshipId];
    parts.push(`In your history, ${lower(FeatureRegistry[d.factor].label)}${d.lagDays ? " the day before" : ""} and ${lower(FeatureRegistry[d.outcome].label)} show ${LABEL[best.evidence]}, not proof of a cause.`);
  }
  else parts.push("Your history doesn't have enough overlapping days yet to compare patterns.");
  if (parts.length === (primary.scope === "demo" ? 1 : 0)) parts.push("Nothing stands out in your recorded data yet.");
  return parts.join(" ");
}

export function answerSpeech(results: InvestigationResult[], question?: string) {
  return `${answerSummary(results)} ${question ?? "I have no open question for that day; Insights shows the details."}`;
}

/** Backwards-compatible single-result form. */
export function investigationSpeech(result: InvestigationResult, question?: string) {
  return answerSpeech([result], question);
}
