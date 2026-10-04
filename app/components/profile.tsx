"use client";
import { useState } from "react";
import { useHealthSession } from "./session";
export function ProfileSettings() {
 const { profile, repository, setProfile } = useHealthSession();
 const [message, setMessage] = useState<string | null>(null);
 const [busy, setBusy] = useState(false);
 if (!profile || !repository) return null;
 return <section className="card card-body bg-base-100 border border-base-300"><h2>Your profile</h2><form key={profile.user_id} onSubmit={async event => {
  event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setMessage(null);
  try { setProfile(await repository.updateProfile({ displayName: data.get("name"), timeZone: data.get("zone") })); setMessage("Profile saved."); }
  catch { setMessage("Could not save. Use a name and a valid time zone, such as Europe/Warsaw, then retry."); }
  finally { setBusy(false); }
 }}><label htmlFor="name">Name</label><input className="input w-full" id="name" name="name" defaultValue={profile.display_name} required maxLength={100}/><label htmlFor="zone">Time zone</label><input className="input w-full" id="zone" name="zone" defaultValue={profile.time_zone} required maxLength={100}/><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>{message && <p role="status">{message}</p>}</form></section>;
}
