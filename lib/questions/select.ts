import { addCalendarDays, EvidenceBundleSchema, RelationshipRegistry, SubjectiveEventRegistry, type EvidenceBundle, type Feature } from "../domain";
import { QuestionSchema, type Question } from "./contracts";
// Deliberately excludes objective measurements, and never asks a user to estimate wearable values.
const answerable=["alcohol","stress","illness","workout_rpe","caffeine","late_meal"] as const;
export const questionKey=(feature:Feature,date:string)=>`${feature}:${date}`;
export function questionText(feature:typeof answerable[number],date:string){
 switch(feature){
  case "alcohol":return `On ${date}, did you drink alcohol? Yes or no; the amount may remain unknown.`;
  case "illness":return `On ${date}, did you have illness symptoms? Yes or no; this is a self-report, not a diagnosis.`;
  case "late_meal":return `On ${date}, did you eat a late meal? Yes or no.`;
  case "caffeine":return `On ${date}, how much caffeine did you have in mg? Say no caffeine, or report consumption with an unknown dose. Do not estimate coffee strength.`;
  case "stress":case "workout_rpe":{
   const entry=SubjectiveEventRegistry[feature];
   return `On ${date}, what was your ${entry.label.toLowerCase()} from 0 (${entry.anchors.low}) to 10 (${entry.anchors.high})?${feature==="workout_rpe"?" If you did not train or cannot recall the effort, skip; rest is not an RPE of zero.":""}`;
  }
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
