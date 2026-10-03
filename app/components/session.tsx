"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase";
import { createHealthRepository, type HealthRepository, type Profile } from "@/lib/db/repository";
type State = { repository: HealthRepository | null; session: Session | null; profile: Profile | null; loading: boolean; busy: boolean; error: string | null; start: () => Promise<void>; retry: () => void; setProfile: (p: Profile) => void; historyRevision: number; refreshHistory: () => void };
const Context = createContext<State | null>(null);
export function useHealthSession() { const value = useContext(Context); if (!value) throw new Error("Missing session provider."); return value; }
export function SessionProvider({ children }: { children: ReactNode }) {
 const [client] = useState(createSupabaseClient);
 const [repository] = useState(() => client ? createHealthRepository(client) : null);
 const [session, setSession] = useState<Session | null>(null);
 const [profile, setProfile] = useState<Profile | null>(null);
 const [loading, setLoading] = useState(Boolean(client));
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [revision, setRevision] = useState(0);
 const [historyRevision, setHistoryRevision] = useState(0);
 useEffect(() => {
  if (!client) return;
  let active = true;
  const { data: listener } = client.auth.onAuthStateChange((_event, current) => {
   if (active) { setSession(current); setLoading(false); }
  });
  client.auth.getSession().then(({ data, error }) => {
   if (active) { setSession(data.session); setLoading(false); if (error) setError("Could not restore your session. Please retry."); }
  }).catch(() => { if (active) { setLoading(false); setError("Could not restore your session. Please retry."); } });
  return () => { active = false; listener.subscription.unsubscribe(); };
 }, [client, revision]);
 const identity = session?.user.id;
 useEffect(() => {
  if (!identity || !repository) return;
  let active = true;
  repository.ensureProfile(Intl.DateTimeFormat().resolvedOptions().timeZone).then(p => { if (active) { setProfile(p); setError(null); } }).catch(() => {
   if (active) setError("Your session is ready, but profile storage is unavailable. Check the database setup and retry.");
  });
  return () => { active = false; };
 }, [identity, repository, revision]);
 async function start() {
  if (!client) return;
  setBusy(true); setError(null);
  try {
   const { error } = await client.auth.signInAnonymously();
   if (error) setError(error.code === "anonymous_provider_disabled" ? "Demo sign-in is not enabled yet. Enable Anonymous Sign-Ins in Supabase." : "Could not start the demo. Please retry; the service may be unavailable or rate limited.");
  } catch { setError("Could not connect. Check your connection and retry."); }
  finally { setBusy(false); }
 }
 return <Context.Provider value={{ repository, session, profile: profile?.user_id === identity ? profile : null, loading, busy, error, start, retry: () => setRevision(v => v + 1), setProfile, historyRevision, refreshHistory: () => setHistoryRevision(v => v + 1) }}>{children}</Context.Provider>;
}
export function SessionPanel() {
 const { repository, session, profile, loading, busy, error, start, retry } = useHealthSession();
 return <section className="card session-panel" aria-label="Demo session">
  {!repository ? <><h2>Demo setup needed</h2><p>The app is available to explore. Add the Supabase connection to start a private demo session.</p></> : loading ? <p role="status">Restoring your session…</p> : session ? <><span className="badge badge-ok">Private session</span><p>{profile ? `Welcome, ${profile.display_name}. Your time zone is ${profile.time_zone}.` : "Preparing your profile…"}</p></> : <><h2>Start with your own history</h2><p>Create a private demo session with one click. No email or password needed.</p><button onClick={start} disabled={busy}>{busy ? "Starting…" : "Start demo"}</button><p className="small">This session stays in this browser. Clearing browser data loses access; use sample information for the demo.</p></>}
  {error && <div role="alert"><p>{error}</p><button onClick={retry} disabled={busy}>Retry connection</button></div>}
 </section>;
}
