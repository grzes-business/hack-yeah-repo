import Link from "next/link";
import { DemoHistory } from "../components/demo-history";
import { ProfileSettings } from "../components/profile";
export default function Today() {
 return <><header className="header"><p className="eyebrow">Your personal evidence</p><h1>Make sense of how you feel.</h1><p className="lede">Connect what your body records with what only you can tell us.</p></header>
 <section className="card"><h2>Your history starts here</h2><p>No observations have been connected to this view yet. As your history grows, this space will surface unusual changes and useful questions.</p><Link className="text-link" href="/timeline">Explore your timeline →</Link></section><DemoHistory /><ProfileSettings /></>;
}
