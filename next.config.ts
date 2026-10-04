import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone (the iOS shell) use `next dev` over the LAN, e.g.
  // NEXT_ALLOWED_DEV_ORIGINS=192.168.1.20 pnpm dev. Development only.
  allowedDevOrigins: (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "").split(",").map(v => v.trim()).filter(Boolean),
};

export default nextConfig;
