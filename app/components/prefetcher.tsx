"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getLocalDate } from "@/lib/domain";
import { cached, evidenceKey, experimentsKey, historyKey, loadEvidence, loadExperiments } from "./data-cache";
import { useHealthSession } from "./session";
import { useTalkContext } from "./talk-context";

const ROUTES = ["/talk", "/", "/evidence", "/timeline"];

/**
 * Warms every tab once the session is ready: route code plus today's evidence,
 * experiments and history in the shared cache. Errors are ignored here; each
 * page shows its own error and retries when opened.
 */
export function Prefetcher() {
  const router = useRouter();
  const { session, profile, repository, historyRevision } = useHealthSession();
  const { scope } = useTalkContext();
  useEffect(() => { ROUTES.forEach(route => router.prefetch(route)); }, [router]);
  useEffect(() => {
    if (!session || !profile || !repository) return;
    const owner = session.user.id, token = session.access_token;
    const today = getLocalDate(new Date().toISOString(), profile.time_zone);
    const ignore = () => {};
    cached(evidenceKey(owner, today, scope, historyRevision), () => loadEvidence(token, today, scope)).catch(ignore);
    cached(experimentsKey(owner, historyRevision), () => loadExperiments(token)).catch(ignore);
    cached(historyKey(owner, historyRevision), () => repository.listObservations()).catch(ignore);
  }, [session, profile, repository, historyRevision, scope]);
  return null;
}
