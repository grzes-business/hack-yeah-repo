import { MobileEvidence } from "@/app/components/mobile-evidence";
import { InvestigationPanel } from "@/app/components/investigation";
import { AnalyticsPanel } from "@/app/components/analytics";
export default function Evidence(){return <><header className="header"><h1>Insights</h1><p className="lede">Explore patterns in your recorded history.</p></header><MobileEvidence insights/>{process.env.NODE_ENV!=="production"&&<details className="card card-body bg-base-100 border border-base-300 diagnostic-tools"><summary>Development evidence inspectors</summary><InvestigationPanel/><AnalyticsPanel/></details>}</>;}
