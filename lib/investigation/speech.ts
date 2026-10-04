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
export function answerSpeech(results: InvestigationResult[], question?: string) {
  const [primary] = results, parts: string[] = [];
  if (primary.scope === "demo") parts.push("This is synthetic demo data.");
  const today = primary.bundle.dailyFeatures.features[primary.bundle.outcome];
  if (today.status === "known" && typeof today.value === "number") parts.push(`Your ${lower(FeatureRegistry[primary.bundle.outcome].label)} today is ${formatValue(primary.bundle.outcome, today.value)}.`);
  for (const a of primary.bundle.currentAnomalies.slice(0, 2)) {
    parts.push(`Your ${lower(FeatureRegistry[a.metric].label)} was ${formatValue(a.metric, a.value)}, ${a.classification === "unusually_low" ? "well below" : "well above"} your usual ${formatValue(a.metric, a.baseline)}.`);
  }
  const relationships = results.flatMap(r => r.bundle.relationships).filter(r => r.status === "evaluated" && STRENGTH[r.evidence] >= 2)
    .sort((a, b) => STRENGTH[b.evidence] - STRENGTH[a.evidence]);
  const best = relationships[0];
  if (best) {
    const d = RelationshipRegistry[best.relationshipId];
    parts.push(`In your history, ${lower(FeatureRegistry[d.factor].label)}${d.lagDays ? " the day before" : ""} and ${lower(FeatureRegistry[d.outcome].label)} show ${LABEL[best.evidence]}, not proof of a cause.`);
  }
  if (parts.length === (primary.scope === "demo" ? 1 : 0)) parts.push("Nothing stands out in your recorded data yet.");
  parts.push(question ?? "I have no open question for that day; Insights shows the details.");
  return parts.join(" ");
}

/** Backwards-compatible single-result form. */
export function investigationSpeech(result: InvestigationResult, question?: string) {
  return answerSpeech([result], question);
}
