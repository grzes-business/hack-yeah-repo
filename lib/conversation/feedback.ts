import { SubjectiveEventRegistry, type SubjectiveEvent } from "../domain";
import { formatObservation } from "../capture/display";
import type { CaptureRecord } from "../capture/contracts";
const polish:Record<SubjectiveEvent["type"],string>={energy:"energia",stress:"stres",mood:"nastrój",soreness:"bolesność mięśni",workout_rpe:"wysiłek treningowy",alcohol:"alkohol",caffeine:"kofeina",pain:"ból",late_meal:"późny posiłek",illness:"objawy choroby"};
export function observationText(event:SubjectiveEvent,language:"en"|"pl") {
 const label=language==="pl"?polish[event.type]:SubjectiveEventRegistry[event.type].label;
 if(language==="en") return `${label}: ${formatObservation(event)}`;
 let value:string;
 switch(event.type){
  case "energy":case "stress":case "mood":case "soreness":case "workout_rpe":value=`${event.value} na 10`;break;
  case "caffeine":value=!event.value.consumed?"nie spożyto":event.value.amountMg===null?"spożyto, dawka nieznana":`${event.value.amountMg} mg`;break;
  case "alcohol":value=!event.value.consumed?"nie spożyto":event.value.quantity===null?"spożyto, ilość nieznana":`${event.value.quantity} napojów`;break;
  case "pain":value=!event.value.present?"brak":`${event.value.location??"miejsce nieznane"}, ${event.value.intensity===null?"natężenie nieznane":`${event.value.intensity} na 10`}`;break;
  default:value=event.value?"zgłoszono":"zgłoszono brak";
 }
 return `${label}: ${value}`;
}
export function captureFeedback(record:CaptureRecord,language:"en"|"pl",corrected:boolean){
 const r=record.result;
 if(record.pending||!r) return language==="pl"?"Zapis nie został jeszcze potwierdzony.":"Saving is not confirmed yet.";
 if(r.status==="needs_clarification") return `${r.reason}${record.acceptedResult?language==="pl"?" Poprzedni zapis pozostaje bez zmian.":" Your earlier saved observations remain unchanged.":""}`;
 if(r.status==="nothing_trackable") return language==="pl"?"Nie zapisano nowych obserwacji. Ta wypowiedź nie zawiera obsługiwanej informacji do zapisania.":"No new observations were saved. That statement contains no supported report.";
 const prefix=language==="pl"?(corrected?"Poprawiono zapis: ":"Zapisano: "):(corrected?"Updated the saved report: ":"Saved: ");
 return prefix+r.events.slice(0,4).map(e=>observationText(e,language)).join("; ")+(r.events.length>4?language==="pl"?". Pozostałe obserwacje są na karcie.":". The remaining observations are on the card.":".");
}
