import type { SubjectiveEvent } from "../domain";
export function formatObservation(event: SubjectiveEvent): string {
 switch(event.type) {
  case "energy": case "stress": case "mood": case "soreness": case "workout_rpe": return `${Math.round(event.value * 10) / 10} / 10`;
  case "late_meal": case "illness": return event.value ? "Reported" : "Reported absent";
  case "alcohol": return !event.value.consumed ? "No alcohol reported" : event.value.quantity === null ? "Alcohol reported; amount unknown" : `${event.value.quantity} reported drinks${event.value.beverage ? ` (${event.value.beverage})` : ""}`;
  case "caffeine": return !event.value.consumed ? "No caffeine reported" : event.value.amountMg === null ? "Caffeine reported; dose unknown" : `${event.value.amountMg} mg`;
  case "pain": return !event.value.present ? "No pain reported" : `${event.value.location ?? "Location unknown"} · ${event.value.intensity === null ? "Intensity unknown" : `${event.value.intensity} / 10`}`;
 }
}
