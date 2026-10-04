import { addCalendarDays, EvidenceBundleSchema, RelationshipRegistry, type Outcome, type DailyFeatures } from "../domain";
import { AnalyticsReportSchema, analysisVersion, type AnalyticsReport } from "../analytics/contracts";
import { builderVersion } from "../features/contracts";
export function buildEvidenceBundle(input:AnalyticsReport,outcome:Outcome,context:readonly DailyFeatures[]){
 const report=AnalyticsReportSchema.parse(input),current=report.currentDay;
 if(current.userId!==report.userId||current.date!==report.date||current.timeZone!==report.timeZone||current.builderVersion!==builderVersion(report.scope)||report.analysisVersion!==analysisVersion(report.scope))throw new Error("Investigation metadata mismatch");
 const previous=context.find(row=>row.date===addCalendarDays(report.date,-1));
 if(!previous)throw new Error("Explicit previous-day context is required");
 if(previous.builderVersion!==current.builderVersion)throw new Error("Investigation builder mismatch");
 const contextDays=[previous],days=new Map([[current.date,current],[previous.date,previous]]);
 const relationships=report.relationships.filter(result=>RelationshipRegistry[result.relationshipId].outcome===outcome);
 const expected=Object.values(RelationshipRegistry).filter(definition=>definition.outcome===outcome);
 if(relationships.length!==expected.length)throw new Error("Incomplete registered investigation results");
 for(const result of relationships){
  if(result.period.to>=report.date||result.period.from!==addCalendarDays(report.date,-42)||result.period.to!==addCalendarDays(report.date,-1))throw new Error("Investigation history period mismatch");
 }
 const references=expected.flatMap(definition=>[{feature:definition.factor,lagDays:definition.lagDays},...definition.confounders]);
 const missing=new Map<string,{feature:typeof references[number]["feature"];date:string}>();
 for(const ref of references){
  const date=addCalendarDays(report.date,-ref.lagDays),day=days.get(date);
  if(!day)throw new Error("Registered context date missing");
  if(day.features[ref.feature].status==="unknown")missing.set(`${ref.feature}:${date}`,{feature:ref.feature,date});
 }
 const currentValue=current.features[outcome];
 return EvidenceBundleSchema.parse({contractVersion:1,outcome,dailyFeatures:current,contextDays,generatedAt:report.computedAt,analysisVersion:report.analysisVersion,
  currentAnomalies:currentValue.status==="known"?report.anomalies.filter(anomaly=>anomaly.metric===outcome):[],relationships,
  missingPotentialFactors:[...missing.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.feature.localeCompare(b.feature)),
  limitations:[...report.limitations,"Historical associations do not establish the cause of this day's outcome. Competing context is not statistically adjusted.",...(currentValue.status==="unknown"?["The selected day's outcome is unknown; no current value, deviation or cause can be inferred."]:[])]});
}
