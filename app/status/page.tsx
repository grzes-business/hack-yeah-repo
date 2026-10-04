import { getDeploymentEnvironment, type DeploymentEnvironment } from "@/lib/deployment";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const environments: Record<DeploymentEnvironment, { name: string; description: string }> = {
  local: {
    name: "Local development",
    description: "Running on this machine with next dev or next start.",
  },
  preview: {
    name: "Vercel preview",
    description: "A preview deployment built from a branch or pull request.",
  },
  production: {
    name: "Vercel production",
    description: "The production deployment of this project.",
  },
};

export default function Home() {
  const environment = getDeploymentEnvironment();
  const { name, description } = environments[environment];
  const supabaseConfigured = isSupabaseConfigured();

  return (
    <main className="page">
      <header className="header">
        <p className="eyebrow">Next.js · Supabase · Vercel</p>
        <h1>Hackathon starter is running</h1>
        <p className="lede">Edit app/page.tsx to start building.</p>
      </header>

      <section className="card card-body bg-base-100 border border-base-300" aria-labelledby="deployment-heading">
        <h2 id="deployment-heading">Deployment</h2>
        <span className={`badge badge-soft ${environment==="local"?"badge-warning":"badge-success"}`}>{name}</span>
        <p>{description}</p>
      </section>

      <section className="card card-body bg-base-100 border border-base-300" aria-labelledby="supabase-heading">
        <h2 id="supabase-heading">Supabase</h2>
        <span className={`badge ${supabaseConfigured ? "badge-soft badge-success" : "badge-ghost"}`}>
          {supabaseConfigured ? "Configured" : "Not configured"}
        </span>
        <p>
          {supabaseConfigured
            ? "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set. This page does not query the database."
            : "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local. The app runs without them."}
        </p>
      </section>
    </main>
  );
}
