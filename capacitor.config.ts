import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Loading model (Stage 11): the iOS WebView loads the running Next.js app from
 * `CAP_SERVER_URL`. Server routes, secrets and Supabase privileges stay on that
 * server; the shell only adds native plugins (HealthKit) through the bridge.
 *
 * The URL is read when `pnpm cap:sync` runs and is copied into the iOS project,
 * so re-run sync after changing it. Defaults to the local dev server, which the
 * iOS Simulator reaches as localhost. A physical iPhone needs your Mac's LAN
 * address (HealthKit testing) or an https deployment (required for microphone).
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "http://localhost:3000";

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID ?? "com.personalevidence.app",
  appName: "Personal Evidence",
  // Offline fallback only; the product itself is never bundled.
  webDir: "native-shell",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  ios: {
    // The web app applies env(safe-area-inset-*) itself (viewport-fit=cover).
    contentInset: "never",
    // Keeps the WebView a normal browser surface for the existing session storage.
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
