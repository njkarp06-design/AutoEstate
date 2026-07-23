import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This machine has a known localhost/127.0.0.1 split (WSL relay squats on
  // some ports over IPv6), so dev server access habitually uses 127.0.0.1 -
  // but Next.js's dev-origin protection otherwise blocks that as
  // cross-origin for HMR/dev resources, silently breaking client JS.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
