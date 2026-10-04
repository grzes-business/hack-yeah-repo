import { MobileEvidence } from "../components/mobile-evidence";
import { AppleHealthSync } from "../components/apple-health";
import { DemoHistory } from "../components/demo-history";
import { ProfileSettings } from "../components/profile";
import { SampleReports } from "../components/sample-reports";
export default function Today(){return <><header className="header"><h1>Today</h1><p className="lede">Your observations and the context behind them.</p></header><MobileEvidence/><AppleHealthSync/><details className="card card-body bg-base-100 border border-base-300"><summary>Sample data and settings</summary><SampleReports/><DemoHistory/><ProfileSettings/></details></>;}
