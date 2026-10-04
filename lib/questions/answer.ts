import { isSupportedBy } from "../capture/mentions";
import type { ExtractionResult, SubjectiveEventType } from "../domain";
import type { Question } from "./contracts";
// Exact uncertainty cannot become a guessed negative, even if provider output is wrong.
export function uncertainAnswer(text:string){return /^\s*(?:i (?:do not|don't|don’t) know|not sure|i(?:'m| am) not sure|i (?:cannot|can't) recall|unknown|nie wiem|nie pamiętam)[.!?\s]*$/iu.test(text);}
const bareAnswer=/^\s*(?:yes|no|tak|nie|zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)(?:\s*(?:out of|\/|na)\s*(?:ten|10))?[.!\s]*$/iu;
export function shortQuestionAnswer(text:string){return bareAnswer.test(text)||uncertainAnswer(text);}
export function guardQuestionAnswer(result:ExtractionResult,question:Question,text:string):ExtractionResult{
 if(uncertainAnswer(text))return {status:"nothing_trackable",reason:"You do not know this observation. It remains unknown; you may skip the question."};
 if(question.feature==="workout_rpe"&&/\b(?:rest day|no workout|no training|did(?:n['’]t| not)\s+(?:work\s*out|train|exercise))\b|nie trenowa/iu.test(text))return {status:"nothing_trackable",reason:"A rest day is not a workout effort rating. It remains unknown; skip this question."};
 if(result.status!=="captured")return result;
 const answerOnly=bareAnswer.test(text),yesNo=/^\s*(?:yes|no|tak|nie)[.!\s]*$/iu.test(text);
 if(answerOnly&&["alcohol","illness","late_meal"].includes(question.feature)&&!yesNo)return {status:"needs_clarification",eventTypes:[question.feature as SubjectiveEventType],reason:"Please answer yes or no, or state the complete observation. A number alone does not answer this exposure question."};
 if(yesNo&&["energy","soreness","mood","stress","workout_rpe"].includes(question.feature))return {status:"needs_clarification",eventTypes:[question.feature as SubjectiveEventType],reason:"Please give an explicit rating from 0 to 10, or skip if you cannot recall it."};
 // Question words support only a short direct answer. Voluntary full reports must support their own dimensions.
 const supported=result.events.filter(e=>isSupportedBy(e.type,text)||answerOnly&&e.type===question.feature);
 if(!supported.length)return {status:"nothing_trackable",reason:"The answer does not contain a supported report. Please state the observation explicitly, or skip."};
 // Never turn a bare no into a fabricated numeric RPE/stress value.
 if(answerOnly&&/^(no|nie)[.!\s]*$/iu.test(text.trim())&&["energy","soreness","mood","stress","workout_rpe"].includes(question.feature))return {status:"needs_clarification",eventTypes:[question.feature as SubjectiveEventType],reason:"Please give an explicit rating from 0 to 10, or skip if you did not train or cannot recall it."};
 return {...result,events:supported};
}
