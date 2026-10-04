"use client";
import { MicrophoneIcon, SquaresFourIcon, ChartLineUpIcon, ClockCounterClockwiseIcon, GearSixIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Appearance } from "./appearance";
import { TalkProvider } from "./talk-context";
import { SessionPanel, SessionProvider } from "./session";
const links = [["/talk", "Talk", MicrophoneIcon], ["/", "Today", SquaresFourIcon], ["/evidence", "Insights", ChartLineUpIcon], ["/timeline", "History", ClockCounterClockwiseIcon]] as const;
export function Shell({ children }: { children: React.ReactNode }) {
 const pathname = usePathname();
 return <SessionProvider><TalkProvider><div className={`app-shell ${pathname==="/talk"?"talk-shell":""}`}>
  <a className="btn btn-primary skip-link" href="#main-content">Skip to content</a><header className="navbar app-header"><Link href="/talk" className="btn btn-ghost text-lg brand">Personal Evidence</Link><div className="header-actions"><Appearance/><Link href="/status" className="btn btn-ghost btn-circle" aria-label="App status"><GearSixIcon size={22}/></Link></div></header>
  <nav className="dock bottom-nav" aria-label="Main navigation">{links.map(([href, label,Icon]) => <Link key={href} href={href} className={pathname === href ? "dock-active" : undefined} aria-current={pathname === href ? "page" : undefined}><Icon size={24} weight={pathname===href?"fill":"regular"} aria-hidden="true"/><span className="dock-label">{label}</span></Link>)}</nav>
  <main id="main-content" className="product-main"><SessionPanel />{children}</main>
 </div></TalkProvider></SessionProvider>;
}
