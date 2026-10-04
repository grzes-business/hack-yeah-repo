import { addCalendarDays, EvidenceBundleSchema, FeatureRegistry, RelationshipRegistry, type EvidenceBundle, type Feature } from "../domain";
import type { FeatureScope } from "../features/contracts";
import { ExplanationPlanSchema, type EvidenceFact } from "./contracts";
const number=(value:number)=>new Intl.NumberFormat("en-GB",{maximumFractionDigits:2}).format(value);
const polish:Partial<Record<Feature,string>>={energy:"Energia",hrv:"HRV",sleep_duration:"Dlugosc snu",stress:"Stres",soreness:"Bolesnosc miesni",workout_rpe:"Wysilek treningowy",alcohol:"Alkohol",caffeine:"Kofeina",illness:"Objawy choroby",late_meal:"Pozny posilek"};
const names=(feature:Feature,language:"en"|"pl")=>language==="pl"?(polish[feature]??FeatureRegistry[feature].label):FeatureRegistry[feature].label;
const units=(feature:Feature)=>feature==="energy"||feature==="stress"||feature==="workout_rpe"?"/10":FeatureRegistry[feature].unit;
export function evidenceFacts(input:EvidenceBundle,scope:FeatureScope,language:"en"|"pl"):EvidenceFact[]{
 const bundle=EvidenceBundleSchema.parse(input),pl=language==="pl",facts:EvidenceFact[]=[];
 const add=(id:string,text:string,...paths:string[])=>facts.push({id,text,paths});
 if(scope==="demo")add("synthetic",pl?"To fikcyjna historia demonstracyjna, nie Twoje dane zdrowotne.":"This is synthetic demonstration history, not your health evidence.","analysisVersion","dailyFeatures.builderVersion");
 const outcome=bundle.dailyFeatures.features[bundle.outcome],name=names(bundle.outcome,language);
 add("current",outcome.status==="known"?`${bundle.dailyFeatures.date}: ${name} ${number(outcome.value as number)} ${units(bundle.outcome)}.`:pl?`${bundle.dailyFeatures.date}: ${name} nie ma znanej wartosci. Brak zapisu nie oznacza zera.`:`${bundle.dailyFeatures.date}: ${name} is unknown. An absent observation does not mean zero.`,"dailyFeatures.date",`dailyFeatures.features.${bundle.outcome}`);
 bundle.currentAnomalies.forEach((anomaly,index)=>{const name=names(anomaly.metric,language);add(`anomaly:${anomaly.metric}`,pl?`${name}: ${anomaly.classification==="unusually_low"?"nietypowo niska":"nietypowo wysoka"} wartosc wobec mediany ${number(anomaly.baseline)} ${anomaly.unit}, z ${anomaly.baselineSampleSize} dni historii.`:`${name} is ${anomaly.classification.replaceAll("_"," ")} compared with a historical median of ${number(anomaly.baseline)} ${anomaly.unit} across ${anomaly.baselineSampleSize} known days.`,`currentAnomalies.${index}`);});
 bundle.relationships.forEach((result,index)=>{
  const definition=RelationshipRegistry[result.relationshipId],factor=names(definition.factor,language),label=result.evidence.toLowerCase().replaceAll("_"," ");
  add(`history:${result.relationshipId}`,pl?`${factor} i ${name}: ${label}; ${result.sampleSize} par w zapisanej historii od ${result.period.from} do ${result.period.to}.`:`${factor} and ${name}: ${label}, using ${result.sampleSize} eligible pairs in recorded history from ${result.period.from} to ${result.period.to}.`,`relationships.${index}.evidence`,`relationships.${index}.sampleSize`,`relationships.${index}.period`);
  if(result.effect?.kind==="spearman")add(`effect:${result.relationshipId}`,pl?`Korelacja rang wynosi ${number(result.effect.rho)}. To zwiazek historyczny, nie dowod przyczyny.`:`The rank correlation is ${number(result.effect.rho)}. This is a historical association, not evidence of a cause.`,`relationships.${index}.effect`);
  if(result.effect?.kind==="exposure"){
   const e=result.effect;
   add(`effect:${result.relationshipId}`,pl?`Po zgloszonym alkoholu: ${e.exposedCount} dni, mediana HRV ${number(e.exposedMedian)} ${e.unit}. Bez alkoholu: ${e.controlCount} dni, mediana ${number(e.controlMedian)} ${e.unit}. Roznica median: ${number(e.medianDifference)} ${e.unit}.`:`Following reported alcohol exposure: ${e.exposedCount} days, median HRV ${number(e.exposedMedian)} ${e.unit}. Following reported absence: ${e.controlCount} days, median ${number(e.controlMedian)} ${e.unit}. The exposed-minus-control difference is ${number(e.medianDifference)} ${e.unit}.`,`relationships.${index}.effect`);
  }
  if(result.status==="insufficient_data")add(`insufficient:${result.relationshipId}`,pl?"Ta relacja nie ma wystarczajacych danych lub zmiennosci do oceny. Nie oznacza to braku zwiazku.":"This relationship lacks sufficient eligible data or variation for evaluation. That does not establish the absence of an association.",`relationships.${index}.status`,`relationships.${index}.limitations`);
 });
 const references=bundle.relationships.flatMap(result=>{
  const d=RelationshipRegistry[result.relationshipId];return [{feature:d.factor,lagDays:d.lagDays},...d.confounders];
 });
 const seen=new Set<string>();
 for(const ref of references){
  const date=addCalendarDays(bundle.dailyFeatures.date,-ref.lagDays),key=`${ref.feature}:${date}`;if(seen.has(key))continue;seen.add(key);
  const contextIndex=bundle.contextDays.findIndex(day=>day.date===date),day=date===bundle.dailyFeatures.date?bundle.dailyFeatures:bundle.contextDays[contextIndex];
  const path=date===bundle.dailyFeatures.date?`dailyFeatures.features.${ref.feature}`:`contextDays.${contextIndex}.features.${ref.feature}`;
  const state=day.features[ref.feature],featureName=names(ref.feature,language);
  if(state.status==="unknown")add(`context:${key}`,pl?`${date}: ${featureName} pozostaje nieznane; nie uzupelniam tego domyslem.`:`${date}: ${featureName} remains unknown; it is not filled in with a guess.`,path);
  else{
   const value=typeof state.value==="boolean"?(state.value?(pl?"zgloszono":"reported present"):(pl?"zgloszono brak":"reported absent")):`${number(state.value)} ${ref.feature==="caffeine"?"mg":units(ref.feature)}`;
   add(`context:${key}`,`${date}: ${featureName}: ${value}.`,path);
  }
 }
 add("limits",pl?"Zwiazki historyczne nie ustalaja przyczyny wyniku tego dnia. Inne czynniki moga wspolwystepowac; analiza nie koryguje statystycznie ich wplywu.":"Historical associations do not establish what caused this day's outcome. Other factors may coexist; this analysis does not statistically adjust for them.","limitations","relationships");
 return facts;
}
export function orderEvidenceFacts(facts:EvidenceFact[],input:unknown):EvidenceFact[]{
 const plan=ExplanationPlanSchema.parse(input),byId=new Map(facts.map(fact=>[fact.id,fact]));
 if(plan.order.length!==facts.length||new Set(plan.order).size!==facts.length||plan.order.some(id=>!byId.has(id)))throw new Error("Explanation must be a permutation of the supplied facts");
 const currentIndex=byId.has("synthetic")?1:0;
 if(byId.has("synthetic")&&plan.order[0]!=="synthetic"||plan.order[currentIndex]!=="current"||plan.order[plan.order.length-1]!=="limits")throw new Error("Disclosure/current outcome/limits must retain their required positions");
 return plan.order.map(id=>byId.get(id)!);
}
