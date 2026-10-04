import type { InvestigationResult } from "./contracts";
// Short speech selects already validated facts. It never calculates or paraphrases a statistic.
export function investigationSpeech(result:InvestigationResult,question?:string){
 const facts=result.explanation.facts;
 const selected=[facts.find(f=>f.id==="synthetic"),facts.find(f=>f.id==="current"),facts.find(f=>f.id.startsWith("anomaly:"))??facts.find(f=>f.id.startsWith("history:"))].filter(f=>f!==undefined);
 return selected.map(f=>f.text).join(" ")+" Historical associations do not establish a cause. "+(question?question:"No further answerable context question remains. See Insights for details.");
}
