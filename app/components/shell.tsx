"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionPanel, SessionProvider } from "./session";
const links = [["/", "Today"], ["/talk", "Talk"], ["/evidence", "Evidence"], ["/timeline", "Timeline"]] as const;
export function Shell({ children }: { children: React.ReactNode }) {
 const pathname = usePathname();
 return <SessionProvider><div className="app-shell">
  <header className="app-header"><Link href="/" className="brand">Personal Evidence<span>Voice + wearable observations</span></Link><Link href="/status" className="status-link">App status</Link></header>
  <nav aria-label="Main navigation">{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav>
  <main className="product-main">{children}<SessionPanel /></main>
  <footer>Wearables tell you what happened. We investigate why.</footer>
 </div></SessionProvider>;
}
