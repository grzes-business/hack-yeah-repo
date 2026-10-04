import type { EvidenceBundle } from "../domain";
import type { FeatureScope } from "../features/contracts";
import { ExplanationSchema, type EvidenceFact } from "./contracts";
import { evidenceFacts, orderEvidenceFacts } from "./facts";
import { selectEvidenceOrder } from "./provider";
export async function explainEvidence(bundle:EvidenceBundle,scope:FeatureScope,language:"en"|"pl",selector:(facts:readonly EvidenceFact[])=>Promise<unknown>=selectEvidenceOrder){
 const facts=evidenceFacts(bundle,scope,language);
 let ordered=facts,source:"model_ordered"|"deterministic_fallback"="deterministic_fallback",fallbackReason:"provider_unavailable"|"invalid_plan"|null=null;
 let plan:unknown;
 try{plan=await selector(facts);}catch{fallbackReason="provider_unavailable";}
 if(!fallbackReason){try{ordered=orderEvidenceFacts(facts,plan);source="model_ordered";}catch{fallbackReason="invalid_plan";}}
 return ExplanationSchema.parse({source,fallbackReason,facts:ordered,summary:ordered.map(fact=>fact.text).join(" ")});
}
