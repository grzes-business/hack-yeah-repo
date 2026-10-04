import {
 addCalendarDays, DailyFeaturesSchema, RelationshipRegistry, RelationshipResultSchema, AnomalySchema,
 type DailyFeatures, type Feature, type RelationshipResult, type RelationshipId, type Anomaly,
} from "../domain";
import { BaselineSchema, type Baseline } from "./contracts";
export const POLICY=Object.freeze({baselineDays:14,baselineMinimum:5,unusualRelative:0.2,relationshipDays:42,pairMinimum:7,groupMinimum:3});
const numericFeatures=["energy","hrv","resting_hr","sleep_duration","steps","active_energy","workout_duration","workout_avg_hr"] as const;
export function median(values:readonly number[]):number|null{
 if(!values.length)return null;
 const ordered=[...values].sort((a,b)=>a-b),middle=Math.floor(ordered.length/2);
 return ordered.length%2?ordered[middle]:(ordered[middle-1]+ordered[middle])/2;
}
function ranks(values:readonly number[]){
 const order=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value||a.index-b.index),result:number[]=[];
 for(let i=0;i<order.length;){let end=i+1;while(end<order.length&&order[end].value===order[i].value)end++;
  const rank=(i+1+end)/2;for(let j=i;j<end;j++)result[order[j].index]=rank;i=end;
 }
 return result;
}
export function spearman(x:readonly number[],y:readonly number[]):number|null{
 if(x.length!==y.length)throw new Error("Paired arrays must have equal lengths");
 if(x.length<2)return null;
 const a=ranks(x),b=ranks(y),mean=(x.length+1)/2;
 let numerator=0,xx=0,yy=0;
 for(let i=0;i<a.length;i++){const dx=a[i]-mean,dy=b[i]-mean;numerator+=dx*dy;xx+=dx*dx;yy+=dy*dy;}
 if(xx===0||yy===0)return null;
 return Math.max(-1,Math.min(1,numerator/Math.sqrt(xx*yy)));
}
function numberAt(row:DailyFeatures|undefined,feature:Feature):number|null{
 const state=row?.features[feature];return state?.status==="known"&&typeof state.value==="number"?state.value:null;
}
function booleanAt(row:DailyFeatures|undefined,feature:Feature):boolean|null{
 const state=row?.features[feature];return state?.status==="known"&&typeof state.value==="boolean"?state.value:null;
}
type Pair={date:string;x:number|boolean;y:number};
function exposure(pairs:Pair[]){
 const exposed=pairs.filter(p=>p.x===true).map(p=>p.y),control=pairs.filter(p=>p.x===false).map(p=>p.y);
 if(!exposed.length||!control.length)return null;
 const exposedMedian=median(exposed)!,controlMedian=median(control)!,difference=exposedMedian-controlMedian;
 return {exposedCount:exposed.length,controlCount:control.length,exposedMedian,controlMedian,medianDifference:difference,relativeDifference:controlMedian===0?null:difference/controlMedian};
}
function relationship(id:RelationshipId,days:Map<string,DailyFeatures>,date:string,userId:string,computedAt:string,version:string):RelationshipResult{
 const definition=RelationshipRegistry[id],period={from:addCalendarDays(date,-POLICY.relationshipDays),to:addCalendarDays(date,-1)};
 const pairs:Pair[]=[];
 for(let day=period.from;day<=period.to;day=addCalendarDays(day,1)){
  const factor=days.get(addCalendarDays(day,-definition.lagDays)),outcome=numberAt(days.get(day),definition.outcome);
  const x=definition.method==="exposure"?booleanAt(factor,definition.factor):numberAt(factor,definition.factor);
  if(x!==null&&outcome!==null)pairs.push({date:day,x,y:outcome});
 }
 const fields={relationshipId:id,userId,period,pairedOutcomeDates:pairs.map(p=>p.date),sampleSize:pairs.length,computedAt,analysisVersion:version};
 const limitations=["Recorded-history association; this does not establish a cause or clinical validity.","Daily recorded totals do not establish complete observation coverage."];
 for(const confounder of definition.confounders){
  const count=pairs.filter(p=>days.get(addCalendarDays(p.date,-confounder.lagDays))?.features[confounder.feature].status==="known").length;
  limitations.push(`${confounder.feature} context is known for ${count}/${pairs.length} pairs; no confounder adjustment was performed.`);
 }
 const insufficient=(reason:string)=>RelationshipResultSchema.parse({...fields,status:"insufficient_data",evidence:"INSUFFICIENT_DATA",effect:null,limitations:[reason,...limitations]});
 const middle=Math.floor(pairs.length/2),early=pairs.slice(0,middle),late=pairs.slice(middle);
 if(definition.method==="spearman"){
  if(pairs.length<POLICY.pairMinimum)return insufficient(`At least ${POLICY.pairMinimum} eligible pairs are required; ${pairs.length} are available.`);
  const correlate=(p:Pair[])=>spearman(p.map(v=>v.x as number),p.map(v=>v.y));
  const rho=correlate(pairs);
  if(rho===null)return insufficient("Rank correlation is undefined because a recorded variable has no variation.");
  const a=correlate(early),b=correlate(late),magnitude=Math.abs(rho);
  const consistent=pairs.length>=24&&magnitude>=0.5&&a!==null&&b!==null&&Math.sign(a)===Math.sign(rho)&&Math.sign(b)===Math.sign(rho)&&Math.abs(a)>=0.3&&Math.abs(b)>=0.3;
  const evidence=magnitude<0.2?"NO_MEANINGFUL_SIGNAL":magnitude<0.4?"WEAK_SIGNAL":consistent?"CONSISTENT_ASSOCIATION":"POSSIBLE_ASSOCIATION";
  return RelationshipResultSchema.parse({...fields,status:"evaluated",evidence,effect:{kind:"spearman",rho},limitations});
 }
 const effect=exposure(pairs);
 if(!effect||effect.exposedCount<POLICY.groupMinimum||effect.controlCount<POLICY.groupMinimum)return insufficient(`At least ${POLICY.groupMinimum} exposed and ${POLICY.groupMinimum} control days are required.`);
 const a=exposure(early),b=exposure(late),relative=effect.relativeDifference,magnitude=relative===null?null:Math.abs(relative);
 const consistent=effect.exposedCount>=10&&effect.controlCount>=10&&magnitude!==null&&magnitude>=0.15&&[a,b].every(half=>half!==null&&half.exposedCount>=3&&half.controlCount>=3&&half.relativeDifference!==null&&Math.abs(half.relativeDifference)>=0.1&&Math.sign(half.medianDifference)===Math.sign(effect.medianDifference));
 if(relative===null)limitations.push("The control median is zero; relative difference and relative effect classification are undefined.");
 const evidence=magnitude===null?(effect.medianDifference===0?"NO_MEANINGFUL_SIGNAL":"WEAK_SIGNAL"):magnitude<0.05?"NO_MEANINGFUL_SIGNAL":magnitude<0.1?"WEAK_SIGNAL":consistent?"CONSISTENT_ASSOCIATION":"POSSIBLE_ASSOCIATION";
 return RelationshipResultSchema.parse({...fields,status:"evaluated",evidence,effect:{kind:"exposure",...effect,unit:"ms"},limitations});
}
export function calculateAnalytics(rows:readonly DailyFeatures[],date:string,computedAt:string,version:string){
 const days=new Map<string,DailyFeatures>();
 for(const raw of rows){const row=DailyFeaturesSchema.parse(raw);if(days.has(row.date))throw new Error("Duplicate daily date");days.set(row.date,row);}
 const current=days.get(date);if(!current)throw new Error("Current day must be explicit, including unknown states");
 for(const row of days.values())if(row.userId!==current.userId||row.timeZone!==current.timeZone||row.builderVersion!==current.builderVersion)throw new Error("Incompatible analytical history");
 for(let day=addCalendarDays(date,-POLICY.relationshipDays-1);day<=date;day=addCalendarDays(day,1))if(!days.has(day))throw new Error("Analysis requires the complete calendar envelope");
 const baselines:Baseline[]=[],anomalies:Anomaly[]=[];
 const period={from:addCalendarDays(date,-POLICY.baselineDays),to:addCalendarDays(date,-1)};
 for(const feature of numericFeatures){
  const values=[...days.values()].filter(r=>r.date>=period.from&&r.date<=period.to).map(r=>numberAt(r,feature)).filter((n):n is number=>n!==null);
  const value=numberAt(current,feature),enough=values.length>=POLICY.baselineMinimum,center=enough?median(values):null;
  const mad=center===null?null:median(values.map(v=>Math.abs(v-center)));
  const relativeDifference=value===null||center===null||center===0?null:(value-center)/center;
  const robustZ=value===null||center===null||mad===null||mad===0?null:0.6745*(value-center)/mad;
  const limitations:string[]=[];
  if(!enough)limitations.push(`At least ${POLICY.baselineMinimum} known historical days are required.`);
  if(value===null)limitations.push("The current value is unknown.");
  if(center===0)limitations.push("Relative difference is undefined for a zero baseline.");
  if(mad===0)limitations.push("Historical MAD is zero; no robust-z anomaly is classified.");
  baselines.push(BaselineSchema.parse({feature,period,sampleSize:values.length,status:enough?"available":"insufficient_data",median:center,mad,currentValue:value,relativeDifference,robustZ,limitations}));
  if(feature!=="energy"&&relativeDifference!==null&&Math.abs(relativeDifference)>=POLICY.unusualRelative){
   const state=current.features[feature];
   if(state.status==="known")anomalies.push(AnomalySchema.parse({metric:feature,value,baseline:center,unit:feature==="hrv"?"ms":feature==="steps"?"count":feature==="active_energy"?"kcal":feature==="resting_hr"||feature==="workout_avg_hr"?"bpm":"min",baselinePeriod:period,baselineSampleSize:values.length,relativeDifference,classification:relativeDifference<0?"unusually_low":"unusually_high",provenance:state.provenance}));
  }
 }
 const relationships=(Object.keys(RelationshipRegistry) as RelationshipId[]).map(id=>relationship(id,days,date,current.userId,computedAt,version));
 return {currentDay:current,baselines,anomalies,relationships};
}
