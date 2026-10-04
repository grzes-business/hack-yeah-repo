import { addCalendarDays, DailyFeaturesSchema, FeatureRegistry, type DailyFeatures, type Feature } from "../domain";
export const date="2026-10-03",computedAt="2026-10-04T00:00:00.000Z",version="analytics-v1:daily-v1:personal";
export function emptyHistory():DailyFeatures[]{
 const rows:DailyFeatures[]=[];
 for(let day=addCalendarDays(date,-43);day<=date;day=addCalendarDays(day,1))rows.push(DailyFeaturesSchema.parse({contractVersion:1,userId:"owner",date:day,timeZone:"Europe/Warsaw",builderVersion:"daily-v1:personal",builtAt:computedAt,features:Object.fromEntries(Object.keys(FeatureRegistry).map(key=>[key,{status:"unknown",reason:"not_observed"}]))}));
 return rows;
}
export function setKnown(row:DailyFeatures,key:Feature,value:number|boolean){
 const objective=["hrv","sleep_duration","resting_hr","steps","active_energy","workout_duration","workout_avg_hr"].includes(key);
 (row.features as Record<string,unknown>)[key]={status:"known",value,provenance:{metricSampleIds:objective?[`${row.date}:${key}`]:[],subjectiveEventIds:objective?[]:[`${row.date}:${key}`]}};
}
