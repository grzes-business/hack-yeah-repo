import { InvestigationPanel } from "@/app/components/investigation";
import { AnalyticsPanel } from "@/app/components/analytics";
export default function Evidence() { return <><header className="header"><p className="eyebrow">Understand your patterns</p><h1>Evidence, with context.</h1><p className="lede">Personal associations need observations, sample sizes, and honest uncertainty.</p></header><InvestigationPanel/><AnalyticsPanel/></>; }
