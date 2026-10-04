import { addCalendarDays, EvidenceBundleSchema, RelationshipRegistry, type EvidenceBundle, type Feature } from "../domain";
import { QuestionSchema, type Question } from "./contracts";
// Deliberately excludes objective measurements, and never asks a user to estimate wearable values.
const answerable=["alcohol","stress","illness","workout_rpe","caffeine","late_meal"] as const;
export const questionKey=(feature:Feature,date:string)=>`${feature}:${date}`;
/** "Saturday, 3 Oct" for a local calendar date (UTC formatting avoids zone shifts). */
export function spokenDate(date:string){
 return new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${date}T00:00:00Z`));
}
export function questionText(feature:typeof answerable[number],date:string){
 const day=spokenDate(date);
 switch(feature){
  case "alcohol":return `Did you drink any alcohol on ${day}? Yes or no is enough.`;
  case "illness":return `Did you feel ill on ${day}?`;
  case "late_meal":return `Did you eat a late meal on ${day}?`;
  case "caffeine":return `How much caffeine did you have on ${day}, in milligrams? Say none if you had none.`;
  case "stress":return `How stressful was ${day}, from 0 to 10?`;
  case "workout_rpe":return `How hard was your workout on ${day}, from 0 to 10? Say skip if you didn't train.`;
 }
}
export function selectBestQuestion(raw:EvidenceBundle,excluded:readonly string[]=[]):Question|null{
 const bundle=EvidenceBundleSchema.parse(raw),definitions=Object.values(RelationshipRegistry).filter(r=>r.outcome===bundle.outcome);
 const candidates=bundle.missingPotentialFactors.flatMap(ref=>{
  if(!answerable.includes(ref.feature as typeof answerable[number])||excluded.includes(questionKey(ref.feature,ref.date)))return [];
  const day=[bundle.dailyFeatures,...bundle.contextDays].find(d=>d.date===ref.date),value=day?.features[ref.feature];
  if(!value||value.status!=="unknown"||value.reason!=="not_observed")return []; // ambiguous/unavailable/partial coverage need a separate repair, not another exposure report.
  const matches=definitions.filter(r=>[{feature:r.factor,lagDays:r.lagDays},...r.confounders].some(f=>f.feature===ref.feature&&addCalendarDays(bundle.dailyFeatures.date,-f.lagDays)===ref.date));
  if(!matches.length)return [];
  const direct=definitions.some(r=>r.factor===ref.feature&&addCalendarDays(bundle.dailyFeatures.date,-r.lagDays)===ref.date);
  return [{...ref,direct,coverage:matches.length,priority:answerable.indexOf(ref.feature as typeof answerable[number])}];
 });
 candidates.sort((a,b)=>Number(b.direct)-Number(a.direct)||b.coverage-a.coverage||a.priority-b.priority||a.date.localeCompare(b.date)||a.feature.localeCompare(b.feature));
 const selected=candidates[0];
 return selected?QuestionSchema.parse({...{feature:selected.feature,date:selected.date},key:questionKey(selected.feature,selected.date),text:questionText(selected.feature as typeof answerable[number],selected.date)}):null;
}
export function compareEvidence(before:EvidenceBundle,after:EvidenceBundle){
 if(before.outcome!==after.outcome||before.dailyFeatures.date!==after.dailyFeatures.date||before.dailyFeatures.userId!==after.dailyFeatures.userId||before.dailyFeatures.timeZone!==after.dailyFeatures.timeZone||before.analysisVersion!==after.analysisVersion)throw new Error("Evidence comparison contexts differ");
 const changes:{feature:Feature;date:string;before:unknown;after:unknown}[]=[];
 for(const day of [after.dailyFeatures,...after.contextDays]){
  const prior=[before.dailyFeatures,...before.contextDays].find(d=>d.date===day.date);
  if(!prior)throw new Error("Missing comparison date");
  for(const feature of Object.keys(day.features) as Feature[]){
   const a=prior.features[feature],b=day.features[feature];
   const semantic=(value:typeof a)=>value.status==="known"?{status:value.status,value:value.value}:{status:value.status,reason:value.reason};
   if(JSON.stringify(semantic(a))!==JSON.stringify(semantic(b)))changes.push({feature,date:day.date,before:semantic(a),after:semantic(b)});
  }
 }
 const effects=(bundle:EvidenceBundle)=>bundle.relationships.map(r=>({id:r.relationshipId,evidence:r.evidence,effect:r.effect,sampleSize:r.sampleSize,dates:r.pairedOutcomeDates}));
 return {changes,historicalChanged:JSON.stringify(effects(before))!==JSON.stringify(effects(after))};
}
