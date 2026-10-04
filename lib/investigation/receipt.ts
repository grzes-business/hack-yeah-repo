import { analysisVersion } from "../analytics/contracts";
import { builderVersion } from "../features/contracts";
import type { VoiceOutcome } from "../conversation/controller-contracts";
export function freshInvestigationReceipt(outcome:VoiceOutcome,state:{generation:string;timeZone:string}):VoiceOutcome{
 const investigation=outcome.investigation;
 if(!investigation||investigation.inputGeneration===state.generation&&investigation.bundle.dailyFeatures.timeZone===state.timeZone&&investigation.bundle.analysisVersion===analysisVersion(investigation.scope)&&investigation.bundle.dailyFeatures.builderVersion===builderVersion(investigation.scope))return outcome;
 const {investigation:discarded,...rest}=outcome;
 void discarded;
 return {...rest,disposition:"conversation",reply:"This investigation is no longer current because observations or the time zone changed. Request a new investigation to use current evidence."};
}
